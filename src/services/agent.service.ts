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

    try {
      // 1. Fetch combined live context (Tasks + People + Memory)
      const systemContext = await sheetsService.getSystemContext();

      // 2. Generate response or tool call requests from Gemini
      const agentResult = await geminiService.generateAgentResponse(text, systemContext);

      // 3. Check if Gemini requested Function Calls (Tools)
      if (agentResult.functionCalls && agentResult.functionCalls.length > 0) {
        const toolResults: string[] = [];

        for (const call of agentResult.functionCalls) {
          let messageResult: string;

          if (call.name === 'close_task') {
            const taskId = String(call.args.taskId || '');
            messageResult = await sheetsService.closeTask(taskId);
          } else if (call.name === 'postpone_task') {
            const taskId = String(call.args.taskId || '');
            const newDate = String(call.args.newDate || '');
            const reason = String(call.args.reason || '');
            messageResult = await sheetsService.postponeTask(taskId, newDate, reason);
          } else if (call.name === 'update_task_priority') {
            const taskId = String(call.args.taskId || '');
            const newPriority = String(call.args.newPriority || '');
            messageResult = await sheetsService.updateTaskPriority(taskId, newPriority);
          } else if (call.name === 'bake_draft') {
            const draftId = String(call.args.draftId || '');
            const taskTitle = String(call.args.taskTitle || '');
            const team = String(call.args.team || '');
            const tgb = String(call.args.tgb || '');
            const priority = String(call.args.priority || '');
            messageResult = await sheetsService.bakeDraft(draftId, taskTitle, team, tgb, priority);
          } else {
            messageResult = `שגיאה: פונקציה אינה מוכרת (${call.name}).`;
          }

          toolResults.push(messageResult);
        }

        // Direct Confirmation response without extra API roundtrip
        const bullets = toolResults.map((r) => `• ${r}`).join('\n');
        const extraText = agentResult.text && agentResult.text.trim() ? `\n\n${agentResult.text.trim()}` : '';
        const confirmationMessage = `*בוצע. הפעולות הבאות עודכנו בגיליון:*\n${bullets}${extraText}`;

        await whatsAppService.sendMessage(targetRecipient, confirmationMessage);
      } else {
        // Direct text response from Gemini
        const reply = agentResult.text || 'נקלט.';
        await whatsAppService.sendMessage(targetRecipient, reply);

        if (reply.includes('אינבוקס טיוטות') || text.startsWith('משימה:')) {
          await sheetsService.appendDraftTask(text);
        }
      }

      // Success reaction emoji ✅
      if (messageId) {
        await whatsAppService.sendReaction(from, messageId, '✅');
      }
    } catch (err: unknown) {
      const errorDetails = err instanceof Error ? err.message : String(err);
      console.error('Error in agent message processing:', errorDetails);

      // Error reaction emoji ❌
      if (messageId) {
        await whatsAppService.sendReaction(from, messageId, '❌');
      }

      // Always notify user on WhatsApp of error
      const errorMessage = `⚠️ נתקלתי בשגיאה בעיבוד הבקשה. פרטים: ${errorDetails || 'שגיאה לא צפויה'}`;
      try {
        await whatsAppService.sendMessage(targetRecipient, errorMessage);
      } catch (sendErr: unknown) {
        console.error('Failed to send error notification via WhatsApp:', sendErr);
      }
    }
  }
}

export const agentService = new AgentService();
