import type { Clock } from '../../application/ports/Clock.js';

/**
 * Implementación del Clock usando el reloj del sistema
 * Proporciona fecha y hora actual
 */
export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }

  timestamp(): number {
    return Date.now();
  }
}
