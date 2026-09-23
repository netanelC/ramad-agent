import { GoogleGenAI, Type, type GenerateContentResponse, type Content, type Part } from '@google/genai';
import fs from 'fs';
import path from 'path';
import { config } from '../config/env.js';
import { sheetsService } from './sheets.service.js';
import type { ChatTurn } from './conversation.service.js';
import { logger } from '../common/logger.js';
import { ExternalServiceError } from '../common/errors/app-error.js';

export interface GeminiFunctionCall {
  name: string;
  args: Record<string, unknown>;
  id?: string;
}

export interface AgentResponseResult {
  text?: string;
  functionCalls?: GeminiFunctionCall[];
  toolResults?: string[];
}

export type ToolExecutor = (call: GeminiFunctionCall) => Promise<string>;

let cachedSkillContent: string | null = null;
let cachedDoctrineContent: string | null = null;

function loadSkillContent(): string {
  if (cachedSkillContent !== null) return cachedSkillContent;
  const skillPath = path.resolve(process.cwd(), '.agents/skills/ramad-audit-agent/SKILL.md');
  try {
    if (fs.existsSync(skillPath)) {
      cachedSkillContent = fs.readFileSync(skillPath, 'utf-8');
      return cachedSkillContent;
    }
  } catch (error: unknown) {
    logger.warn({ err: error, skillPath }, 'Could not read SKILL.md');
  }
  return '';
}

function loadDoctrineContent(): string {
  if (cachedDoctrineContent !== null) return cachedDoctrineContent;
  try {
    const doctrinePath = path.resolve(process.cwd(), 'doctrine.md');
    if (fs.existsSync(doctrinePath)) {
      cachedDoctrineContent = fs.readFileSync(doctrinePath, 'utf-8');
      return cachedDoctrineContent;
    }
  } catch (error: unknown) {
    logger.warn({ err: error }, 'Could not read doctrine.md file');
  }
  return '';
}

