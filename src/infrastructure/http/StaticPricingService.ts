import { ok, fail } from '../../shared/result.js';
import type { Result } from '../../shared/result.js';
import type { PricingService } from '../../application/ports/PricingService.js';

/**
 * Implementación estática del PricingService
 * Retorna precios predefinidos para SKUs de prueba
 * Útil para desarrollo, testing y demostración
 */
export class StaticPricingService implements PricingService {
  /**
   * Catálogo de precios predefinidos
   * Estructura: SKU -> { USD, EUR, MXN, ARS }
   */
  private pricesCatalog: Map<string, Map<string, number>>;

  /**
   * Detalles de productos para referencia
   */
  private productDetails: Map<string, { name: string; description?: string }>;

  constructor() {
    this.pricesCatalog = this.initializePrices();
    this.productDetails = this.initializeProducts();
  }

  private initializePrices(): Map<string, Map<string, number>> {
    const prices = new Map<string, Map<string, number>>();

    prices.set('SKU-001', new Map([
      ['USD', 19.99],
      ['EUR', 18.5],
      ['MXN', 399.8],
      ['ARS', 7199.64],
    ]));

    prices.set('SKU-002', new Map([
      ['USD', 49.99],
      ['EUR', 46.25],
      ['MXN', 999.8],
      ['ARS', 17999.64],
    ]));

    prices.set('SKU-003', new Map([
      ['USD', 99.99],
      ['EUR', 92.5],
      ['MXN', 1999.8],
      ['ARS', 35999.64],
    ]));

    prices.set('SKU-004', new Map([
      ['USD', 149.99],
      ['EUR', 138.75],
      ['MXN', 2999.8],
      ['ARS', 53999.64],
    ]));

    prices.set('SKU-005', new Map([
      ['USD', 29.99],
      ['EUR', 27.75],
      ['MXN', 599.8],
      ['ARS', 10799.64],
    ]));

    return prices;
  }

  private initializeProducts(): Map<string, { name: string; description?: string }> {
    const products = new Map<string, { name: string; description?: string }>();

    products.set('SKU-001', {
      name: 'Producto Premium A',
      description: 'Artículo de calidad estándar',
    });

    products.set('SKU-002', {
      name: 'Producto Premium B',
      description: 'Artículo de alta calidad',
    });

    products.set('SKU-003', {
      name: 'Producto Deluxe',
      description: 'Artículo edición limitada',
    });

    products.set('SKU-004', {
      name: 'Producto Exclusivo',
      description: 'Artículo exclusivo VIP',
    });

    products.set('SKU-005', {
      name: 'Producto Estándar',
      description: 'Artículo básico',
    });

    return products;
  }

  async getPriceForSku(sku: string, currency: string): Promise<Result<number, string>> {
    try {
      if (!sku || sku.trim().length === 0) {
        return fail('SKU no puede estar vacío');
      }

      if (!currency || currency.trim().length === 0) {
        return fail('Moneda no puede estar vacía');
      }

      const upperSku = sku.toUpperCase();
      const upperCurrency = currency.toUpperCase();

      // Validar que el SKU existe
      const pricesBySku = this.pricesCatalog.get(upperSku);
      if (!pricesBySku) {
        return fail(`SKU ${upperSku} no encontrado en catálogo de precios`);
      }

      // Validar que existe el precio en esa moneda
      const price = pricesBySku.get(upperCurrency);
      if (price === undefined) {
        return fail(
          `Precio para SKU ${upperSku} en moneda ${upperCurrency} no disponible`
        );
      }

      return ok(price);
    } catch (error) {
      return fail(
        error instanceof Error
          ? error.message
          : 'Error desconocido al obtener precio'
      );
    }
  }

  async skuExists(sku: string): Promise<Result<boolean, string>> {
    try {
      if (!sku || sku.trim().length === 0) {
        return fail('SKU no puede estar vacío');
      }

      const upperSku = sku.toUpperCase();
      const exists = this.pricesCatalog.has(upperSku);

      return ok(exists);
    } catch (error) {
      return fail(
        error instanceof Error
          ? error.message
          : 'Error desconocido al validar SKU'
      );
    }
  }

  async getProductDetails(
    sku: string
  ): Promise<Result<{ name: string; description?: string } | null, string>> {
    try {
      if (!sku || sku.trim().length === 0) {
        return fail('SKU no puede estar vacío');
      }

      const upperSku = sku.toUpperCase();
      const details = this.productDetails.get(upperSku) ?? null;

      return ok(details);
    } catch (error) {
      return fail(
        error instanceof Error
          ? error.message
          : 'Error desconocido al obtener detalles de producto'
      );
    }
  }

  /**
   * Método para agregar o actualizar precios (útil para testing)
   */
  setPriceForSku(sku: string, currency: string, price: number): void {
    const upperSku = sku.toUpperCase();
    const upperCurrency = currency.toUpperCase();

    let pricesBySku = this.pricesCatalog.get(upperSku);
    if (!pricesBySku) {
      pricesBySku = new Map();
      this.pricesCatalog.set(upperSku, pricesBySku);
    }

    pricesBySku.set(upperCurrency, price);
  }

  /**
   * Método para agregar productos (útil para testing)
   */
  setProductDetails(
    sku: string,
    details: { name: string; description?: string }
  ): void {
    const upperSku = sku.toUpperCase();
    this.productDetails.set(upperSku, details);
  }
}
