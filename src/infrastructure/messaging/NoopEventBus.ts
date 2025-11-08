import { ok } from '../../shared/result.js';
import type { Result } from '../../shared/result.js';
import type { DomainEvent } from '../../domain/events/index.js';
import type { EventBus } from '../../application/ports/EventBus.js';

/**
 * Implementación Noop del EventBus (No Operation)
 * No hace nada con los eventos - solo los descarta
 * Útil para testing cuando no necesitas procesar eventos
 */
export class NoopEventBus implements EventBus {
  async publish(_events: DomainEvent[]): Promise<Result<void, string>> {
    return ok(undefined);
  }

  async publishSingle(_event: DomainEvent): Promise<Result<void, string>> {
    return ok(undefined);
  }

  subscribe(_eventType: string, _handler: (event: DomainEvent) => Promise<void>): void {
    // No-op: no hacer nada
  }

  unsubscribe(_eventType: string, _handler: (event: DomainEvent) => Promise<void>): void {
    // No-op: no hacer nada
  }
}
