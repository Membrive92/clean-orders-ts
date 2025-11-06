/**
 * Puerto para obtener la hora actual
 * Abstrae cómo se obtiene la fecha/hora (sistema, NTP, mock, etc)
 * Útil para testing y control temporal
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
