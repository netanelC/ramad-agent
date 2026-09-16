import { whatsAppService } from './whatsapp.service.js';
import { geminiService } from './gemini.service.js';
import { sheetsService } from './sheets.service.js';
import { config } from '../config/env.js';

export class AgentService {
  public async processIncomingMessage(from: string, text: string, messageId?: string): Promise<void> {
    const targetRecipient = from || config.allowedPhoneNumber;

    if (from !== config.allowedPhoneNumber) {
      console.warn(`Blocked message from unauthorized number: ${from}`);
      return;
    }

    console.log(`Received message [ID: ${messageId || 'N/A'}]: "${text}" from ${from}`);

    // 1. Fetch combined live context (Tasks + People + Memory)
    const systemContext = await sheetsService.getSystemContext();

    // 2. Generate response or tool call requests from Gemini
    const agentResult = await geminiService.generateAgentResponse(text, systemContext);

    // 3. Check if Gemini requested Function Calls (Tools)
    const toolResults: string[] = [];

    if (agentResult.functionCalls && agentResult.functionCalls.length > 0) {
      for (const call of agentResult.functionCalls) {
        let messageResult: string;

        let domain = 'ניהול משימות';
        let actionDescription = '';

        if (call.name === 'close_task') {
          const taskId = String(call.args.taskId || '');
          messageResult = await sheetsService.closeTask(taskId);
          actionDescription = `סגירת משימה ${taskId} והעברה לארכיון`;
        } else if (call.name === 'postpone_task') {
          const taskId = String(call.args.taskId || '');
          const newDate = String(call.args.newDate || '');
          const reason = String(call.args.reason || '');
          messageResult = await sheetsService.postponeTask(taskId, newDate, reason);
          actionDescription = `דחיית משימה ${taskId} ל-${newDate}. נימוק: ${reason}`;
        } else if (call.name === 'update_task_priority') {
          const taskId = String(call.args.taskId || '');
          const newPriority = String(call.args.newPriority || '');
          messageResult = await sheetsService.updateTaskPriority(taskId, newPriority);
          actionDescription = `עדכון עדיפות משימה ${taskId} ל-${newPriority}`;
        } else if (call.name === 'create_task') {
          const title = String(call.args.title || '');
          const team = String(call.args.team || '');
          const tgb = String(call.args.tgb || '');
          const priority = String(call.args.priority || '');
          const effort = String(call.args.effort || '');
          const contacts = String(call.args.contacts || '');
          const notes = String(call.args.notes || '');
          messageResult = await sheetsService.createTask({
            title,
            team,
            tgb,
            priority,
            effort,
            contacts,
            notes,
          });
          actionDescription = `יצירת משימה חדשה "${title}" עבור צוות ${team} (תג"ב: ${tgb}, עדיפות: ${priority})`;
        } else if (call.name === 'save_memory_insight') {
          const insightDomain = String(call.args.domain || '');
          const patternType = String(call.args.patternType || '');
          const description = String(call.args.description || '');
          const impact = String(call.args.impact || '');
          const recommendation = String(call.args.recommendation || '');
          messageResult = await sheetsService.saveMemoryInsight({
            domain: insightDomain,
            patternType,
            description,
            impact,
            recommendation,
          });
        } else if (call.name === 'add_staff_interface') {
          const staffDomain = String(call.args.domain || '');
          const roleAndContact = String(call.args.roleAndContact || '');
          const responsibilities = String(call.args.responsibilities || '');
          const sop = String(call.args.sop || '');
          messageResult = await sheetsService.addStaffInterface(
            staffDomain,
            roleAndContact,
            responsibilities,
            sop
          );
          actionDescription = `הוספת איש מטה/נוהל בתחום ${staffDomain} מול ${roleAndContact}`;
        } else {
          messageResult = `שגיאה: פונקציה אינה מוכרת (${call.name}).`;
        }

        // Auto-record memory insight for mutations if save_memory_insight was not explicitly called in this batch
        const hasExplicitMemoryCall = agentResult.functionCalls.some(c => c.name === 'save_memory_insight');
        if (actionDescription && !hasExplicitMemoryCall) {
          await sheetsService.saveMemoryInsight({
            domain,
            patternType: 'תיעוד אירוע שוטף',
            description: actionDescription,
            impact: 'מעקב רציף על ניהול עבודה וביצועי הרמ"ד',
            recommendation: 'לוודא המשך עמידה בתג"בים וקשב עמוק למשימות P1',
          }).catch(err => console.error('Auto memory insight error:', err));
        }

        toolResults.push(messageResult);
      }
    }

    // 4. Send success reaction emoji ✅ BEFORE sending response message
    if (messageId) {
      await whatsAppService.sendReaction(from, messageId, '✅');
    }

    if (agentResult.functionCalls && agentResult.functionCalls.length > 0) {
      // Direct Confirmation response without extra API roundtrip
      const bullets = toolResults.map((r) => `• ${r}`).join('\n');
      const extraText = agentResult.text && agentResult.text.trim() ? `\n\n${agentResult.text.trim()}` : '';
      const confirmationMessage = `*בוצע. הפעולות הבאות עודכנו בגיליון:*\n${bullets}${extraText}`;

      await whatsAppService.sendMessage(targetRecipient, confirmationMessage);
    } else {
      // Direct text response from Gemini
      const reply = agentResult.text || 'נקלט.';
      await whatsAppService.sendMessage(targetRecipient, reply);
    }
  }
}

export const agentService = new AgentService();
