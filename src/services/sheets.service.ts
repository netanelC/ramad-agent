import { google, sheets_v4 } from 'googleapis';
import { config } from '../config/env.js';

export interface TaskItem {
  id: string;
  name: string;
  team: string;
  contacts: string;
  tgbOriginal: string;
  tgbUpdated: string;
  tgbEffective: string;
  rejections: string;
  priority: string;
  attention: string;
  stage: string;
  openDate: string;
  daysOpen: string;
  status: string;
  notes: string;
  isOverdue: boolean;
  isP1: boolean;
}

export interface PersonItem {
  name: string;
  team: string;
  population: string;
  rank: string;
  role: string;
  releaseDate: string;
  horizonStatus: string;
  personalGoal: string;
  lastMeetingDate: string;
  nextMeetingDate: string;
  notes: string;
  isRiskRelease: boolean;
  isRiskMeeting: boolean;
}

export interface SheetOperationResult {
  success: boolean;
  message: string;
}

export class SheetsService {
  private sheets: sheets_v4.Sheets;

  constructor() {
    const auth = new google.auth.GoogleAuth({
      keyFile: config.googleCredentialsPath,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    this.sheets = google.sheets({ version: 'v4', auth });
  }

  public async getLiveTasksContext(): Promise<string> {
    try {
      const res = await this.sheets.spreadsheets.values.get({
        spreadsheetId: config.spreadsheetId,
        range: 'משימות_ותגב!A2:N50',
      });

      const rows = res.data.values || [];
      const todayStr = new Date().toISOString().slice(0, 10);
      const tasks: TaskItem[] = [];

      for (const row of rows) {
        if (!row || row.length < 2) continue;

        const id = (row[0] || '').toString().trim();
        const name = (row[1] || '').toString().trim();
        const status = (row[12] || '').toString().trim();

        if (!id || id === 'מזהה משימה' || status === 'הושלם') {
          continue;
        }

        const team = (row[2] || '').toString().trim();
        const contacts = (row[3] || '').toString().trim();
        const tgbOriginal = (row[4] || '').toString().trim();
        const tgbUpdated = (row[5] || '').toString().trim();
        const tgbEffective = tgbUpdated || tgbOriginal;
        const rejections = (row[6] || '0').toString().trim();
        const priority = (row[7] || '').toString().trim();
        const attention = (row[8] || '').toString().trim();
        const stage = (row[9] || '').toString().trim();
        const openDate = (row[10] || '').toString().trim();
        const daysOpen = (row[11] || '').toString().trim();
        const notes = (row[13] || '').toString().trim();

        const isRejectionsOverdue = parseInt(rejections, 10) > 0;
        const isDateOverdue = Boolean(tgbEffective && tgbEffective < todayStr);
        const isOverdue = isRejectionsOverdue || isDateOverdue;
        const isP1 = priority.toUpperCase().startsWith('P1');

        tasks.push({
          id,
          name,
          team,
          contacts,
          tgbOriginal,
          tgbUpdated,
          tgbEffective,
          rejections,
          priority,
          attention,
          stage,
          openDate,
          daysOpen,
          status,
          notes,
          isOverdue,
          isP1,
        });
      }

      if (tasks.length === 0) {
        return '[תמונת מצב חיה מתוך גיליון משימות_ותגב]: אין כרגע משימות פתוחות בגיליון.';
      }

      tasks.sort((a, b) => {
        const getRank = (t: TaskItem) => {
          if (t.isP1 || t.isOverdue) return 1;
          if (t.priority.toUpperCase().startsWith('P2')) return 2;
          if (t.priority.toUpperCase().startsWith('P3')) return 3;
          return 4;
        };
        return getRank(a) - getRank(b);
      });

      const formattedLines = tasks.map((t) => {
        const overdueTag = t.isOverdue ? ' [חריגת תג"ב!]' : '';
        const tgbStr = t.tgbEffective ? `תג"ב מעודכן: ${t.tgbEffective}` : 'ללא תג"ב';
        const attentionStr = t.attention ? ` | קשב: ${t.attention}` : '';
        const notesStr = t.notes ? ` | הערות: ${t.notes}` : '';

        return `• [מזהה ${t.id}] משימה: "${t.name}" | צוות: ${t.team} | עדיפות: ${t.priority} | ${tgbStr}${attentionStr}${notesStr}${overdueTag}`;
      });

      return `[תמונת מצב חיה מתוך גיליון משימות_ותגב]\nנמצאו ${tasks.length} משימות פתוחות:\n${formattedLines.join('\n')}`;
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error('Error fetching live tasks context from Google Sheets:', errMsg);
      return '[תמונת מצב חיה מתוך גיליון משימות_ותגב]: לא ניתן לשלוק משימות מ-Google Sheets כעת בשל שגיאה.';
    }
  }

  public async getPeopleContext(): Promise<string> {
    try {
      const res = await this.sheets.spreadsheets.values.get({
        spreadsheetId: config.spreadsheetId,
        range: 'אנשים_ופיתוח!A2:O50',
      });

      const rows = res.data.values || [];
      const today = new Date();
      const todayStr = today.toISOString().slice(0, 10);
      const sixMonthsFromNow = new Date();
      sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);
      const sixMonthsStr = sixMonthsFromNow.toISOString().slice(0, 10);

      const peopleAtRisk: PersonItem[] = [];
      const prominentPeople: PersonItem[] = [];

      for (const row of rows) {
        if (!row || row.length < 1) continue;

        const name = (row[0] || '').toString().trim();

        if (!name || name === 'שם החייל/קצין' || name.startsWith('ניהול אנשים')) {
          continue;
        }

        const team = (row[1] || '').toString().trim();
        const population = (row[2] || '').toString().trim();
        const rank = (row[3] || '').toString().trim();
        const role = (row[4] || '').toString().trim();
        const releaseDate = (row[5] || '').toString().trim();
        const horizonStatus = (row[6] || '').toString().trim();
        const personalGoal = (row[7] || '').toString().trim();
        const lastMeetingDate = (row[12] || '').toString().trim();
        const nextMeetingDate = (row[13] || '').toString().trim();
        const notes = (row[14] || '').toString().trim();

        const isRiskRelease = Boolean(
          releaseDate &&
            releaseDate <= sixMonthsStr &&
            (horizonStatus.includes('לא נעשה כלום') || horizonStatus.includes('טרם החל') || !horizonStatus)
        );

        const isRiskMeeting = Boolean(nextMeetingDate && nextMeetingDate < todayStr);

        const personItem: PersonItem = {
          name,
          team,
          population,
          rank,
          role,
          releaseDate,
          horizonStatus,
          personalGoal,
          lastMeetingDate,
          nextMeetingDate,
          notes,
          isRiskRelease,
          isRiskMeeting,
        };

        if (isRiskRelease || isRiskMeeting) {
          peopleAtRisk.push(personItem);
        }

        if (
          notes.includes('הצטיינות') ||
          notes.includes('דמ"ח') ||
          personalGoal.includes('הצטיינות') ||
          population.includes('קבע') ||
          role.includes('רש"צ')
        ) {
          prominentPeople.push(personItem);
        }
      }

      let riskSection = '';
      if (peopleAtRisk.length > 0) {
        const riskLines = peopleAtRisk.map((p) => {
          const reasons: string[] = [];
          if (p.isRiskRelease) reasons.push(`שחרור קרוב (${p.releaseDate}) ללא חפיפה/שימור [סטטוס: ${p.horizonStatus || 'ללא'}]`);
          if (p.isRiskMeeting) reasons.push(`חריגת תאריך מפגש סטטוס (יעד היה: ${p.nextMeetingDate})`);
          return `• [${p.team}] ${p.rank} ${p.name} (${p.role}) | סיכון: ${reasons.join(' | ')}`;
        });
        riskSection = `🚨 משרתים במוקד סיכון (${peopleAtRisk.length}):\n${riskLines.join('\n')}`;
      } else {
        riskSection = '🚨 משרתים במוקד סיכון: אין משרתים במוקד סיכון כעת.';
      }

      let prominentSection = '';
      if (prominentPeople.length > 0) {
        const prominentLines = prominentPeople.map((p) => {
          const detail = p.notes ? ` | הערות/סטטוס: ${p.notes}` : '';
          const goal = p.personalGoal ? ` | יעד: ${p.personalGoal}` : '';
          return `• [${p.team}] ${p.rank} ${p.name} (${p.role})${goal}${detail}`;
        });
        prominentSection = `⭐ סטטוס פיתוח, הצטיינות ודמ"ח (${prominentPeople.length}):\n${prominentLines.join('\n')}`;
      }

      return `[תמונת מצב חיה מתוך גיליון אנשים_ופיתוח]\n${riskSection}\n\n${prominentSection}`.trim();
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error('Error fetching people context from Google Sheets:', errMsg);
      return '[תמונת מצב חיה מתוך גיליון אנשים_ופיתוח]: לא ניתן לשלוק נתוני אנשים כעת בשל שגיאה.';
    }
  }

  public async getSystemContext(): Promise<string> {
    const [tasksContext, peopleContext] = await Promise.all([
      this.getLiveTasksContext(),
      this.getPeopleContext(),
    ]);
    return `${tasksContext}\n\n${peopleContext}`;
  }

  public async closeTask(taskId: string): Promise<SheetOperationResult> {
    try {
      const res = await this.sheets.spreadsheets.values.get({
        spreadsheetId: config.spreadsheetId,
        range: 'משימות_ותגב!A2:N50',
      });

      const rows = res.data.values || [];
      const cleanTargetId = taskId.trim().toLowerCase().replace(/^t-?/, '');

      const rowIndex = rows.findIndex((r) => {
        if (!r || !r[0]) return false;
        const currentId = r[0].toString().trim().toLowerCase().replace(/^t-?/, '');
        return currentId === cleanTargetId;
      });

      if (rowIndex === -1) {
        return { success: false, message: `משימה במזהה "${taskId}" לא נמצאה בגיליון.` };
      }

      const sheetRow = rowIndex + 2;

      await this.sheets.spreadsheets.values.update({
        spreadsheetId: config.spreadsheetId,
        range: `משימות_ותגב!M${sheetRow}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [['הושלם']],
        },
      });

      return { success: true, message: `משימה ${taskId} סומנה כ"הושלם" בגיליון.` };
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error(`Error closing task ${taskId}:`, errMsg);
      return { success: false, message: `שגיאה בסגירת משימה ${taskId}: ${errMsg}` };
    }
  }

  public async postponeTask(taskId: string, newDate: string, reason: string): Promise<SheetOperationResult> {
    try {
      const res = await this.sheets.spreadsheets.values.get({
        spreadsheetId: config.spreadsheetId,
        range: 'משימות_ותגב!A2:N50',
      });

      const rows = res.data.values || [];
      const cleanTargetId = taskId.trim().toLowerCase().replace(/^t-?/, '');

      const rowIndex = rows.findIndex((r) => {
        if (!r || !r[0]) return false;
        const currentId = r[0].toString().trim().toLowerCase().replace(/^t-?/, '');
        return currentId === cleanTargetId;
      });

      if (rowIndex === -1) {
        return { success: false, message: `משימה במזהה "${taskId}" לא נמצאה בגיליון.` };
      }

      const sheetRow = rowIndex + 2;
      const targetRow = rows[rowIndex] || [];

      const currentRejections = parseInt((targetRow[6] || '0').toString().trim(), 10) || 0;
      const newRejections = (currentRejections + 1).toString();
      const currentNotes = (targetRow[13] || '').toString().trim();
      const todayStr = new Date().toISOString().slice(0, 10);
      const newLog = `[${todayStr}]: נדחה ל-${newDate}. נימוק: ${reason}`;
      const updatedNotes = currentNotes ? `${currentNotes}\n${newLog}` : newLog;

      // Update תג"ב מעודכן (Column F)
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: config.spreadsheetId,
        range: `משימות_ותגב!F${sheetRow}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [[newDate]] },
      });

      // Update מונה דחיות (Column G)
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: config.spreadsheetId,
        range: `משימות_ותגב!G${sheetRow}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [[newRejections]] },
      });

      // Update הערות וסיבת דחייה (Column N)
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: config.spreadsheetId,
        range: `משימות_ותגב!N${sheetRow}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [[updatedNotes]] },
      });

      return {
        success: true,
        message: `תג"ב משימה ${taskId} עודכן ל-${newDate}. מונה דחיות: ${newRejections}. נימוק: ${reason}`,
      };
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error(`Error postponing task ${taskId}:`, errMsg);
      return { success: false, message: `שגיאה בדחיית משימה ${taskId}: ${errMsg}` };
    }
  }

  public async updateTaskPriority(taskId: string, newPriority: string): Promise<SheetOperationResult> {
    try {
      const res = await this.sheets.spreadsheets.values.get({
        spreadsheetId: config.spreadsheetId,
        range: 'משימות_ותגב!A2:N50',
      });

      const rows = res.data.values || [];
      const cleanTargetId = taskId.trim().toLowerCase().replace(/^t-?/, '');

      const rowIndex = rows.findIndex((r) => {
        if (!r || !r[0]) return false;
        const currentId = r[0].toString().trim().toLowerCase().replace(/^t-?/, '');
        return currentId === cleanTargetId;
      });

      if (rowIndex === -1) {
        return { success: false, message: `משימה במזהה "${taskId}" לא נמצאה בגיליון.` };
      }

      const sheetRow = rowIndex + 2;
      let formattedPriority = newPriority;

      if (newPriority.toUpperCase() === 'P1') {
        formattedPriority = 'P1 - קריטי/צוואר בקבוק';
      } else if (newPriority.toUpperCase() === 'P2') {
        formattedPriority = 'P2 - חשוב/דחוף';
      } else if (newPriority.toUpperCase() === 'P3') {
        formattedPriority = 'P3 - שגרתי';
      }

      // Update עדיפות (Column H)
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: config.spreadsheetId,
        range: `משימות_ותגב!H${sheetRow}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [[formattedPriority]] },
      });

      return { success: true, message: `עדיפות משימה ${taskId} עודכנה ל-${formattedPriority}.` };
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error(`Error updating priority for task ${taskId}:`, errMsg);
      return { success: false, message: `שגיאה בעדכון עדיפות משימה ${taskId}: ${errMsg}` };
    }
  }

  public async appendDraftTask(taskText: string): Promise<void> {
    try {
      await this.sheets.spreadsheets.values.append({
        spreadsheetId: config.spreadsheetId,
        range: 'אינבוקס_טיוטות!A:F',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [
            [
              `D-${Date.now().toString().slice(-4)}`,
              taskText,
              new Date().toISOString().replace('T', ' ').slice(0, 16),
              'טרם זוהה',
              'חסר תג"ב/עדיפות',
              'ממתין לאפייה',
            ],
          ],
        },
      });
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error('Failed to append to Google Sheets:', error.message);
      } else {
        console.error('Failed to append to Google Sheets:', error);
      }
    }
  }
}

export const sheetsService = new SheetsService();
