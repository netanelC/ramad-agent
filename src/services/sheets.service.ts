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

export interface DraftItem {
  id: string;
  text: string;
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
    rowData: Record<string, any>,
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

      const rowValues: any[] = headers.map((header) => {
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
      console.error(`Error in appendRowByHeaders for sheet "${sheetName}":`, errMsg);
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
    newValue: any,
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
        console.warn(
          `updateCellByHeader: Column headers not found in "${sheetName}". idCol: ${idColIndex}, targetCol: ${targetColIndex}`
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
      console.error(`Error in updateCellByHeader for sheet "${sheetName}":`, errMsg);
      return false;
    }
  }

  // ==========================================
  // ENSURE ARCHIVE SHEET TAB
  // ==========================================

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
      console.error('Error ensuring archive sheet tab exists:', err);
    }
  }

  // ==========================================
  // CONTEXT FETCHERS WITH FEW-SHOT EXAMPLES
  // ==========================================

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
        const stage = (row[9] || '').toString().trim();
        const status = (row[12] || '').toString().trim();

        if (
          !id ||
          id === 'מזהה משימה' ||
          stage === 'הושלם' ||
          stage === 'מבוטל' ||
          status === 'הושלם' ||
          status === 'מבוטל'
        ) {
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

      const headerSchema = `[כותרות גיליון משימות_ותגב: מזהה משימה | משימה | צוות | אנשי קשר | תג"ב מקורי | תג"ב מעודכן | מונה דחיות | עדיפות | רמת קשב | שלב עבודה | תאריך פתיחה | ימים פתוחה | סטטוס | הערות]`;

      if (tasks.length === 0) {
        return `[תמונת מצב חיה מתוך גיליון משימות_ותגב]\n${headerSchema}\nאין כרגע משימות פתוחות בגיליון.`;
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
      const fewShotSample = sampleTask
        ? `[דוגמה לרשומה קיימת (Few-Shot Example)]: • [מזהה ${sampleTask.id}] משימה: "${sampleTask.name}" | צוות: ${sampleTask.team} | עדיפות: ${sampleTask.priority} | תג"ב מעודכן: ${sampleTask.tgbEffective || 'ללא'} | קשב: ${sampleTask.attention || 'שגרתי'} | שלב: ${sampleTask.stage || 'בתהליך'}`
        : '';

      const formattedLines = tasks.map((t) => {
        const overdueTag = t.isOverdue ? ' [חריגת תג"ב!]' : '';
        const tgbStr = t.tgbEffective ? `תג"ב מעודכן: ${t.tgbEffective}` : 'ללא תג"ב';
        const attentionStr = t.attention ? ` | קשב: ${t.attention}` : '';
        const notesStr = t.notes ? ` | הערות: ${t.notes}` : '';

        return `• [מזהה ${t.id}] משימה: "${t.name}" | צוות: ${t.team} | עדיפות: ${t.priority} | ${tgbStr}${attentionStr}${notesStr}${overdueTag}`;
      });

      return `[תמונת מצב חיה מתוך גיליון משימות_ותגב]\n${headerSchema}\n${fewShotSample}\n\nנמצאו ${tasks.length} משימות פתוחות:\n${formattedLines.join('\n')}`;
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error('Error fetching live tasks context from Google Sheets:', errMsg);
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
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error('Error fetching archived tasks context from Google Sheets:', errMsg);
      return '';
    }
  }

  public async getPeopleContext(): Promise<string> {
    try {
      const res = await this.sheets.spreadsheets.values.get({
        spreadsheetId: config.spreadsheetId,
        range: 'אנשים_ופיתוח!A4:O60',
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

        const personLine = `• ${name} | צוות: ${team || 'ללא'} | דרגה: ${rank || 'ללא'} | תפקיד: ${role || 'ללא'} | אוכלוסייה: ${population || 'ללא'}${releaseDate ? ` | תאריך שחרור: ${releaseDate}` : ''}${notes ? ` | הערות: ${notes}` : ''}`;
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
            releaseDate,
            horizonStatus,
            personalGoal,
            lastMeetingDate,
            nextMeetingDate,
            notes,
            isRiskRelease,
            isRiskMeeting,
          });
        }
      }

      const headerSchema = `[כותרות גיליון אנשים_ופיתוח: שם החייל/קצין | צוות | סוג אוכלוסייה | דרגה | תפקיד | תאריך שחרור/סיום | סטטוס אופק/חפיפה | יעד אישי | תאריך מפגש קודם | תאריך מפגש הבא | הערות]`;

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
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error('Error fetching people context from Google Sheets:', errMsg);
      return '[תמונת מצב חיה מתוך גיליון אנשים_ופיתוח]: לא ניתן לשלוק נתוני אנשים כעת בשל שגיאה.';
    }
  }

  public async getStaffInterfacesContext(): Promise<string> {
    try {
      const res = await this.sheets.spreadsheets.values.get({
        spreadsheetId: config.spreadsheetId,
        range: 'ממשקי_מטה!A2:F30',
      });

      const rows = res.data.values || [];
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

      const headerSchema = `[כותרות גיליון ממשקי_מטה: תחום / נושא | גורם מטה / איש קשר | תחומי אחריות וסמכות | נוהל מטה / SOP / תרחיש | תדירות ממשק / ערוץ תקשורת | הערות ודגשים]`;

      if (interfacesLines.length === 0) {
        return `[ממשקי מטה, נהלים ו-SOPs]\n${headerSchema}\nאין כרגע נתונים בגיליון ממשקי_מטה.`;
      }

      const sampleItem = items[0];
      const fewShotSample = sampleItem
        ? `[דוגמה לרשומה קיימת (Few-Shot Example)]: • [תחום: ${sampleItem.domain}] גורם/איש קשר: ${sampleItem.roleAndContact} | אחריות: ${sampleItem.responsibilities} | SOP/נוהל: ${sampleItem.sop}`
        : '';

      return `[ממשקי מטה, נהלים ו-SOPs]\n${headerSchema}\n${fewShotSample}\n\n${interfacesLines.join('\n')}`;
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error('Error fetching staff interfaces context from Google Sheets:', errMsg);
      return '';
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
        if (!row || row.length < 3) continue;

        const id = (row[0] || '').toString().trim();
        const date = (row[1] || '').toString().trim();
        const domain = (row[2] || '').toString().trim();
        const patternType = (row[3] || '').toString().trim();
        const patternDescription = (row[4] || '').toString().trim();
        const impact = (row[5] || '').toString().trim();
        const mirrorQuestion = (row[6] || '').toString().trim();
        const status = (row[7] || '').toString().trim();
        const lastReviewDate = (row[8] || '').toString().trim();

        if (!id || id === 'מזהה תובנה') continue;

        if (
          status.includes('פעיל') ||
          status.includes('דורש מעקב') ||
          status.includes('בתהליך שיפור')
        ) {
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
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error('Error fetching active memory insights from Google Sheets:', errMsg);
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
    const diffTime = Math.max(0, now.getTime() - openDate.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays.toString();
  }

  public async closeTask(taskId: string): Promise<string> {
    try {
      await this.ensureArchiveSheetExists();

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
        return `משימה במזהה "${taskId}" לא נמצאה בגיליון משימות_ותגב.`;
      }

      const sheetRow = rowIndex + 2;
      const originalRow = rows[rowIndex] || [];

      const openDateStr = (originalRow[10] || '').toString().trim();
      const calculatedDaysOpen = this.calculateDaysOpen(openDateStr);

      const now = new Date();
      const day = String(now.getDate()).padStart(2, '0');
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const year = now.getFullYear();
      const archiveTimestamp = `${day}/${month}/${year}`;

      const originalNotes = (
        originalRow[13] ||
        (originalRow[12] && originalRow[12] !== 'פתוח' && originalRow[12] !== 'הושלם'
          ? originalRow[12]
          : '') ||
        ''
      ).toString().trim();

      const archiveRowData: Record<string, any> = {
        'מזהה משימה': (originalRow[0] || '').toString().trim(),
        'משימה': (originalRow[1] || '').toString().trim(),
        'צוות': (originalRow[2] || '').toString().trim(),
        'אנשי קשר וגורמי חוץ': (originalRow[3] || '').toString().trim(),
        'תג"ב מקורי': (originalRow[4] || '').toString().trim(),
        'תג"ב מעודכן': (originalRow[5] || '').toString().trim(),
        'מונה דחיות': (originalRow[6] || '0').toString().trim(),
        'עדיפות': (originalRow[7] || '').toString().trim(),
        'רמת קשב וזמן עבודה': (originalRow[8] || '').toString().trim(),
        'שלב עבודה': 'הושלם',
        'תאריך פתיחה': openDateStr,
        'ימים פתוחה': calculatedDaysOpen,
        'הערות וסיבת דחייה': originalNotes,
        'תאריך ושעת העברה לארכיון': archiveTimestamp,
      };

      // 1. Append row dynamically via headers
      await this.appendRowByHeaders('ארכיון_משימות', archiveRowData, 1);

      // 2. Delete row from משימות_ותגב
      const meta = await this.sheets.spreadsheets.get({
        spreadsheetId: config.spreadsheetId,
      });

      const tasksSheet = meta.data.sheets?.find(
        (s) => s.properties?.title === 'משימות_ותגב'
      );
      const tasksSheetId = tasksSheet?.properties?.sheetId ?? 0;

      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId: config.spreadsheetId,
        requestBody: {
          requests: [
            {
              deleteDimension: {
                range: {
                  sheetId: tasksSheetId,
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
      console.error(`Error closing and archiving task ${taskId}:`, errMsg);
      return `שגיאה בסגירת משימה ${taskId}: ${errMsg}`;
    }
  }

  public async postponeTask(taskId: string, newDate: string, reason: string): Promise<string> {
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
        return `משימה במזהה "${taskId}" לא נמצאה בגיליון משימות_ותגב.`;
      }

      const targetRow = rows[rowIndex] || [];
      const currentRejections = parseInt((targetRow[6] || '0').toString().trim(), 10) || 0;
      const newRejections = (currentRejections + 1).toString();
      const currentNotes = (targetRow[13] || '').toString().trim();
      const todayStr = new Date().toISOString().slice(0, 10);
      const newLog = `[${todayStr}]: נדחה ל-${newDate}. נימוק: ${reason}`;
      const updatedNotes = currentNotes ? `${currentNotes}\n${newLog}` : newLog;

      await this.updateCellByHeader('משימות_ותגב', 'מזהה משימה', taskId, 'תג"ב מעודכן', newDate, 1);
      await this.updateCellByHeader('משימות_ותגב', 'מזהה משימה', taskId, 'מונה דחיות', newRejections, 1);
      await this.updateCellByHeader('משימות_ותגב', 'מזהה משימה', taskId, 'הערות ותאריך סגירה', updatedNotes, 1);

      return `תג"ב משימה ${taskId} עודכן ל-${newDate}. מונה דחיות: ${newRejections}. נימוק: ${reason}.`;
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error(`Error postponing task ${taskId}:`, errMsg);
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
        1
      );

      if (success) {
        return `עדיפות משימה ${taskId} עודכנה ל-${formattedPriority}.`;
      }
      return `משימה במזהה "${taskId}" לא נמצאה בגיליון משימות_ותגב.`;
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error(`Error updating priority for task ${taskId}:`, errMsg);
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

      const insightData: Record<string, any> = {
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
      console.error('Error saving memory insight:', errMsg);
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
      const interfaceData: Record<string, any> = {
        'תחום / נושא': domain,
        'גורם מטה / איש קשר': roleAndContact,
        'תחומי אחריות וסמכות': responsibilities,
        'נוהל מטה / SOP / תרחיש': sop,
        'תדירות ממשק / ערוץ תקשורת': '',
        'הערות ודגשים': '',
      };

      await this.appendRowByHeaders('ממשקי_מטה', interfaceData, 1);

      return `איש מטה / נוהל חדש בתחום "${domain}" מול "${roleAndContact}" התווסף בהצלחה לגיליון ממשקי_מטה.`;
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error('Error adding staff interface:', errMsg);
      return `שגיאה בהוספת איש מטה / נוהל: ${errMsg}`;
    }
  }

  public async updatePersonDetails(
    personName: string,
    updateData: Record<string, any>
  ): Promise<string> {
    try {
      let updatedCount = 0;
      for (const [header, val] of Object.entries(updateData)) {
        const success = await this.updateCellByHeader(
          'אנשים_ופיתוח',
          'שם החייל/קצין',
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
      console.error(`Error updating person details for ${personName}:`, errMsg);
      return `שגיאה בעדכון פרטי משרת: ${errMsg}`;
    }
  }

  public async getPendingDrafts(): Promise<DraftItem[]> {
    try {
      const res = await this.sheets.spreadsheets.values.get({
        spreadsheetId: config.spreadsheetId,
        range: 'אינבוקס_טיוטות!A2:F50',
      });

      const rows = res.data.values || [];
      const drafts: DraftItem[] = [];

      for (const row of rows) {
        if (!row || row.length < 2) continue;
        const id = (row[0] || '').toString().trim();
        const text = (row[1] || '').toString().trim();
        const status = (row[5] || '').toString().trim();

        if (!id || id === 'מזהה טיוטה') continue;

        if (status === 'ממתין לאפייה') {
          drafts.push({ id, text });
        }
      }

      return drafts;
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error('Error fetching pending drafts from Google Sheets:', errMsg);
      return [];
    }
  }

  public async bakeDraft(
    draftId: string,
    taskTitle: string,
    team: string,
    tgb: string,
    priority: string
  ): Promise<string> {
    try {
      const tasksRes = await this.sheets.spreadsheets.values.get({
        spreadsheetId: config.spreadsheetId,
        range: 'משימות_ותגב!A2:N50',
      });

      const taskRows = tasksRes.data.values || [];
      let maxId = 0;

      for (const r of taskRows) {
        if (!r || !r[0]) continue;
        const num = parseInt(r[0].toString().replace(/\D/g, ''), 10);
        if (!isNaN(num) && num > maxId) {
          maxId = num;
        }
      }

      const nextTaskId = maxId > 0 ? (maxId + 1).toString() : '18';
      const todayDate = new Date().toISOString().slice(0, 10);

      let formattedPriority = priority;
      if (priority.toUpperCase().startsWith('P1')) {
        formattedPriority = 'P1 - קריטי/צוואר בקבוק';
      } else if (priority.toUpperCase().startsWith('P2')) {
        formattedPriority = 'P2 - חשוב/דחוף';
      } else if (priority.toUpperCase().startsWith('P3')) {
        formattedPriority = 'P3 - שגרתי';
      }

      const taskRowData: Record<string, any> = {
        'מזהה משימה': nextTaskId,
        'משימה': taskTitle,
        'צוות': team,
        'אנשי קשר וגורמי חוץ': '',
        'תג"ב מקורי': tgb,
        'תג"ב מעודכן': '',
        'מונה דחיות': '0',
        'עדיפות': formattedPriority,
        'רמת קשב וזמן עבודה': 'קשב בינוני [שעה-שעתיים]',
        'שלב עבודה': 'טרם החל',
        'תאריך פתיחה': todayDate,
        'ימים פתוחה': '0',
        'סטטוס': 'פתוח',
        'הערות ותאריך סגירה': `אפוי מאינבוקס טיוטות (${draftId})`,
      };

      // 1. Append task dynamically via headers
      await this.appendRowByHeaders('משימות_ותגב', taskRowData, 1);

      // 2. Update draft status via updateCellByHeader
      await this.updateCellByHeader(
        'אינבוקס_טיוטות',
        'מזהה טיוטה',
        draftId,
        'סטטוס',
        'הועבר לגיליון משימות',
        1
      );

      return `טיוטה ${draftId} נאפתה בהצלחה למשימה חדשה [מזהה ${nextTaskId}] ("${taskTitle}") בגיליון משימות_ותגב.`;
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error(`Error baking draft ${draftId}:`, errMsg);
      return `שגיאה באפיית טיוטה ${draftId}: ${errMsg}`;
    }
  }

  public async appendDraftTask(taskText: string): Promise<void> {
    try {
      const draftData: Record<string, any> = {
        'מזהה טיוטה': `D-${Date.now().toString().slice(-4)}`,
        'תוכן הטיוטה החטופה': taskText,
        'תאריך ושעת נקלטה': new Date().toISOString().replace('T', ' ').slice(0, 16),
        'צוות משוער': 'טרם זוהה',
        'חוסרים לזיהוי': 'חסר תג"ב/עדיפות',
        'סטטוס': 'ממתין לאפייה',
      };

      await this.appendRowByHeaders('אינבוקס_טיוטות', draftData, 1);
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error('Failed to append draft to Google Sheets:', error.message);
      } else {
        console.error('Failed to append draft to Google Sheets:', error);
      }
    }
  }
}

export const sheetsService = new SheetsService();
