import { whatsAppService } from './whatsapp.service.js';
import { geminiService } from './gemini.service.js';
import { sheetsService, type SheetOperationResult } from './sheets.service.js';
import { config } from '../config/env.js';

export class AgentService {
  public async processIncomingMessage(from: string, text: string): Promise<void> {
    if (from !== config.allowedPhoneNumber) {
      console.warn(`Blocked message from unauthorized number: ${from}`);
      return;
    }

    console.log(`Received message: "${text}" from ${from}`);

    try {
      // 1. Fetch combined live context (Tasks + People + Memory)
      const systemContext = await sheetsService.getSystemContext();

      // 2. Generate response or tool call requests from Gemini
      const agentResult = await geminiService.generateAgentResponse(text, systemContext);

      // 3. Check if Gemini requested Function Calls (Tools)
      if (agentResult.functionCalls && agentResult.functionCalls.length > 0) {
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

          const toolResult: SheetOperationResult = {
            success: !messageResult.startsWith('שגיאה'),
            message: messageResult,
          };

          // Generate confirmation response from Gemini with function result
          const confirmationReply = await geminiService.sendFunctionResponse(
            text,
            call.name,
            call.args,
            toolResult,
            systemContext
          );

          await whatsAppService.sendMessage(from, confirmationReply);
        }
      } else {
        // Direct text response from Gemini
        const reply = agentResult.text || 'נקלט.';
        await whatsAppService.sendMessage(from, reply);

        if (reply.includes('אינבוקס טיוטות') || text.startsWith('משימה:')) {
          await sheetsService.appendDraftTask(text);
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        console.error('Error in agent message processing:', err.message);
      } else {
        console.error('Error in agent message processing:', err);
      }
    }
  }
}

export const agentService = new AgentService();