export class GeminiService {
  private ai: GoogleGenAI;
  private fallbackModels: string[] = [
    config.geminiModel || 'gemini-3.6-flash',
    'gemini-3.6-flash',
    'gemini-3.7-flash',
    'gemini-2.5-flash',
  ].filter((m, i, self) => m && self.indexOf(m) === i);

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: config.geminiApiKey });
  }

  private extractTextFromResponse(response: GenerateContentResponse): string {
    const parts = response.candidates?.[0]?.content?.parts || [];
    return parts
      .filter((p: Part) => typeof p.text === 'string' && p.text.trim())
      .map((p: Part) => (p.text ? p.text.trim() : ''))
      .filter(Boolean)
      .join('\n');
  }

  private async executeGenerateContent(options: Record<string, unknown>): Promise<GenerateContentResponse> {
    let lastError: unknown;

    for (let attempt = 0; attempt < this.fallbackModels.length; attempt++) {
      const modelName = this.fallbackModels[attempt] || 'gemini-3.6-flash';
      try {
        const response = await this.ai.models.generateContent({
          ...(options as unknown as Parameters<typeof this.ai.models.generateContent>[0]),
          model: modelName,
        });
        return response;
      } catch (error: unknown) {
        lastError = error;
        const errMsg = error instanceof Error ? error.message : String(error);
        const isTransientError =
          errMsg.includes('503') ||
          errMsg.includes('UNAVAILABLE') ||
          errMsg.includes('high demand') ||
          errMsg.includes('temporarily unavailable') ||
          errMsg.includes('429') ||
          errMsg.includes('RESOURCE_EXHAUSTED');

        const isModelUnavailable =
          errMsg.includes('NOT_FOUND') ||
          errMsg.includes('404') ||
          errMsg.includes('no longer available') ||
          errMsg.includes('not supported') ||
          errMsg.includes('unsupported');

        logger.warn(
          { modelName, attempt: attempt + 1, totalAttempts: this.fallbackModels.length, isTransientError, isModelUnavailable, errMsg },
          'Gemini API model attempt failed'
        );

        if (!isTransientError && !isModelUnavailable) {
          throw new ExternalServiceError('Gemini API', errMsg);
        }

        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    const finalErrMsg = lastError instanceof Error ? lastError.message : String(lastError);
    throw new ExternalServiceError('Gemini API', finalErrMsg);
  }

  private buildContents(userText: string, history: ChatTurn[] = []): Content[] {
    const contents: Content[] = [];

    for (const turn of history) {
      if (!turn.text || !turn.text.trim()) continue;
      const lastTurn = contents[contents.length - 1];
      if (lastTurn && lastTurn.role === turn.role && lastTurn.parts?.[0]) {
        lastTurn.parts[0].text = `${lastTurn.parts[0].text || ''}\n${turn.text.trim()}`;
      } else {
        contents.push({
          role: turn.role,
          parts: [{ text: turn.text.trim() }],
        });
      }
    }

    const lastTurn = contents[contents.length - 1];
    if (lastTurn && lastTurn.role === 'user' && lastTurn.parts?.[0]) {
      lastTurn.parts[0].text = `${lastTurn.parts[0].text || ''}\n${userText.trim()}`;
    } else {
      contents.push({
        role: 'user',
        parts: [{ text: userText.trim() }],
      });
    }

    return contents;
  }

  public async generateAgentResponse(
    userText: string,
    history?: ChatTurn[],
    liveSystemContext?: string
  ): Promise<AgentResponseResult> {
    const textResult = await this.generateAgentResponseWithLoop(
      userText,
      async () => 'No tools executed in cron mode',
      history,
      liveSystemContext
    );
    return { text: textResult };
  }

  public async generateAgentResponseWithLoop(
    userText: string,
    toolExecutor: ToolExecutor,
    history?: ChatTurn[],
    liveSystemContext?: string
  ): Promise<string> {
    const context = liveSystemContext ?? (await sheetsService.getSystemContext());
    const skillText = loadSkillContent();
    const doctrineText = loadDoctrineContent();

    const skillSection = skillText
      ? `[מקור האמת: הנחיות הסוכן מתוך SKILL.md]\n${skillText}`
      : '[הנחיות הסוכן מתוך SKILL.md לא נמצאו]';

    const doctrineSection = doctrineText
      ? `[עקרונות התפיסה הפיקודית מתוך doctrine.md]\n${doctrineText}`
      : '[מסמך התפיסה הפיקודית doctrine.md לא נמצא]';

    const systemInstruction = `${skillSection}\n\n${doctrineSection}\n\n${context}`;
    const contents = this.buildContents(userText, history);

    const toolsConfig = [
      {
        functionDeclarations: [
          {
            name: 'create_task',
            description: 'יוצרת משימה חדשה ישירות בגיליון משימות_ותגב עם כותרת, צוות, תג"ב ועדיפות. יש להפעיל פונקציה זו בכל פעם שהרמ"ד מבקש ליצור/להוסיף משימה! לעולם אל תדווח בטקסט על יצירת משימה מבלי להפעיל פונקציה זו.',
            parameters: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING, description: 'כותרת המשימה' },
                team: { type: Type.STRING, description: 'שם הצוות (טטריס, קסבה, טקסס, ברוקלין, ארמורי, או רוחבי)' },
                tgb: { type: Type.STRING, description: 'תג"ב יעד בפורמט YYYY-MM-DD' },
                priority: { type: Type.STRING, description: 'עדיפות המשימה (P1 / P2 / P3)', enum: ['P1', 'P2', 'P3'] },
                effort: { type: Type.STRING, description: 'רמת קשב וזמן עבודה' },
                contacts: { type: Type.STRING, description: 'אנשי קשר וגורמי חוץ' },
                notes: { type: Type.STRING, description: 'הערות ודגשים נוספים' },
              },
              required: ['title', 'team', 'tgb', 'priority'],
            },
          },
          {
            name: 'close_task',
            description: 'מעדכן את עמודת שלב עבודה ל-"הושלם", מעביר מגיליון משימות_ותגב לגיליון ארכיון_משימות ומוחק אותה מרשימת המשימות הפתוחות.',
            parameters: {
              type: Type.OBJECT,
              properties: {
                taskId: { type: Type.STRING, description: 'מזהה המשימה בגיליון' },
              },
              required: ['taskId'],
            },
          },
          {
            name: 'add_staff_interface',
            description: 'מוסיפה איש מטה, נוהל מטה, SOP או תרחיש לגיליון אנשי_קשר_מטה.',
            parameters: {
              type: Type.OBJECT,
              properties: {
                domain: { type: Type.STRING, description: 'תחום / נושא' },
                roleAndContact: { type: Type.STRING, description: 'גורם מטה / איש קשר ודרכי התקשרות' },
                responsibilities: { type: Type.STRING, description: 'תחומי אחריות וסמכות' },
                sop: { type: Type.STRING, description: 'נוהל מטה / SOP / תרחיש עבודה' },
              },
              required: ['domain', 'roleAndContact', 'responsibilities', 'sop'],
            },
          },
          {
            name: 'postpone_task',
            description: 'מעדכן את התג"ב המעודכן, מעלה את מונה הדחיות ב-1 ורושם נימוק דחייה בגיליון. יש להפעיל פונקציה זו רק אם הרמ"ד סיפק נימוק מבצעי משכנע!',
            parameters: {
              type: Type.OBJECT,
              properties: {
                taskId: { type: Type.STRING, description: 'מזהה המשימה' },
                newDate: { type: Type.STRING, description: 'התאריך החדש לתג"ב בפורמט YYYY-MM-DD' },
                reason: { type: Type.STRING, description: 'הנימוק המבצעי לדחייה' },
              },
              required: ['taskId', 'newDate', 'reason'],
            },
          },
          {
            name: 'update_task_priority',
            description: 'מעדכן את עדיפות המשימה בגיליון (P1 / P2 / P3).',
            parameters: {
              type: Type.OBJECT,
              properties: {
                taskId: { type: Type.STRING, description: 'מזהה המשימה' },
                newPriority: { type: Type.STRING, description: 'העדיפות החדשה: P1, P2, או P3', enum: ['P1', 'P2', 'P3'] },
              },
              required: ['taskId', 'newPriority'],
            },
          },
          {
            name: 'save_memory_insight',
            description: 'שומרת תובנת דפוס/הרגל חוזר מובהק על הרמ"ד בגיליון זיכרון_רמד. יש להשתמש בכלי זה אך ורק כאשר מזהים דפוס התנהגותי/נקודת תורפה אמיתית של הרמ"ד. לעולם אל תתעד תובנה שגרתית או מחמאה על משימה בודדת!',
            parameters: {
              type: Type.OBJECT,
              properties: {
                domain: { type: Type.STRING, description: 'התחום' },
                patternType: { type: Type.STRING, description: 'סוג תבנית/נקודת תורפה' },
                description: { type: Type.STRING, description: 'תיאור הדפוס והראיות מהשטח (ללא חנפנות!)' },
                impact: { type: Type.STRING, description: 'השפעה מבצעית על המדור ונקודת תורפה' },
                recommendation: { type: Type.STRING, description: 'שאלת מראה / המלצה לפעולה מתקנת' },
              },
              required: ['domain', 'patternType', 'description', 'impact', 'recommendation'],
            },
          },
          {
            name: 'update_person_details',
            description: 'מעדכנת פרטים אישיים, יעדים, ת"ש, לימודים, או תאריכי מפגש של משרת בגיליון אנשים_ופיתוח.',
            parameters: {
              type: Type.OBJECT,
              properties: {
                personName: { type: Type.STRING, description: 'שם החייל המדויק' },
                targetField: {
                  type: Type.STRING,
                  description: 'שם העמודה המדויק (למשל: יעד אישי, תאריך יעד למפגש הבא, סטטוס אופק שירות / שימור, התאמות ת״ש / מעמד מיוחד, נע"ת, הערות, סטטוס תואר, סטטוס הצטיינות והוקרה)',
                },
                newValue: { type: Type.STRING, description: 'הערך החדש שיוזן לתא' },
              },
              required: ['personName', 'targetField', 'newValue'],
            },
          },
        ],
      },
    ];

    const maxLoopTurns = 3;
    const accumulatedToolResults: string[] = [];

    for (let turn = 0; turn < maxLoopTurns; turn++) {
      const response = await this.executeGenerateContent({
        config: {
          thinkingConfig: { thinkingBudget: 0 },
          systemInstruction,
          tools: toolsConfig,
        },
        contents,
      });

      const rawCalls = response.functionCalls || [];
      const textResponse = this.extractTextFromResponse(response);

      if (rawCalls.length === 0) {
        // No more tool calls requested. Return final text output synthesized by Gemini.
        if (accumulatedToolResults.length > 0) {
          const toolSummary = accumulatedToolResults.map((r) => `• ${r}`).join('\n');
          return `*בוצע. הפעולות הבאות עודכנו בגיליון:*\n${toolSummary}\n\n${textResponse}`.trim();
        }
        return textResponse.trim() || 'נקלט.';
      }

      // Process tool calls
      const toolOutputs: Array<{ name: string; response: { output: string } }> = [];
      for (const fc of rawCalls) {
        const functionName = fc.name || 'unknown_tool';
        const functionArgs = (fc.args as Record<string, unknown>) || {};
        const callObj: GeminiFunctionCall = {
          name: functionName,
          args: functionArgs,
          ...(fc.id ? { id: fc.id } : {}),
        };
        const resultStr = await toolExecutor(callObj);
        accumulatedToolResults.push(resultStr);
        toolOutputs.push({
          name: functionName,
          response: { output: resultStr },
        });
      }

      // Append model response & function outputs back into contents loop
      // MUST preserve response.candidates[0].content so thought_signature remains intact for Gemini API
      const candidateContent = response.candidates?.[0]?.content;
      if (candidateContent) {
        contents.push(candidateContent);
      } else {
        contents.push({
          role: 'model',
          parts: rawCalls.map((fc) => ({
            functionCall: {
              name: fc.name || 'unknown_tool',
              args: (fc.args as Record<string, unknown>) || {},
            },
          })),
        });
      }

      contents.push({
        role: 'user',
        parts: toolOutputs.map((to) => ({
          functionResponse: { name: to.name, response: to.response },
        })),
      });
    }

    const toolSummary = accumulatedToolResults.map((r) => `• ${r}`).join('\n');
    return `*בוצע. הפעולות הבאות עודכנו בגיליון:*\n${toolSummary}`;
  }
}

export const geminiService = new GeminiService();
