import type { Result } from '../../shared/result.js';
import type { OrderRepository } from './OrderRepository.js';
import type { EventBus } from './EventBus.js';

/**
 * Unit of Work pattern port
 * Manages transactional boundaries and repository lifecycle
 */
export interface UnitOfWork {
  /**
   * Execute work within a transaction
   * Commits on success, rolls back on error
   */
  run<T>(work: (repositories: Repositories) => Promise<Result<T, string>>): Promise<Result<T, string>>;
}

/**
 * Repositories and services available within a Unit of Work
 */
export interface Repositories {
  orders: OrderRepository;
  eventBus: EventBus;
}
