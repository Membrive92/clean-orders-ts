import type { Result } from '../../shared/result.js';

/**
 * Port to obtain product prices
 * Abstracts how prices are obtained (API, DB, cache, etc)
 */
export interface PricingService {
  /**
   * Get the price of a product by SKU
   * Returns the price in the specified currency
   */
  getPriceForSku(sku: string, currency: string): Promise<Result<number, string>>;

  /**
   * Validate that a SKU exists
   */
  skuExists(sku: string): Promise<Result<boolean, string>>;

  /**
   * Get product descriptions or details (optional)
   */
  getProductDetails(sku: string): Promise<Result<{ name: string; description?: string } | null, string>>;
}
