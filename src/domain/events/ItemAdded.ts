import type { DomainEvent } from './DomainEvent.js';

export class ItemAdded implements DomainEvent {
  readonly eventType = 'ItemAdded';

  constructor(
    readonly aggregateId: string,
    readonly sku: string,
    readonly quantity: number,
    readonly unitPrice: number,
    readonly timestamp: Date
  ) {}
}
