/**
 * Interfaz base para todos los eventos de dominio
 */
export interface DomainEvent {
  aggregateId: string;
  eventType: string;
  timestamp: Date;
}
