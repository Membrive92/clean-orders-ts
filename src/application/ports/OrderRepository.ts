import type { Result } from '../../shared/result.js';
import type { Order } from '../../domain/entities/Order.js';

/**
 * Puerto para persistencia de órdenes
 * Abstrae la implementación de cómo se guardan/recuperan órdenes
 */
export interface OrderRepository {
  /**
   * Guardar una nueva orden
   */
  save(order: Order): Promise<Result<void, string>>;

  /**
   * Obtener una orden por ID
   */
  findById(id: string): Promise<Result<Order | null, string>>;

  /**
   * Actualizar una orden existente
   */
  update(order: Order): Promise<Result<void, string>>;

  /**
   * Obtener todas las órdenes (con paginación opcional)
   */
  findAll(limit?: number, offset?: number): Promise<Result<Order[], string>>;
}
