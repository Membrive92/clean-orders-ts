/**
 * Port for getting the current time
 * Abstracts how date/time is obtained (system, NTP, mock, etc)
 * Useful for testing and temporal control
 */
export interface Clock {
  /**
   * Obtener la fecha y hora actual
   */
  now(): Date;

  /**
   * Obtener timestamp actual en milisegundos
   */
  timestamp(): number;
}
