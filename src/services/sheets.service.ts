import { google, sheets_v4 } from 'googleapis';
import { config } from '../config/env.js';
import { logger } from '../common/logger.js';

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
  tash?: string;
  naat?: string;
  releaseDate: string;
  horizonStatus: string;
  personalGoal: string;
  subGoal1?: string;
  subGoal1Tgb?: string;
  subGoal2?: string;
  subGoal2Tgb?: string;
  lastMeetingDate: string;
  nextMeetingDate: string;
  goalProgressStatus?: string;
  degreeStatus?: string;
  academicInstitution?: string;
  degreeExpectedEnd?: string;
  dmhStatus?: string;
  excellenceStatus?: string;
  ceremonyDateOrNotes?: string;
  notes: string;
  isRiskRelease: boolean;
  isRiskMeeting: boolean;
}

export interface MemoryInsightItem {
  id: string;
  date: string;
  domain: string;
  patternType: string;
  patternDescription: string;
  impact: string;
  mirrorQuestion: string;
  status: string;
  lastReviewDate: string;
}

export interface StaffInterfaceItem {
  domain: string;
  roleAndContact: string;
  responsibilities: string;
  sop: string;
  channel?: string;
  notes?: string;
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

  // ==========================================
  // GENERIC DYNAMIC SHEETS ENGINE (HEADER-BASED)
  // ==========================================

  private colIndexToLetter(index: number): string {
    let temp = index;
    let letter = '';
    while (temp >= 0) {
      letter = String.fromCharCode((temp % 26) + 65) + letter;
      temp = Math.floor(temp / 26) - 1;
    }
    return letter;
  }

