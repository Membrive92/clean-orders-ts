import { ok, fail } from '../../../shared/result.js';
import type { Result } from '../../../shared/result.js';
import type { Order } from '../../../domain/entities/Order.js';
import type { OrderRepository } from '../../../application/ports/OrderRepository.js';

/**
 * In-memory implementation of OrderRepository
 * Useful for testing and development without DB dependency
 * Stores orders in memory using a Map
 */
export class InMemoryOrderRepository implements OrderRepository {
  private orders: Map<string, Order> = new Map();

  async save(order: Order): Promise<Result<void, string>> {
    try {
      this.orders.set(order.id, order);
      return ok(undefined);
    } catch (error) {
      return fail(
        error instanceof Error ? error.message : 'Error desconocido al guardar orden'
      );
    }
  }

  async findById(id: string): Promise<Result<Order | null, string>> {
    try {
      const order = this.orders.get(id) ?? null;
      return ok(order);
    } catch (error) {
      return fail(
        error instanceof Error ? error.message : 'Error desconocido al buscar orden'
      );
    }
  }

  async update(order: Order): Promise<Result<void, string>> {
    try {
      if (!this.orders.has(order.id)) {
        return fail(`Orden con ID ${order.id} no encontrada`);
      }
      this.orders.set(order.id, order);
      return ok(undefined);
    } catch (error) {
      return fail(
        error instanceof Error ? error.message : 'Error desconocido al actualizar orden'
      );
    }
  }

  async findAll(limit?: number, offset?: number): Promise<Result<Order[], string>> {
    try {
      let orders = Array.from(this.orders.values());

      // Aplicar offset si se proporciona
      if (offset !== undefined && offset > 0) {
        orders = orders.slice(offset);
      }

      // Aplicar limit si se proporciona
      if (limit !== undefined && limit > 0) {
        orders = orders.slice(0, limit);
      }

      return ok(orders);
    } catch (error) {
      return fail(
        error instanceof Error ? error.message : 'Error desconocido al obtener órdenes'
      );
    }
  }

  /**
   * Additional method to clear the repository (useful in tests)
   */
  clear(): void {
    this.orders.clear();
  }

  /**
   * Additional method to get the number of stored orders
   */
  size(): number {
    return this.orders.size;
  }
}
