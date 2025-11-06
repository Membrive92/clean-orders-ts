import type { DomainEvent } from '../../domain/events/index.js';
import type { Result } from '../../shared/result.js';

/**
 * Puerto para publicar eventos de dominio
 * Abstrae cómo se publican/persisten eventos (mensajería, BD, etc)
 */
export interface EventBus {
  /**
   * Publicar uno o más eventos de dominio
   */
  publish(events: DomainEvent[]): Promise<Result<void, string>>;

  /**
   * Publicar un evento único
   */
  publishSingle(event: DomainEvent): Promise<Result<void, string>>;

  /**
   * Suscribirse a eventos de un tipo específico
   */
  subscribe(eventType: string, handler: (event: DomainEvent) => Promise<void>): void;

  /**
   * Cancelar suscripción
   */
  unsubscribe(eventType: string, handler: (event: DomainEvent) => Promise<void>): void;
}
