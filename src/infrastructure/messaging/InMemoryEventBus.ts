import { ok, fail } from '../../shared/result.js';
import type { Result } from '../../shared/result.js';
import type { DomainEvent } from '../../domain/events/index.js';
import type { EventBus } from '../../application/ports/EventBus.js';

/**
 * Implementación in-memory del EventBus
 * Almacena eventos en memoria y permite suscribirse a ellos
 * Útil para testing y desarrollo sin dependencia de mensajería
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
   * Obtener todos los eventos publicados (útil para testing)
   */
  getEvents(): DomainEvent[] {
    return [...this.events];
  }

  /**
   * Obtener eventos de un tipo específico (útil para testing)
   */
  getEventsByType(eventType: string): DomainEvent[] {
    return this.events.filter(event => event.eventType === eventType);
  }

  /**
   * Limpiar todos los eventos (útil para testing)
   */
  clear(): void {
    this.events = [];
    this.subscribers.clear();
  }

  /**
   * Obtener cantidad de eventos almacenados (útil para testing)
   */
  size(): number {
    return this.events.length;
  }
}
