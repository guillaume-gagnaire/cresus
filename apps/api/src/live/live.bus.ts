import { Injectable } from '@nestjs/common';
import type { SummaryDto } from '@cresus/shared';
import type { Server } from 'socket.io';

export const roomOf = (eventId: string): string => `event:${eventId}`;

/**
 * Diffusion vers les appareils d'un évènement. Les services l'appellent après avoir écrit ; la passerelle
 * socket.io lui donne son serveur au démarrage (sans serveur, par exemple dans un script, rien n'est émis).
 */
@Injectable()
export class LiveBus {
  server: Server | null = null;

  /** Compteurs à jour, après un envoi de ventes (ou une annulation). */
  summary(summary: SummaryDto): void {
    this.server?.to(roomOf(summary.eventId)).emit('summary', summary);
  }

  /** Articles ou évènement modifiés : les appareils rechargent le détail. */
  changed(eventId: string): void {
    this.server?.to(roomOf(eventId)).emit('changed', { eventId });
  }

  devices(eventId: string): number {
    return this.server?.of('/').adapter.rooms.get(roomOf(eventId))?.size ?? 0;
  }
}
