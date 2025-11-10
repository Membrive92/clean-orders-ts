import type { Clock } from '../../application/ports/Clock.js';

/**
 * Clock implementation using system clock
 * Provides current date and time
 */
export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }

  timestamp(): number {
    return Date.now();
  }
}
