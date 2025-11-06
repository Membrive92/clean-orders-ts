export type DomainEvent = {
  aggregateId: string;
  eventType: string;
  timestamp: Date;
};

export class OrderCreated implements DomainEvent {
  readonly eventType = 'OrderCreated';

  constructor(readonly aggregateId: string, readonly timestamp: Date) {}
}

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

export class OrderTotalCalculated implements DomainEvent {
  readonly eventType = 'OrderTotalCalculated';

  constructor(
    readonly aggregateId: string,
    readonly total: number,
    readonly currency: string,
    readonly timestamp: Date
  ) {}
}

export class OrderFinalized implements DomainEvent {
  readonly eventType = 'OrderFinalized';

  constructor(readonly aggregateId: string, readonly timestamp: Date) {}
}
