import { logger } from '../common/logger.js';

export interface ChatTurn {
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
}

export class ConversationService {
  private historyMap: Map<string, ChatTurn[]> = new Map();
  private processedMessageIds: Map<string, number> = new Map();
  private readonly maxTurns: number = 20;
  private readonly deduplicationTtlMs: number = 5 * 60 * 1000; // 5 minutes TTL

  constructor() {
    // Periodic sweep to clean up expired message deduplication entries
    const cleanupInterval = setInterval(() => this.cleanupExpiredMessages(), 60 * 1000);
    cleanupInterval.unref();
  }

  public isDuplicateMessage(messageId: string): boolean {
    const now = Date.now();
    const expiry = this.processedMessageIds.get(messageId);

    if (expiry && expiry > now) {
      logger.debug({ messageId }, 'Duplicate incoming message detected and ignored');
      return true;
    }

    this.processedMessageIds.set(messageId, now + this.deduplicationTtlMs);
    return false;
  }

  private cleanupExpiredMessages(): void {
    const now = Date.now();
    for (const [id, expiry] of this.processedMessageIds.entries()) {
      if (expiry <= now) {
        this.processedMessageIds.delete(id);
      }
    }
  }

  public getHistory(phoneNumber: string): ChatTurn[] {
    return this.historyMap.get(phoneNumber) || [];
  }

  public addTurn(phoneNumber: string, role: 'user' | 'model', text: string): void {
    if (!text || !text.trim()) return;

    const history = this.historyMap.get(phoneNumber) || [];
    history.push({
      role,
      text: text.trim(),
      timestamp: new Date(),
    });

    if (history.length > this.maxTurns) {
      history.splice(0, history.length - this.maxTurns);
    }

    this.historyMap.set(phoneNumber, history);
  }

  public clearHistory(phoneNumber: string): void {
    this.historyMap.delete(phoneNumber);
  }
}

export const conversationService = new ConversationService();
