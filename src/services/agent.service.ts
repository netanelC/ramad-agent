import { whatsAppService } from './whatsapp.service.js';
import { geminiService, type GeminiFunctionCall } from './gemini.service.js';
import { sheetsService } from './sheets.service.js';
import { conversationService } from './conversation.service.js';
import { queueService } from './queue.service.js';
import { config } from '../config/env.js';

export class AgentService {
  public async processIncomingMessage(from: string, text: string, messageId?: string): Promise<void> {
    const targetRecipient = from || config.allowedPhoneNumber;

    if (from !== config.allowedPhoneNumber) {
      console.warn(`Blocked message from unauthorized number: ${from}`);
      return;
    }

    // Enqueue task for this phone number to process sequentially (FIFO Queue)
    queueService.enqueue(from, async () => {
      console.log(`Processing message [ID: ${messageId || 'N/A'}]: "${text}" from ${from}`);

      // 1. Retrieve recent multi-turn conversation history
      const history = conversationService.getHistory(from);

      // 2. Fetch combined live context (Tasks + People + Memory + Staff)
      const systemContext = await sheetsService.getSystemContext();

      // 3. Record current incoming user message into history
      conversationService.addTurn(from, 'user', text);

      // 4. Define Tool Executor callback for Agent Loop
      const toolExecutor = async (call: GeminiFunctionCall): Promise<string> => {
        if (call.name === 'close_task') {
          const taskId = String(call.args.taskId || '');
          return await sheetsService.closeTask(taskId);
        } else if (call.name === 'postpone_task') {
          const taskId = String(call.args.taskId || '');
          const newDate = String(call.args.newDate || '');
          const reason = String(call.args.reason || '');
          return await sheetsService.postponeTask(taskId, newDate, reason);
        } else if (call.name === 'update_task_priority') {
          const taskId = String(call.args.taskId || '');
          const newPriority = String(call.args.newPriority || '');
          return await sheetsService.updateTaskPriority(taskId, newPriority);
        } else if (call.name === 'create_task') {
          const title = String(call.args.title || '');
          const team = String(call.args.team || '');
          const tgb = String(call.args.tgb || '');
          const priority = String(call.args.priority || '');
          const effort = String(call.args.effort || '');
          const contacts = String(call.args.contacts || '');
          const notes = String(call.args.notes || '');
          return await sheetsService.createTask({
            title,
            team,
            tgb,
            priority,
            effort,
            contacts,
            notes,
          });
        } else if (call.name === 'save_memory_insight') {
          const insightDomain = String(call.args.domain || '');
          const patternType = String(call.args.patternType || '');
          const description = String(call.args.description || '');
          const impact = String(call.args.impact || '');
          const recommendation = String(call.args.recommendation || '');
          return await sheetsService.saveMemoryInsight({
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
          return await sheetsService.addStaffInterface(
            staffDomain,
            roleAndContact,
            responsibilities,
            sop
          );
        }
        return `שגיאה: פונקציה אינה מוכרת (${call.name}).`;
      };

      // 5. Generate agent response via Agent Loop
      const finalMessage = await geminiService.generateAgentResponseWithLoop(
        text,
        toolExecutor,
        history,
        systemContext
      );

      // 6. Send success reaction emoji ✅ BEFORE sending response message
      if (messageId) {
        await whatsAppService.sendReaction(from, messageId, '✅');
      }

      // 7. Record model's response into conversation history for future turns
      conversationService.addTurn(from, 'model', finalMessage);

      // 8. Send WhatsApp message
      await whatsAppService.sendMessage(targetRecipient, finalMessage);
    });
  }
}

export const agentService = new AgentService();
