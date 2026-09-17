import { GoogleGenAI, Type } from '@google/genai';
import fs from 'fs';
import path from 'path';
import { config } from '../config/env.js';
import { sheetsService } from './sheets.service.js';
import type { ChatTurn } from './conversation.service.js';

export interface GeminiFunctionCall {
  name: string;
  args: Record<string, any>;
  id?: string;
}

export interface AgentResponseResult {
  text?: string;
  functionCalls?: GeminiFunctionCall[];
  toolResults?: string[];
}

export type ToolExecutor = (call: GeminiFunctionCall) => Promise<string>;

function loadSkillContent(): string {
  const skillPath = path.resolve(process.cwd(), '.agents/skills/ramad-audit-agent/SKILL.md');
  try {
    if (fs.existsSync(skillPath)) {
      return fs.readFileSync(skillPath, 'utf-8');
    }
  } catch (error: unknown) {
    console.warn(`Could not read SKILL.md from ${skillPath}:`, error);
  }
  return '';
}

function loadDoctrineContent(): string {
  try {
    const doctrinePath = path.resolve(process.cwd(), 'doctrine.md');
    if (fs.existsSync(doctrinePath)) {
      return fs.readFileSync(doctrinePath, 'utf-8');
    }
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.warn('Could not read doctrine.md file:', errMsg);
  }
  return '';
}

export class GeminiService {
  private ai: GoogleGenAI;
  private fallbackModels: string[] = ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.6-flash'];

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: config.geminiApiKey });
  }

  private async executeGenerateContent(options: Record<string, any>): Promise<any> {
    let lastError: unknown;

    for (let attempt = 0; attempt < this.fallbackModels.length; attempt++) {
      const modelName = this.fallbackModels[attempt];
      try {
        const response = await this.ai.models.generateContent({
          ...(options as any),
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

        console.warn(
          `Gemini API call with model '${modelName}' failed (attempt ${attempt + 1}/${this.fallbackModels.length}, transient: ${isTransientError}): ${errMsg}`
        );

        if (!isTransientError) {
          throw error;
        }

        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    throw lastError;
  }

  private buildContents(userText: string, history: ChatTurn[] = []): any[] {
    const contents: any[] = [];

    for (const turn of history) {
      if (!turn.text || !turn.text.trim()) continue;
      const lastTurn = contents[contents.length - 1];
      if (lastTurn && lastTurn.role === turn.role) {
        lastTurn.parts[0].text += `\n${turn.text.trim()}`;
      } else {
        contents.push({
          role: turn.role,
          parts: [{ text: turn.text.trim() }],
        });
      }
    }

    const lastTurn = contents[contents.length - 1];
    if (lastTurn && lastTurn.role === 'user') {
      lastTurn.parts[0].text += `\n${userText.trim()}`;
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
            description: 'מוסיפה איש מטה, נוהל מטה, SOP או תרחיש לגיליון ממשקי_מטה.',
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
        ],
      },
    ];

    let maxLoopTurns = 3;
    let accumulatedToolResults: string[] = [];

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
      const textResponse = response.text || '';

      if (rawCalls.length === 0) {
        // No more tool calls requested. Return final text output synthesized by Gemini.
        if (accumulatedToolResults.length > 0) {
          const toolSummary = accumulatedToolResults.map((r) => `• ${r}`).join('\n');
          return `*בוצע. הפעולות הבאות עודכנו בגיליון:*\n${toolSummary}\n\n${textResponse}`.trim();
        }
        return textResponse.trim() || 'נקלט.';
      }

      // Process tool calls
      const toolOutputs: any[] = [];
      for (const fc of rawCalls) {
        const callObj: GeminiFunctionCall = {
          name: fc.name,
          args: fc.args || {},
          id: fc.id,
        };
        const resultStr = await toolExecutor(callObj);
        accumulatedToolResults.push(resultStr);
        toolOutputs.push({
          name: fc.name,
          response: { output: resultStr },
        });
      }

      // Append model response & function outputs back into contents loop
      contents.push({
        role: 'model',
        parts: rawCalls.map((fc: any) => ({
          functionCall: { name: fc.name, args: fc.args },
        })),
      });

      contents.push({
        role: 'user',
        parts: toolOutputs.map((to: any) => ({
          functionResponse: { name: to.name, response: to.response },
        })),
      });
    }

    const toolSummary = accumulatedToolResults.map((r) => `• ${r}`).join('\n');
    return `*בוצע. הפעולות הבאות עודכנו בגיליון:*\n${toolSummary}`;
  }
}

export const geminiService = new GeminiService();
