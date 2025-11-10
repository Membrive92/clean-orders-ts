import { ok, fail } from '../../shared/result.js';
import type { Result } from '../../shared/result.js';
import type { DomainEvent } from '../../domain/events/index.js';
import type { EventBus } from '../../application/ports/EventBus.js';

/**
 * In-memory implementation of EventBus
 * Stores events in memory and allows subscribing to them
 * Useful for testing and development without messaging dependency
 */
export class InMemoryEventBus implements EventBus {
  /**
   * Almacena todos los eventos publicados
   */
  private events: DomainEvent[] = [];

  /**
   * Map de suscriptores: eventType -> array de handlers
   */
  private subscribers: Map<string, Set<(event: DomainEvent) => Promise<void>>> = new Map();

  async publish(events: DomainEvent[]): Promise<Result<void, string>> {
    try {
      for (const event of events) {
        const result = await this.publishSingle(event);
        if (!result.success) {
          return result;
        }
      }
      return ok(undefined);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      return fail(`Error al publicar eventos: ${errorMessage}`);
    }
  }

  async publishSingle(event: DomainEvent): Promise<Result<void, string>> {
    try {
      // Almacenar el evento
      this.events.push(event);

      // Ejecutar handlers suscritos a este tipo de evento
      const handlers = this.subscribers.get(event.eventType);
      if (handlers) {
        const promises = Array.from(handlers).map(handler => handler(event));
        await Promise.all(promises);
      }

      return ok(undefined);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      return fail(`Error al publicar evento ${event.eventType}: ${errorMessage}`);
    }
  }

  subscribe(eventType: string, handler: (event: DomainEvent) => Promise<void>): void {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, new Set());
    }
    this.subscribers.get(eventType)!.add(handler);
  }

  unsubscribe(eventType: string, handler: (event: DomainEvent) => Promise<void>): void {
    const handlers = this.subscribers.get(eventType);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  /**
   * Get all published events (useful for testing)
   */
  getEvents(): DomainEvent[] {
    return [...this.events];
  }

  /**
   * Get events of a specific type (useful for testing)
   */
  getEventsByType(eventType: string): DomainEvent[] {
    return this.events.filter(event => event.eventType === eventType);
  }

  /**
   * Clear all events (useful for testing)
   */
  clear(): void {
    this.events = [];
    this.subscribers.clear();
  }

  /**
   * Get count of stored events (useful for testing)
   */
  size(): number {
    return this.events.length;
  }
}
