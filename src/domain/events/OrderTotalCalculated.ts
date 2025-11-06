import type { DomainEvent } from './DomainEvent.js';

export class OrderTotalCalculated implements DomainEvent {
  readonly eventType = 'OrderTotalCalculated';

  constructor(
    readonly aggregateId: string,
    readonly total: number,
    readonly currency: string,
    readonly timestamp: Date
  ) {}
}
