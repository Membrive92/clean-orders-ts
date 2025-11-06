import type { Result } from '../../shared/result.js';

/**
 * Puerto para obtener precios de productos
 * Abstrae cómo se obtienen los precios (API, BD, caché, etc)
 */
export interface PricingService {
  /**
   * Obtener el precio de un producto por SKU
   * Retorna el precio en la moneda especificada
   */
  getPriceForSku(sku: string, currency: string): Promise<Result<number, string>>;

  /**
   * Validar que un SKU existe
   */
  skuExists(sku: string): Promise<Result<boolean, string>>;

  /**
   * Obtener descripciones o detalles de productos (opcional)
   */
  getProductDetails(sku: string): Promise<Result<{ name: string; description?: string } | null, string>>;
}
