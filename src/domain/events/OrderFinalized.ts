import type { DomainEvent } from './DomainEvent.js';

export class OrderFinalized implements DomainEvent {
  readonly eventType = 'OrderFinalized';

  constructor(readonly aggregateId: string, readonly timestamp: Date) {}
}
