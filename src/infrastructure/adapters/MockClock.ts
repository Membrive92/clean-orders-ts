import type { Clock } from '../../application/ports/Clock.js';

/**
 * Implementación mock del Clock para testing
 * Permite controlar la fecha/hora para tests determinísticos
 */
export class MockClock implements Clock {
  private mockDate: Date;

  constructor(initialDate?: Date) {
    this.mockDate = initialDate ?? new Date('2025-01-01T00:00:00Z');
  }

  now(): Date {
    return new Date(this.mockDate);
  }

  timestamp(): number {
    return this.mockDate.getTime();
  }

  /**
   * Establecer la fecha/hora para testing
   */
  setDate(date: Date): void {
    this.mockDate = date;
  }

  /**
   * Avanzar la fecha/hora un número de milisegundos
   */
  advance(ms: number): void {
    this.mockDate.setTime(this.mockDate.getTime() + ms);
  }
}
