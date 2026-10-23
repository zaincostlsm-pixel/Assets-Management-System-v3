import { Response } from 'express';

export interface RealtimeEvent {
  type:
    | 'inventory:updated'
    | 'bast:created'
    | 'withdrawal:created'
    | 'withdrawal:restored'
    | 'photo:updated'
    | 'parameter:updated'
    | 'sync:completed'
    | 'ping';
  entity: string;
  action: string;
  id?: string;
  data?: any;
  timestamp: string;
}

class RealtimeHub {
  private clients: Set<Response> = new Set();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Start heartbeat ping every 15s to keep connections alive
    this.heartbeatInterval = setInterval(() => {
      this.broadcast({
        type: 'ping',
        entity: 'SYSTEM',
        action: 'HEARTBEAT',
        timestamp: new Date().toISOString(),
      });
    }, 15000);
  }

  public registerClient(res: Response) {
    this.clients.add(res);

    // Send initial connected event
    const initPayload = `data: ${JSON.stringify({
      type: 'ping',
      entity: 'SYSTEM',
      action: 'CONNECTED',
      timestamp: new Date().toISOString(),
      clientCount: this.clients.size,
    })}\n\n`;
    res.write(initPayload);

    res.on('close', () => {
      this.clients.delete(res);
    });
  }

  public broadcast(event: RealtimeEvent) {
    const payload = `data: ${JSON.stringify(event)}\n\n`;
    for (const client of this.clients) {
      try {
        client.write(payload);
      } catch (e) {
        this.clients.delete(client);
      }
    }
  }

  public getClientCount(): number {
    return this.clients.size;
  }
}

export const realtimeHub = new RealtimeHub();
