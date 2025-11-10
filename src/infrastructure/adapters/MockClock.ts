import type { Clock } from '../../application/ports/Clock.js';

/**
 * Mock implementation of Clock for testing
 * Allows controlling date/time for deterministic tests
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
   * Advance the date/time by a number of milliseconds
   */
  advance(ms: number): void {
    this.mockDate.setTime(this.mockDate.getTime() + ms);
  }
}
