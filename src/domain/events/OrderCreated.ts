import type { DomainEvent } from './DomainEvent.ts';

export class OrderCreated implements DomainEvent {
  readonly eventType = 'OrderCreated';

  constructor(readonly aggregateId: string, readonly timestamp: Date) {}
}
