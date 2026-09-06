import { GoogleGenAI, Type } from '@google/genai';
import { config } from '../config/env.js';
import { sheetsService } from './sheets.service.js';

export interface GeminiFunctionCall {
  name: string;
  args: Record<string, any>;
  id?: string;
}

export interface AgentResponseResult {
  text?: string;
  functionCalls?: GeminiFunctionCall[];
}

export class GeminiService {
  private ai: GoogleGenAI;
  private fallbackModels: string[] = ['gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-2.5-flash', 'gemini-2.0-flash'];

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: config.geminiApiKey });
  }

  private async executeGenerateContent(options: Record<string, any>): Promise<any> {
    let lastError: unknown;

    for (let attempt = 0; attempt < this.fallbackModels.length; attempt++) {
      const modelName = this.fallbackModels[attempt] || 'gemini-3.6-flash';
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

        // Wait 500ms before retrying with fallback model
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    throw lastError;
  }

  public async generateAgentResponse(
    userText: string,
    liveSystemContext?: string
  ): Promise<AgentResponseResult> {
    const context = liveSystemContext ?? (await sheetsService.getSystemContext());

    const response = await this.executeGenerateContent({
      config: {
        systemInstruction: `
אתה סוכן ניהול וביקורת אישי של רמ"ד במדור טכנולוגי-מבצעי (5 צוותים: טטריס, קסבה, טקסס, ברוקלין, ארמורי).
אתה שותף ביקורתי, אסרטיבי וחד – לא יס-מן.

${context}

כללים לפעולה ומענה:
1. מענה על משימות ואנשים: כשהרמ"ד שואל על משימות, תעדוף, אנשים בסיכון, שחרורים או מפגשי סטטוס – ענה תמיד בהתבסס אך ורק על הנתונים החיים מתוך הגיליונות שלמעלה.
   - סדר מענה חובה: ראשית משימות P1 וחריגות תג"ב, שנית משימות קשב עמוק, ולבסוף משימות P2/P3.
   - התייחסות לאנשים: הדגש משרתים בסיכון שחרור קרוב (<6 חודשים) שטרם החלו חפיפה ומפגשים שחורגים מהיעד.
2. עדכון משימות וכלים (Function Calling / Tool Use):
   - אם הרמ"ד מבקש לסגור משימה / לסמן כמבוצעת -> הפעל את הכלי close_task(taskId).
   - אם הרמ"ד מבקש לשנות עדיפות משימה -> הפעל את הכלי update_task_priority(taskId, newPriority).
   - אם הרמ"ד מבקש לדחות משימה: **אל תדחה מיד!** התעמת איתו ושאל מה הבלוקר האמיתי. הפעל את הכלי postpone_task(taskId, newDate, reason) **רק לאחר שהתקבל נימוק מבצעי משכנע!**
3. קליטה חטופה: אם הרמ"ד שולח משימה חדשה חטופה/חלקית ללא פרטים, השב שהיא נקלטה באינבוקס טיוטות ("נקלט באינבוקס טיוטות", והיא תיאפה ב-17:30).
4. שפה, סגנון ופורמט:
   - דבר תמיד בעברית ישירה, עניינית, קצרה ומותאמת ל-WhatsApp.
   - השתמש בהדגשות WhatsApp עם כוכבית יחידה (כגון *טקסט מודגש*).
`,
        tools: [
          {
            functionDeclarations: [
              {
                name: 'close_task',
                description: 'משנה את סטטוס המשימה ל-"הושלם" בגיליון משימות_ותגב.',
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    taskId: {
                      type: Type.STRING,
                      description: 'מזהה המשימה בגיליון (למשל "2" או "T-101")',
                    },
                  },
                  required: ['taskId'],
                },
              },
              {
                name: 'postpone_task',
                description: 'מעדכן את התג"ב המעודכן, מעלה את מונה הדחיות ב-1 ורושם נימוק דחייה בגיליון. יש להפעיל פונקציה זו רק אם הרמ"ד סיפק נימוק מבצעי משכנע!',
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    taskId: {
                      type: Type.STRING,
                      description: 'מזהה המשימה (למשל "2")',
                    },
                    newDate: {
                      type: Type.STRING,
                      description: 'התאריך החדש לתג"ב בפורמט YYYY-MM-DD',
                    },
                    reason: {
                      type: Type.STRING,
                      description: 'הנימוק המבצעי לדחייה',
                    },
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
                    taskId: {
                      type: Type.STRING,
                      description: 'מזהה המשימה (למשל "2")',
                    },
                    newPriority: {
                      type: Type.STRING,
                      description: 'העדיפות החדשה: P1, P2, או P3',
                      enum: ['P1', 'P2', 'P3'],
                    },
                  },
                  required: ['taskId', 'newPriority'],
                },
              },
            ],
          },
        ],
      },
      contents: userText,
    });

    const rawFunctionCalls = response.functionCalls || [];
    const functionCalls: GeminiFunctionCall[] = rawFunctionCalls.map((fc: any) => ({
      name: fc.name,
      args: fc.args || {},
      id: fc.id,
    }));

    const result: AgentResponseResult = {};
    if (response.text) {
      result.text = response.text;
    }
    if (functionCalls.length > 0) {
      result.functionCalls = functionCalls;
    }

    return result;
  }

  public async sendFunctionResponse(
    userText: string,
    functionName: string,
    functionArgs: Record<string, any>,
    functionResult: { success: boolean; message: string },
    liveSystemContext?: string
  ): Promise<string> {
    const contents = [
      { role: 'user', parts: [{ text: userText }] },
      {
        role: 'model',
        parts: [
          {
            functionCall: {
              name: functionName,
              args: functionArgs,
            },
          },
        ],
      },
      {
        role: 'user',
        parts: [
          {
            functionResponse: {
              name: functionName,
              response: functionResult,
            },
          },
        ],
      },
    ];

    const response = await this.executeGenerateContent({
      config: {
        systemInstruction: `
אתה סוכן ניהול וביקורת אישי של רמ"ד.
אישור ביצוע עדכון בגיליון: ${functionResult.message}

השב בקצרה, בעברית ישירה וחדה המותאמת ל-WhatsApp, המאשרת שהעדכון בוצע בגיליון. השתמש בהדגשות כוכבית יחידה (*טקסט*).
`,
      },
      contents,
    });

    return response.text || functionResult.message;
  }
}

export const geminiService = new GeminiService();