  /**
   * Generic Engine Function 1: Appends a row of data by dynamically matching keys in `rowData`
   * against the sheet's actual column headers.
   */
  public async appendRowByHeaders(
    sheetName: string,
    rowData: Record<string, unknown>,
    headerRowIndex: number = 1
  ): Promise<void> {
    try {
      const range = `${sheetName}!A${headerRowIndex}:Z${headerRowIndex}`;
      const headerRes = await this.sheets.spreadsheets.values.get({
        spreadsheetId: config.spreadsheetId,
        range,
      });

      const headers: string[] = (headerRes.data.values?.[0] || []).map((h) =>
        (h || '').toString().trim()
      );

      if (headers.length === 0) {
        throw new Error(`Could not find header row for sheet "${sheetName}" at row ${headerRowIndex}`);
      }

      const rowValues: unknown[] = headers.map((header) => {
        if (Object.prototype.hasOwnProperty.call(rowData, header)) {
          return rowData[header];
        }

        const cleanHeader = header.toLowerCase();
        for (const [key, val] of Object.entries(rowData)) {
          const cleanKey = key.toLowerCase();
          if (
            cleanKey === cleanHeader ||
            (cleanHeader.includes('מזהה') && cleanKey.includes('id')) ||
            (cleanHeader.includes('משימה') && cleanKey.includes('task')) ||
            (cleanHeader.includes('צוות') && cleanKey.includes('team')) ||
            (cleanHeader.includes('תג"ב') && cleanKey.includes('tgb')) ||
            (cleanHeader.includes('עדיפות') && cleanKey.includes('priority')) ||
            (cleanHeader.includes('שלב') && cleanKey.includes('stage')) ||
            (cleanHeader.includes('סטטוס') && cleanKey.includes('status')) ||
            (cleanHeader.includes('הערות') && cleanKey.includes('note')) ||
            (cleanHeader.includes('תאריך') && cleanKey.includes('date'))
          ) {
            return val;
          }
        }

        return '';
      });

      await this.sheets.spreadsheets.values.append({
        spreadsheetId: config.spreadsheetId,
        range: `${sheetName}!A:Z`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [rowValues],
        },
      });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      logger.error({ err, sheetName }, `Error in appendRowByHeaders for sheet "${sheetName}": ${errMsg}`);
      throw err;
    }
  }

  /**
   * Generic Engine Function 2: Updates a single cell specified by row ID and target column header.
   */
  public async updateCellByHeader(
    sheetName: string,
    idColumnHeader: string,
    idValue: string,
    targetHeader: string,
    newValue: unknown,
    headerRowIndex: number = 1
  ): Promise<boolean> {
    try {
      const res = await this.sheets.spreadsheets.values.get({
        spreadsheetId: config.spreadsheetId,
        range: `${sheetName}!A1:Z100`,
      });

      const rows = res.data.values || [];
      if (rows.length < headerRowIndex) return false;

      const headers: string[] = (rows[headerRowIndex - 1] || []).map((h) =>
        (h || '').toString().trim()
      );

      const cleanIdHeader = idColumnHeader.toLowerCase();
      const idColIndex = headers.findIndex(
        (h) =>
          h.toLowerCase() === cleanIdHeader ||
          h.toLowerCase().includes(cleanIdHeader) ||
          cleanIdHeader.includes(h.toLowerCase())
      );

      const cleanTargetHeader = targetHeader.toLowerCase();
      const targetColIndex = headers.findIndex(
        (h) =>
          h.toLowerCase() === cleanTargetHeader ||
          h.toLowerCase().includes(cleanTargetHeader) ||
          cleanTargetHeader.includes(h.toLowerCase())
      );

      if (idColIndex === -1 || targetColIndex === -1) {
        logger.warn(
          { sheetName, idColIndex, targetColIndex },
          `updateCellByHeader: Column headers not found in "${sheetName}"`
        );
        return false;
      }

      const cleanTargetId = idValue.trim().toLowerCase().replace(/^t-?/, '');

      for (let r = headerRowIndex; r < rows.length; r++) {
        const row = rows[r];
        if (!row || row.length <= idColIndex) continue;

        const cellId = (row[idColIndex] || '').toString().trim().toLowerCase().replace(/^t-?/, '');

        if (cellId === cleanTargetId) {
          const sheetRow = r + 1;
          const colLetter = this.colIndexToLetter(targetColIndex);
          const cellRange = `${sheetName}!${colLetter}${sheetRow}`;

          await this.sheets.spreadsheets.values.update({
            spreadsheetId: config.spreadsheetId,
            range: cellRange,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
              values: [[newValue]],
            },
          });

          return true;
        }
      }

      return false;
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      logger.error({ err, sheetName }, `Error in updateCellByHeader for sheet "${sheetName}": ${errMsg}`);
      return false;
    }
  }

  // ==========================================
  public async ensureSheetExists(sheetName: string, defaultHeaders?: string[]): Promise<void> {
    try {
      const res = await this.sheets.spreadsheets.get({
        spreadsheetId: config.spreadsheetId,
      });

      const exists = res.data.sheets?.some(
        (s) => s.properties?.title === sheetName
      );

      if (!exists) {
        await this.sheets.spreadsheets.batchUpdate({
          spreadsheetId: config.spreadsheetId,
          requestBody: {
            requests: [
              {
                addSheet: {
                  properties: { title: sheetName },
                },
              },
            ],
          },
        });

        if (defaultHeaders && defaultHeaders.length > 0) {
          const endLetter = this.colIndexToLetter(defaultHeaders.length - 1);
          await this.sheets.spreadsheets.values.update({
            spreadsheetId: config.spreadsheetId,
            range: `${sheetName}!A1:${endLetter}1`,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
              values: [defaultHeaders],
            },
          });
        }
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      logger.warn({ err, sheetName }, `Could not ensure sheet tab "${sheetName}" exists: ${errMsg}`);
    }
  }

  private async ensureArchiveSheetExists(): Promise<void> {
    try {
      const res = await this.sheets.spreadsheets.get({
        spreadsheetId: config.spreadsheetId,
      });

      const exists = res.data.sheets?.some(
        (s) => s.properties?.title === 'ארכיון_משימות'
      );

      if (!exists) {
        await this.sheets.spreadsheets.batchUpdate({
          spreadsheetId: config.spreadsheetId,
          requestBody: {
            requests: [
              {
                addSheet: {
                  properties: { title: 'ארכיון_משימות' },
                },
              },
            ],
          },
        });

        await this.sheets.spreadsheets.values.update({
          spreadsheetId: config.spreadsheetId,
          range: 'ארכיון_משימות!A1:N1',
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [
              [
                'מזהה משימה',
                'משימה',
                'צוות',
                'אנשי קשר וגורמי חוץ',
                'תג"ב מקורי',
                'תג"ב מעודכן',
                'מונה דחיות',
                'עדיפות',
                'רמת קשב וזמן עבודה',
                'שלב עבודה',
                'תאריך פתיחה',
                'ימים פתוחה',
                'הערות וסיבת דחייה',
                'תאריך ושעת העברה לארכיון',
              ],
            ],
          },
        });
      }
    } catch (err: unknown) {
      logger.error({ err }, 'Error ensuring archive sheet tab exists');
    }
  }

  // ==========================================
  // CONTEXT FETCHERS WITH FEW-SHOT EXAMPLES
  // ==========================================

  public async getLiveTasksContext(): Promise<string> {
    try {
      const res = await this.sheets.spreadsheets.values.get({
        spreadsheetId: config.spreadsheetId,
        range: 'משימות_ותגב!A4:M100',
      });

      const rows = res.data.values || [];
      const tasks: TaskItem[] = [];

      for (const row of rows) {
        if (!row || row.length < 2) continue;

        const id = (row[0] || '').toString().trim();
        const name = (row[1] || '').toString().trim();
        if (!id || !name || id === 'מזהה משימה') continue;

        const team = (row[2] || '').toString().trim();
        const contacts = (row[3] || '').toString().trim();
        const tgbOriginal = (row[4] || '').toString().trim();
        const tgbUpdated = (row[5] || '').toString().trim();
        const rejections = (row[6] || '0').toString().trim();
        const priority = (row[7] || '').toString().trim();
        const attention = (row[8] || '').toString().trim();
        const stage = (row[9] || '').toString().trim();
        const openDate = (row[10] || '').toString().trim();
        const daysOpen = (row[11] || '').toString().trim();
        const notes = (row[12] || '').toString().trim();
        const status = stage || 'פתוח';

        if (stage === 'הושלם' || stage === 'מבוטל') {
          continue;
        }

        const tgbEffective = tgbUpdated || tgbOriginal;
        let isOverdue = false;
        if (tgbEffective && /^\d{4}-\d{2}-\d{2}$/.test(tgbEffective)) {
          const tgbDate = new Date(tgbEffective);
          const now = new Date();
          now.setHours(0, 0, 0, 0);
          isOverdue = tgbDate < now;
        }

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

      const headerSchema = `[כותרות גיליון משימות_ותגב: מזהה משימה | משימה | צוות | אנשי קשר וגורמי חוץ | תג"ב מקורי | תג"ב מעודכן | מונה דחיות | עדיפות | רמת קשב וזמן עבודה | שלב עבודה | תאריך פתיחה | ימים פתוחה | הערות וסיבת דחייה]`;

      if (tasks.length === 0) {
        return `[תמונת מצב חיה מתוך גיליון משימות_ותגב]\n${headerSchema}\nאין כרגע משימות פתוחות.`;
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

      const sampleTask = tasks[0];
      const outputGuidance = `[הנחיית עיצוב חובה לוואטסאפ: כברירת מחדל בהצגת משימות או מיקוד יומי לרמ"ד, אין להציג מזהה משימה (ללא [מזהה X]) ואין לציין רמת עדיפות (ללא P1/P2/P3/עדיפות), אלא אם כן הרמ"ד ביקש זאת במפורש. יש להציג בצורה נקייה ופשוטה: שם המשימה, הצוות, ותג"ב בלבד].`;
      const fewShotSample = sampleTask
        ? `[דוגמה לרשומה בגיליון]: משימה "${sampleTask.name}" | צוות: ${sampleTask.team} | תג"ב: ${sampleTask.tgbEffective || 'ללא'} (מזהה פנימי: ${sampleTask.id}, עדיפות פנימית: ${sampleTask.priority})`
        : '';

      const formattedLines = tasks.map((t) => {
        const overdueTag = t.isOverdue ? ' [חריגת תג"ב!]' : '';
        const tgbStr = t.tgbEffective ? `תג"ב מעודכן: ${t.tgbEffective}` : 'ללא תג"ב';
        const attentionStr = t.attention ? ` | קשב: ${t.attention}` : '';
        const notesStr = t.notes ? ` | הערות: ${t.notes}` : '';

        return `• [מזהה ${t.id}] משימה: "${t.name}" | צוות: ${t.team} | עדיפות: ${t.priority} | ${tgbStr}${attentionStr}${notesStr}${overdueTag}`;
      });

      return `[תמונת מצב חיה מתוך גיליון משימות_ותגב]\n${headerSchema}\n${outputGuidance}\n${fewShotSample}\n\nנמצאו ${tasks.length} משימות פתוחות:\n${formattedLines.join('\n')}`;
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.error({ err: error }, 'Error fetching live tasks context from Google Sheets');
      return '[תמונת מצב חיה מתוך גיליון משימות_ותגב]: לא ניתן לשלוק משימות כעת בשל שגיאה.';
    }
  }

  public async getArchivedTasksContext(): Promise<string> {
    try {
      await this.ensureArchiveSheetExists();
      const res = await this.sheets.spreadsheets.values.get({
        spreadsheetId: config.spreadsheetId,
        range: 'ארכיון_משימות!A2:N50',
      });

      const rows = res.data.values || [];
      const archived: Array<{ id: string; name: string; team: string; notes: string }> = [];

      for (const row of rows) {
        if (!row || row.length < 2) continue;
        const id = (row[0] || '').toString().trim();
        const name = (row[1] || '').toString().trim();
        if (!id || id === 'מזהה משימה') continue;

        archived.push({
          id,
          name,
          team: (row[2] || '').toString().trim(),
          notes: (row[12] || '').toString().trim(),
        });
      }

      const headerSchema = `[כותרות גיליון ארכיון_משימות: מזהה משימה | משימה | צוות | אנשי קשר | תג"ב מקורי | תג"ב מעודכן | מונה דחיות | עדיפות | רמת קשב | שלב עבודה | תאריך פתיחה | ימים פתוחה | הערות וסיבת דחייה | תאריך העברה לארכיון]`;

      if (archived.length === 0) {
        return `[ארכיון משימות שהושלמו (מתוך ארכיון_משימות)]\n${headerSchema}\nאין כרגע משימות בארכיון.`;
      }

      const sampleArchive = archived[0];
      const fewShotSample = sampleArchive
        ? `[דוגמה לרשומה קיימת (Few-Shot Example)]: • [מזהה ${sampleArchive.id}] "${sampleArchive.name}" | צוות: ${sampleArchive.team} | הערות: ${sampleArchive.notes}`
        : '';

      const lines = archived.map(
        (a) => `• [מזהה ${a.id}] "${a.name}" | צוות: ${a.team} | ${a.notes}`
      );
      return `[ארכיון משימות שהושלמו (מתוך ארכיון_משימות)]\n${headerSchema}\n${fewShotSample}\n\nנמצאו ${archived.length} משימות שהושלמו:\n${lines.join('\n')}`;
    } catch (error: unknown) {
      logger.error({ err: error }, 'Error fetching archived tasks context from Google Sheets');
      return '';
    }
  }

  public async getPeopleContext(): Promise<string> {
    try {
      const res = await this.sheets.spreadsheets.values.get({
        spreadsheetId: config.spreadsheetId,
        range: 'אנשים_ופיתוח!A4:X60',
      });

      const rows = res.data.values || [];
      const today = new Date();
      const todayStr = today.toISOString().slice(0, 10);
      const sixMonthsFromNow = new Date();
      sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);
      const sixMonthsStr = sixMonthsFromNow.toISOString().slice(0, 10);

      const allPeopleLines: string[] = [];
      const peopleAtRisk: PersonItem[] = [];

      for (const row of rows) {
        if (!row || row.length < 1) continue;

        const name = (row[0] || '').toString().trim();

        if (!name || name === 'שם החייל' || name === 'שם החייל/קצין' || name.startsWith('ניהול אנשים')) {
          continue;
        }

        const team = (row[1] || '').toString().trim();
        const population = (row[2] || '').toString().trim();
        const rank = (row[3] || '').toString().trim();
        const role = (row[4] || '').toString().trim();
        const tash = (row[5] || '').toString().trim();
        const naat = (row[6] || '').toString().trim();
        const releaseDate = (row[7] || '').toString().trim();
        const horizonStatus = (row[8] || '').toString().trim();
        const personalGoal = (row[9] || '').toString().trim();
        const subGoal1 = (row[10] || '').toString().trim();
        const subGoal1Tgb = (row[11] || '').toString().trim();
        const subGoal2 = (row[12] || '').toString().trim();
        const subGoal2Tgb = (row[13] || '').toString().trim();
        const lastMeetingDate = (row[14] || '').toString().trim();
        const nextMeetingDate = (row[15] || '').toString().trim();
        const goalProgressStatus = (row[16] || '').toString().trim();
        const degreeStatus = (row[17] || '').toString().trim();
        const academicInstitution = (row[18] || '').toString().trim();
        const degreeExpectedEnd = (row[19] || '').toString().trim();
        const dmhStatus = (row[20] || '').toString().trim();
        const excellenceStatus = (row[21] || '').toString().trim();
        const ceremonyDateOrNotes = (row[22] || '').toString().trim();
        const notes = (row[23] || '').toString().trim();

        const extraDetails: string[] = [];
        if (releaseDate) extraDetails.push(`שחרור/סיום: ${releaseDate}`);
        if (horizonStatus) extraDetails.push(`אופק/שימור: ${horizonStatus}`);
        if (personalGoal) extraDetails.push(`יעד אישי: ${personalGoal}${goalProgressStatus ? ` (${goalProgressStatus})` : ''}`);
        if (subGoal1) extraDetails.push(`מטרת משנה 1: ${subGoal1}${subGoal1Tgb ? ` [תג"ב: ${subGoal1Tgb}]` : ''}`);
        if (subGoal2) extraDetails.push(`מטרת משנה 2: ${subGoal2}${subGoal2Tgb ? ` [תג"ב: ${subGoal2Tgb}]` : ''}`);
        if (lastMeetingDate) extraDetails.push(`מפגש אחרון: ${lastMeetingDate}`);
        if (nextMeetingDate) extraDetails.push(`יעד מפגש הבא: ${nextMeetingDate}`);
        if (tash) extraDetails.push(`ת"ש/מעמד: ${tash}`);
        if (naat) extraDetails.push(`נע"ת: ${naat}`);
        if (degreeStatus || academicInstitution) {
          extraDetails.push(`תואר: ${degreeStatus || ''} ${academicInstitution ? `(${academicInstitution})` : ''}${degreeExpectedEnd ? ` [צפי: ${degreeExpectedEnd}]` : ''}`.trim());
        }
        if (dmhStatus) extraDetails.push(`דמ"ח: ${dmhStatus}`);
        if (excellenceStatus) extraDetails.push(`הצטיינות: ${excellenceStatus}${ceremonyDateOrNotes ? ` (${ceremonyDateOrNotes})` : ''}`);
        if (notes) extraDetails.push(`הערות: ${notes}`);

        const extraStr = extraDetails.length > 0 ? ` | ${extraDetails.join(' | ')}` : '';
        const personLine = `• ${name} | צוות: ${team || 'ללא'} | דרגה: ${rank || 'ללא'} | תפקיד: ${role || 'ללא'} | אוכלוסייה: ${population || 'ללא'}${extraStr}`;
        allPeopleLines.push(personLine);

        const isRiskRelease = Boolean(
          releaseDate &&
            releaseDate <= sixMonthsStr &&
            (horizonStatus.includes('לא נעשה כלום') || horizonStatus.includes('טרם החל') || !horizonStatus)
        );

        const isRiskMeeting = Boolean(nextMeetingDate && nextMeetingDate < todayStr);

        if (isRiskRelease || isRiskMeeting) {
          peopleAtRisk.push({
            name,
            team,
            population,
            rank,
            role,
            tash,
            naat,
            releaseDate,
            horizonStatus,
            personalGoal,
            subGoal1,
            subGoal1Tgb,
            subGoal2,
            subGoal2Tgb,
            lastMeetingDate,
            nextMeetingDate,
            goalProgressStatus,
            degreeStatus,
            academicInstitution,
            degreeExpectedEnd,
            dmhStatus,
            excellenceStatus,
            ceremonyDateOrNotes,
            notes,
            isRiskRelease,
            isRiskMeeting,
          });
        }
      }

      const headerSchema = `[כותרות גיליון אנשים_ופיתוח: שם החייל | צוות | סוג אוכלוסייה | דרגה | תפקיד | התאמות ת״ש / מעמד מיוחד | נע"ת | תאריך שחרור/סיום | סטטוס אופק שירות / שימור | יעד אישי | מטרת משנה 1 | תג"ב - מטרת משנה 1 | מטרת משנה 2 | תג"ב - מטרת משנה 2 | תאריך מפגש סטטוס אחרון | תאריך יעד למפגש הבא | סטטוס התקדמות ביעד | סטטוס תואר | מוסד ותחום לימוד | צפי סיום תואר | סטטוס דמ"ח | סטטוס הצטיינות והוקרה | מועד טקס / הערות הצטיינות | הערות]`;

      if (allPeopleLines.length === 0) {
        return `[תמונת מצב חיה מתוך גיליון אנשים_ופיתוח]\n${headerSchema}\nלא נמצאו נתוני חיילים/קצינים בגיליון.`;
      }

      const fewShotSample = `[דוגמה לרשומה קיימת (Few-Shot Example)]: • ישראל ישראלי | צוות: קסבה | דרגה: סרן | תפקיד: רש"צ | אוכלוסייה: קבע | תאריך שחרור: 2027-01-01`;

      let riskSection = '';
      if (peopleAtRisk.length > 0) {
        const riskLines = peopleAtRisk.map((p) => {
          const reasons: string[] = [];
          if (p.isRiskRelease) reasons.push(`שחרור קרוב (${p.releaseDate}) ללא חפיפה/שימור [סטטוס: ${p.horizonStatus || 'ללא'}]`);
          if (p.isRiskMeeting) reasons.push(`חריגת תאריך מפגש סטטוס (יעד היה: ${p.nextMeetingDate})`);
          return `• [${p.team}] ${p.rank} ${p.name} (${p.role}) | סיכון: ${reasons.join(' | ')}`;
        });
        riskSection = `🚨 משרתים במוקד סיכון (${peopleAtRisk.length}):\n${riskLines.join('\n')}`;
      }

      return `[רשימת המשרתים המלאה מתוך גיליון אנשים_ופיתוח (${allPeopleLines.length} חיילים/קצינים)]\n${headerSchema}\n${fewShotSample}\n\n${allPeopleLines.join('\n')}${riskSection ? `\n\n${riskSection}` : ''}`.trim();
    } catch (error: unknown) {
      logger.error({ err: error }, 'Error fetching people context from Google Sheets');
      return '[תמונת מצב חיה מתוך גיליון אנשים_ופיתוח]: לא ניתן לשלוק נתוני אנשים כעת בשל שגיאה.';
    }
  }

  public async getStaffInterfacesContext(): Promise<string> {
    try {
      let rows: unknown[][] = [];
      let usedSheetName = 'אנשי_קשר_מטה';

      try {
        const res = await this.sheets.spreadsheets.values.get({
          spreadsheetId: config.spreadsheetId,
          range: 'אנשי_קשר_מטה!A2:F50',
        });
        rows = res.data.values || [];
      } catch (err) {
        try {
          const res = await this.sheets.spreadsheets.values.get({
            spreadsheetId: config.spreadsheetId,
            range: 'ממשקי_מטה!A2:F50',
          });
          rows = res.data.values || [];
          usedSheetName = 'ממשקי_מטה';
        } catch (innerErr) {
          return '[אנשי קשר מטה, נהלים ו-SOPs]: טרם הוגדרו אנשי קשר מטה בגיליון.';
        }
      }

      const interfacesLines: string[] = [];
      const items: StaffInterfaceItem[] = [];

      for (const row of rows) {
        if (!row || row.length < 1) continue;

        const domain = (row[0] || '').toString().trim();
        if (!domain || domain.startsWith('תחום') || domain.startsWith('נושא')) {
          continue;
        }

        const roleAndContact = (row[1] || '').toString().trim();
        const responsibilities = (row[2] || '').toString().trim();
        const sop = (row[3] || '').toString().trim();
        const channel = (row[4] || '').toString().trim();
        const notes = (row[5] || '').toString().trim();

        items.push({ domain, roleAndContact, responsibilities, sop, channel, notes });

        const channelStr = channel ? ` | ערוץ/תדירות: ${channel}` : '';
        const notesStr = notes ? ` | הערות: ${notes}` : '';

        interfacesLines.push(
          `• [תחום: ${domain}] גורם/איש קשר: ${roleAndContact} | אחריות: ${responsibilities} | SOP/נוהל: ${sop}${channelStr}${notesStr}`
        );
      }

      const headerSchema = `[כותרות גיליון ${usedSheetName}: תחום / נושא | גורם מטה / איש קשר | תחומי אחריות וסמכות | נוהל מטה / SOP / תרחיש | תדירות ממשק / ערוץ תקשורת | הערות ודגשים]`;

      if (interfacesLines.length === 0) {
        return `[אנשי קשר מטה, נהלים ו-SOPs]\n${headerSchema}\nאין כרגע נתונים בגיליון ${usedSheetName}.`;
      }

      const sampleItem = items[0];
      const fewShotSample = sampleItem
        ? `[דוגמה לרשומה קיימת (Few-Shot Example)]: • [תחום: ${sampleItem.domain}] גורם/איש קשר: ${sampleItem.roleAndContact} | אחריות: ${sampleItem.responsibilities} | SOP/נוהל: ${sampleItem.sop}`
        : '';

      return `[אנשי קשר מטה, נהלים ו-SOPs]\n${headerSchema}\n${fewShotSample}\n\n${interfacesLines.join('\n')}`;
    } catch (error: unknown) {
      return '[אנשי קשר מטה, נהלים ו-SOPs]: טרם הוגדרו אנשי קשר מטה בגיליון.';
    }
  }

  public async getActiveMemoryInsights(): Promise<string> {
    try {
      const res = await this.sheets.spreadsheets.values.get({
        spreadsheetId: config.spreadsheetId,
        range: 'זיכרון_רמד!A2:I50',
      });

      const rows = res.data.values || [];
      const activeInsights: MemoryInsightItem[] = [];

      for (const row of rows) {
        if (!row || row.length < 2) continue;

        const id = (row[0] || '').toString().trim();
        const date = (row[1] || '').toString().trim();
        const domain = (row[2] || '').toString().trim();
        const patternType = (row[3] || '').toString().trim();
        const patternDescription = (row[4] || '').toString().trim();
        const impact = (row[5] || '').toString().trim();
        const mirrorQuestion = (row[6] || '').toString().trim();
        const status = (row[7] || '').toString().trim();
        const lastReviewDate = (row[8] || '').toString().trim();

        if (!patternDescription || status === 'בארכיון' || status === 'לא רלוונטי') {
          continue;
        }

        activeInsights.push({
          id,
          date,
          domain,
          patternType,
          patternDescription,
          impact,
          mirrorQuestion,
          status,
          lastReviewDate,
        });
      }

      const headerSchema = `[כותרות גיליון זיכרון_רמד: מזהה תובנה | תאריך זיהוי | תחום | סוג תבנית/נקודת תורפה | תיאור הדפוס והראיות מהשטח | השפעה על המדור | שאלת מראה | סטטוס | תאריך סקירה אחרונה]`;

      if (activeInsights.length === 0) {
        return '';
      }

      const formattedLines = activeInsights.map((item) => {
        const weakness = item.impact || item.patternType || 'ללא פירוט נקודת תורפה';
        return `• [תחום: ${item.domain}] דפוס: "${item.patternDescription}" | נקודת תורפה: ${weakness} | שאלת מראה: ${item.mirrorQuestion}`;
      });

      return `[דפוסים אישיים, הרגלים ונקודות תורפה שנלמדו על הרמ"ד (מתוך זיכרון_רמד)]\n${headerSchema}\n${formattedLines.join('\n')}`;
    } catch (error: unknown) {
      logger.error({ err: error }, 'Error fetching active memory insights from Google Sheets');
      return '';
    }
  }

  public async getSystemContext(): Promise<string> {
    const [tasksContext, peopleContext, memoryContext, archiveContext, staffContext] = await Promise.all([
      this.getLiveTasksContext(),
      this.getPeopleContext(),
      this.getActiveMemoryInsights(),
      this.getArchivedTasksContext(),
      this.getStaffInterfacesContext(),
    ]);

    return [tasksContext, peopleContext, memoryContext, archiveContext, staffContext]
      .filter((s) => s && s.trim().length > 0)
      .join('\n\n');
  }

  // ==========================================
  // SYSTEM OPERATIONS VIA DYNAMIC ENGINE
  // ==========================================

  private calculateDaysOpen(openDateStr: string): string {
    if (!openDateStr) return '0';

    let openDate: Date | null = null;

    if (/^\d{4}-\d{2}-\d{2}/.test(openDateStr)) {
      openDate = new Date(openDateStr);
    } else if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(openDateStr)) {
      const parts = openDateStr.split('/');
      const d = parseInt(parts[0] || '1', 10);
      const m = parseInt(parts[1] || '1', 10) - 1;
      const y = parseInt(parts[2] || '1970', 10);
      openDate = new Date(y, m, d);
    } else {
      const parsed = Date.parse(openDateStr);
      if (!isNaN(parsed)) {
        openDate = new Date(parsed);
      }
    }

    if (!openDate || isNaN(openDate.getTime())) {
      return '0';
    }

    const now = new Date();
    const diffMs = now.getTime() - openDate.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays).toString();
  }

  public async closeTask(taskId: string): Promise<string> {
    try {
      await this.ensureArchiveSheetExists();

      const res = await this.sheets.spreadsheets.values.get({
        spreadsheetId: config.spreadsheetId,
        range: 'משימות_ותגב!A4:M100',
      });

      const rows = res.data.values || [];
      const cleanTargetId = taskId.trim().toLowerCase().replace(/^t-?/, '');

      const rowIndex = rows.findIndex((r) => {
        if (!r || !r[0]) return false;
        const currentId = r[0].toString().trim().toLowerCase().replace(/^t-?/, '');
        return currentId === cleanTargetId;
      });

      if (rowIndex === -1) {
        return `משימה במזהה "${taskId}" לא נמצאה בגיליון משימות_ותגב.`;
      }

      const targetRow = rows[rowIndex] || [];
      const sheetRow = rowIndex + 4;

      const openDate = (targetRow[10] || '').toString().trim();
      const calculatedDays = this.calculateDaysOpen(openDate);
      const currentNotes = (targetRow[12] || '').toString().trim();
      const todayStr = new Date().toISOString().slice(0, 10);
      const updatedNotes = currentNotes
        ? `${currentNotes}\n[${todayStr}]: הושלם והועבר לארכיון.`
        : `[${todayStr}]: הושלם והועבר לארכיון.`;

      const nowFormatted = new Date().toISOString().replace('T', ' ').slice(0, 16);

      const archiveRowData: Record<string, unknown> = {
        'מזהה משימה': targetRow[0] || taskId,
        'משימה': targetRow[1] || '',
        'צוות': targetRow[2] || '',
        'אנשי קשר וגורמי חוץ': targetRow[3] || '',
        'תג"ב מקורי': targetRow[4] || '',
        'תג"ב מעודכן': targetRow[5] || '',
        'מונה דחיות': targetRow[6] || '0',
        'עדיפות': targetRow[7] || '',
        'רמת קשב וזמן עבודה': targetRow[8] || '',
        'שלב עבודה': 'הושלם',
        'תאריך פתיחה': openDate,
        'ימים פתוחה': calculatedDays,
        'הערות וסיבת דחייה': updatedNotes,
        'תאריך ושעת העברה לארכיון': nowFormatted,
      };

      await this.appendRowByHeaders('ארכיון_משימות', archiveRowData, 1);

      const sheetMeta = await this.sheets.spreadsheets.get({
        spreadsheetId: config.spreadsheetId,
      });

      const sheetObj = sheetMeta.data.sheets?.find(
        (s) => s.properties?.title === 'משימות_ותגב'
      );
      const sheetId = sheetObj?.properties?.sheetId || 0;

      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId: config.spreadsheetId,
        requestBody: {
          requests: [
            {
              deleteDimension: {
                range: {
                  sheetId,
                  dimension: 'ROWS',
                  startIndex: sheetRow - 1,
                  endIndex: sheetRow,
                },
              },
            },
          ],
        },
      });

      return `משימה ${taskId} ("${archiveRowData['משימה']}") שלב עבודה עודכן ל"הושלם", הועברה לגיליון ארכיון_משימות ונמחקה מגיליון משימות_ותגב.`;
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.error({ err: error, taskId }, `Error closing and archiving task ${taskId}: ${errMsg}`);
      return `שגיאה בסגירת משימה ${taskId}: ${errMsg}`;
    }
  }

  public async postponeTask(taskId: string, newDate: string, reason: string): Promise<string> {
    try {
      const res = await this.sheets.spreadsheets.values.get({
        spreadsheetId: config.spreadsheetId,
        range: 'משימות_ותגב!A4:M100',
      });

      const rows = res.data.values || [];
      const cleanTargetId = taskId.trim().toLowerCase().replace(/^t-?/, '');

      const rowIndex = rows.findIndex((r) => {
        if (!r || !r[0]) return false;
        const currentId = r[0].toString().trim().toLowerCase().replace(/^t-?/, '');
        return currentId === cleanTargetId;
      });

      if (rowIndex === -1) {
        return `משימה במזהה "${taskId}" לא נמצאה בגיליון משימות_ותגב.`;
      }

      const targetRow = rows[rowIndex] || [];
      const currentRejections = parseInt((targetRow[6] || '0').toString().trim(), 10) || 0;
      const newRejections = (currentRejections + 1).toString();
      const currentNotes = (targetRow[12] || '').toString().trim();
      const todayStr = new Date().toISOString().slice(0, 10);
      const newLog = `[${todayStr}]: נדחה ל-${newDate}. נימוק: ${reason}`;
      const updatedNotes = currentNotes ? `${currentNotes}\n${newLog}` : newLog;

      await this.updateCellByHeader('משימות_ותגב', 'מזהה משימה', taskId, 'תג"ב מעודכן', newDate, 3);
      await this.updateCellByHeader('משימות_ותגב', 'מזהה משימה', taskId, 'מונה דחיות', newRejections, 3);
      await this.updateCellByHeader('משימות_ותגב', 'מזהה משימה', taskId, 'הערות וסיבת דחייה', updatedNotes, 3);

      return `תג"ב משימה ${taskId} עודכן ל-${newDate}. מונה דחיות: ${newRejections}. נימוק: ${reason}.`;
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.error({ err: error, taskId }, `Error postponing task ${taskId}: ${errMsg}`);
      return `שגיאה בדחיית משימה ${taskId}: ${errMsg}`;
    }
  }

  public async updateTaskPriority(
    taskId: string,
    newPriority: 'P1' | 'P2' | 'P3' | string
  ): Promise<string> {
    try {
      let formattedPriority = newPriority;

      if (newPriority.toUpperCase().startsWith('P1')) {
        formattedPriority = 'P1 - קריטי/צוואר בקבוק';
      } else if (newPriority.toUpperCase().startsWith('P2')) {
        formattedPriority = 'P2 - חשוב/דחוף';
      } else if (newPriority.toUpperCase().startsWith('P3')) {
        formattedPriority = 'P3 - שגרתי';
      }

      const success = await this.updateCellByHeader(
        'משימות_ותגב',
        'מזהה משימה',
        taskId,
        'עדיפות',
        formattedPriority,
        3
      );

      if (success) {
        return `עדיפות משימה ${taskId} עודכנה ל-${formattedPriority}.`;
      }
      return `משימה במזהה "${taskId}" לא נמצאה בגיליון משימות_ותגב.`;
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.error({ err: error, taskId }, `Error updating priority for task ${taskId}: ${errMsg}`);
      return `שגיאה בעדכון עדיפות משימה ${taskId}: ${errMsg}`;
    }
  }

  public async saveMemoryInsight(insight: {
    domain: string;
    patternType: string;
    description: string;
    impact: string;
    recommendation: string;
  }): Promise<string> {
    try {
      const res = await this.sheets.spreadsheets.values.get({
        spreadsheetId: config.spreadsheetId,
        range: 'זיכרון_רמד!A2:I50',
      });

      const rows = res.data.values || [];
      let maxId = 0;

      for (const r of rows) {
        if (!r || !r[0]) continue;
        const num = parseInt(r[0].toString().replace(/\D/g, ''), 10);
        if (!isNaN(num) && num > maxId) {
          maxId = num;
        }
      }

      const nextId = `INS-${maxId > 0 ? maxId + 1 : rows.length + 1}`;
      const todayStr = new Date().toISOString().slice(0, 10);

      const insightData: Record<string, unknown> = {
        'מזהה תובנה': nextId,
        'תאריך זיהוי': todayStr,
        'תחום': insight.domain,
        'סוג תבנית/נקודת תורפה': insight.patternType,
        'תיאור הדפוס והראיות מהשטח': insight.description,
        'השפעה על המדור ונקודת תורפה': insight.impact,
        'שאלת מראה / המלצה לפעולה': insight.recommendation,
        'סטטוס': 'פעיל / דורש מעקב',
        'תאריך סקירה אחרונה': todayStr,
      };

      await this.appendRowByHeaders('זיכרון_רמד', insightData, 1);

      return `תובנת זיכרון חדשה [${nextId}] נשמרה בגיליון זיכרון_רמד: "${insight.description}".`;
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.error({ err: error }, 'Error saving memory insight');
      return `שגיאה בשמירת תובנת זיכרון: ${errMsg}`;
    }
  }

  public async addStaffInterface(
    domain: string,
    roleAndContact: string,
    responsibilities: string,
    sop: string
  ): Promise<string> {
    try {
      const defaultHeaders = [
        'תחום / נושא',
        'גורם מטה / איש קשר',
        'תחומי אחריות וסמכות',
        'נוהל מטה / SOP / תרחיש',
        'תדירות ממשק / ערוץ תקשורת',
        'הערות ודגשים',
      ];
      await this.ensureSheetExists('אנשי_קשר_מטה', defaultHeaders);

      const interfaceData: Record<string, unknown> = {
        'תחום / נושא': domain,
        'גורם מטה / איש קשר': roleAndContact,
        'תחומי אחריות וסמכות': responsibilities,
        'נוהל מטה / SOP / תרחיש': sop,
        'תדירות ממשק / ערוץ תקשורת': '',
        'הערות ודגשים': '',
      };

      await this.appendRowByHeaders('אנשי_קשר_מטה', interfaceData, 1);

      return `איש מטה / נוהל חדש בתחום "${domain}" מול "${roleAndContact}" התווסף בהצלחה לגיליון אנשי_קשר_מטה.`;
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.error({ err: error }, 'Error adding staff interface');
      return `שגיאה בהוספת איש מטה / נוהל: ${errMsg}`;
    }
  }

  public async updatePersonDetails(
    personName: string,
    updateData: Record<string, unknown>
  ): Promise<string> {
    try {
      let updatedCount = 0;
      for (const [header, val] of Object.entries(updateData)) {
        const success = await this.updateCellByHeader(
          'אנשים_ופיתוח',
          'שם החייל',
          personName,
          header,
          val,
          3
        );
        if (success) updatedCount++;
      }

      if (updatedCount > 0) {
        return `פרטי המשרת/ת "${personName}" עודכנו בהצלחה בגיליון אנשים_ופיתוח.`;
      }
      return `משרת/ת בשם "${personName}" לא נמצא/ה בגיליון אנשים_ופיתוח.`;
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.error({ err: error, personName }, `Error updating person details for ${personName}: ${errMsg}`);
      return `שגיאה בעדכון פרטי משרת: ${errMsg}`;
    }
  }

  public async createTask(task: {
    title: string;
    team: string;
    tgb: string;
    priority: string;
    effort?: string;
    contacts?: string;
    notes?: string;
  }): Promise<string> {
    try {
      const [activeRes, archiveRes] = await Promise.all([
        this.sheets.spreadsheets.values.get({
          spreadsheetId: config.spreadsheetId,
          range: 'משימות_ותגב!A4:A500',
        }).catch(() => null),
        this.sheets.spreadsheets.values.get({
          spreadsheetId: config.spreadsheetId,
          range: 'ארכיון_משימות!A2:A500',
        }).catch(() => null),
      ]);

      const allRows = [
        ...(activeRes?.data?.values || []),
        ...(archiveRes?.data?.values || []),
      ];

      let maxId = 0;
      for (const r of allRows) {
        if (!r || !r[0]) continue;
        const num = parseInt(r[0].toString().replace(/\D/g, ''), 10);
        if (!isNaN(num) && num > maxId) {
          maxId = num;
        }
      }

      const nextId = (maxId + 1).toString();
      const todayDate = new Date().toISOString().slice(0, 10);

      let formattedPriority = task.priority;
      if (task.priority.toUpperCase().startsWith('P1')) {
        formattedPriority = 'P1 - קריטי/צוואר בקבוק';
      } else if (task.priority.toUpperCase().startsWith('P2')) {
        formattedPriority = 'P2 - חשוב/דחוף';
      } else if (task.priority.toUpperCase().startsWith('P3')) {
        formattedPriority = 'P3 - שגרתי';
      }

      const taskRowData: Record<string, unknown> = {
        'מזהה משימה': nextId,
        'משימה': task.title,
        'צוות': task.team,
        'אנשי קשר וגורמי חוץ': task.contacts || '',
        'תג"ב מקורי': task.tgb,
        'תג"ב מעודכן': '',
        'מונה דחיות': '0',
        'עדיפות': formattedPriority,
        'רמת קשב וזמן עבודה': task.effort || 'קשב בינוני [שעה-שעתיים]',
        'שלב עבודה': 'טרם החל',
        'תאריך פתיחה': todayDate,
        'ימים פתוחה': '0',
        'הערות וסיבת דחייה': task.notes || '',
      };

      await this.appendRowByHeaders('משימות_ותגב', taskRowData, 3);

      return `משימה חדשה [מזהה ${nextId}] ("${task.title}") נוצרה בהצלחה בגיליון משימות_ותגב עבור צוות ${task.team}, תג"ב ${task.tgb}, עדיפות ${formattedPriority}.`;
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.error({ err: error, taskTitle: task.title }, `Error creating task "${task.title}": ${errMsg}`);
      return `שגיאה ביצירת משימה: ${errMsg}`;
    }
  }
}

export const sheetsService = new SheetsService();
