export interface ChatTurn {
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
}

export class ConversationService {
  private historyMap: Map<string, ChatTurn[]> = new Map();
  private maxTurns: number = 20; // Keep up to 20 recent messages for context threading

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

    // Trim to keep only maxTurns
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
