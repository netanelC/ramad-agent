import { GoogleGenAI, Type } from '@google/genai';
import fs from 'fs';
import path from 'path';
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

  public async generateAgentResponse(
    userText: string,
    liveSystemContext?: string
  ): Promise<AgentResponseResult> {
    const context = liveSystemContext ?? (await sheetsService.getSystemContext());
    const doctrineText = loadDoctrineContent();

    const doctrineSection = doctrineText
      ? `[עקרונות התפיסה הפיקודית של הרמ"ד (מתוך doctrine.md)]\n${doctrineText}`
      : '[עקרונות התפיסה הפיקודית של הרמ"ד (מתוך doctrine.md)]:\n(מסמך התפיסה הפיקודית לא נמצא, פועל לפי הנחיות ברירת מחדל).';

    const response = await this.executeGenerateContent({
      config: {
        thinkingConfig: { thinkingBudget: 0 },
        systemInstruction: `
אתה סוכן ניהול וביקורת אישי של רמ"ד במדור טכנולוגי-מבצעי (5 צוותים: טטריס, קסבה, טקסס, ברוקלין, ארמורי).
אתה שותף ביקורתי, אסרטיבי וחד – לא יס-מן.

תפקידך לשמש כמראה פיקודית המבוססת על עקרונות ה-doctrine.md של הרמ"ד. בכל המלצה, תעדוף או ביקורת – שפוט את המצב דרך עקרונות הדוקטרינה שלו, ושים לב במיוחד לנקודות התורפה וההרגלים המעכבים הידועים עליו מתוך גיליון הזיכרון (כגון מריחת משימות בירוקרטיה או התחמקות משיחות 1-על-1).

${doctrineSection}

${context}

כללים לפעולה ומענה:
1. מענה על משימות ואנשים: עמודת 'שלב עבודה' היא מקור האמת היחיד להתקדמות (אין עמודת סטטוס). כשהרמ"ד שואל על משימות, תעדוף, אנשים בסיכון, שחרורים או מפגשי סטטוס – ענה תמיד בהתבסס אך ורק על הנתונים החיים מתוך הגיליונות שלמעלה ועקרונות ה-doctrine.md.
   - סדר מענה חובה: ראשית משימות P1 וחריגות תג"ב, שנית משימות קשב עמוק, ולבסוף משימות P2/P3.
   - התייחסות לאנשים: הדגש משרתים בסיכון שחרור קרוב (<6 חודשים) שטרם החלו חפיפה ומפגשים שחורגים מהיעד.
2. עדכון משימות, ניתוח דפוסים וכלים (Function Calling / Tool Use):
   - כאשר הרמ"ד מודיע שמשימה הסתיימה/בוצעה (למשל 'משימה 10 בוצעה') או מבקש לסגור משימה -> הפעל את הכלי close_task(taskId) לכל משימה. הכלי מעדכן את 'שלב עבודה' ל-"הושלם", מעביר אותה אוטומטית לארכיון_משימות ומוחק אותה מרשימת המשימות הפתוחות.
   - אם הרמ"ד מבקש לשנות עדיפות משימה -> הפעל את הכלי update_task_priority(taskId, newPriority).
   - אם הרמ"ד מבקש לדחות משימה: **אל תדחה מיד!** התעמת איתו ושאל מה הבלוקר האמיתי. הפעל את הכלי postpone_task(taskId, newDate, reason) **רק לאחר שהתקבל נימוק מבצעי משכנע!** אם לא התקבל נימוק מבצעי הגיוני, סרב לדחות, הצב שאלת מראה ודרוש הסבר.
   - כאשר מתבצע תהליך אפיית טיוטות (או שהרמ"ד מספק פרטי אפייה לטיוטה) -> הפעל את הכלי bake_draft(draftId, taskTitle, team, tgb, priority).
   - אם מצאת דפוס חוזר מובהק חדש (דחיינות מול תחום מסוים, הזנחת צוות שקט, מריחת משימות עומק או שיפור משמעותי) בעת ניתוח משימות ארכיון ומשימות פתוחות, או כשהרמ"ד מבקש לנתח דפוסים -> הפעל את הכלי save_memory_insight(domain, patternType, description, impact, recommendation) כדי לממשו ולתעדו בגיליון זיכרון_רמד.
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
                description: 'מעדכן את עמודת שלב עבודה ל-"הושלם", מעביר מגיליון משימות_ותגב לגיליון ארכיון_משימות ומוחק אותה מרשימת המשימות הפתוחות.',
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
              {
                name: 'bake_draft',
                description: 'אופה טיוטה מאינבוקס_טיוטות למשימה חדשה בגיליון משימות_ותגב עם כותרת, צוות, תג"ב ועדיפות.',
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    draftId: {
                      type: Type.STRING,
                      description: 'מזהה הטיוטה באינבוקס (למשל D-8238)',
                    },
                    taskTitle: {
                      type: Type.STRING,
                      description: 'כותרת המשימה החדשה',
                    },
                    team: {
                      type: Type.STRING,
                      description: 'שם הצוות (טטריס, קסבה, טקסס, ברוקלין, ארמורי, או רוחבי)',
                    },
                    tgb: {
                      type: Type.STRING,
                      description: 'תג"ב בפורמט YYYY-MM-DD',
                    },
                    priority: {
                      type: Type.STRING,
                      description: 'עדיפות המשימה (P1 / P2 / P3)',
                      enum: ['P1', 'P2', 'P3'],
                    },
                  },
                  required: ['draftId', 'taskTitle', 'team', 'tgb', 'priority'],
                },
              },
              {
                name: 'save_memory_insight',
                description: 'שומרת תובנת דפוס/הרגל חוזר חדש על הרמ"ד בגיליון זיכרון_רמד.',
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    domain: {
                      type: Type.STRING,
                      description: 'התחום (למשל "בירוקרטיה ות"ש", "משימות עומק", "שיחות 1-על-1", "חפיפות ושימור")',
                    },
                    patternType: {
                      type: Type.STRING,
                      description: 'סוג תבנית/נקודת תורפה (למשל "דחיינות משימות מטה", "שיפור בתג"ב")',
                    },
                    description: {
                      type: Type.STRING,
                      description: 'תיאור הדפוס והראיות מהשטח',
                    },
                    impact: {
                      type: Type.STRING,
                      description: 'השפעה על המדור ונקודת תורפה',
                    },
                    recommendation: {
                      type: Type.STRING,
                      description: 'שאלת מראה / המלצה לפעולה',
                    },
                  },
                  required: ['domain', 'patternType', 'description', 'impact', 'recommendation'],
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
}

export const geminiService = new GeminiService();
