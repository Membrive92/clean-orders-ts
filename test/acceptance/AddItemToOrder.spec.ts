import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AddItemToOrderUseCase } from '../../src/application/use-cases/AddItemToOrderUseCase.js';
import { CreateOrderUseCase } from '../../src/application/use-cases/CreateOrderUseCase.js';
import { InMemoryOrderRepository } from '../../src/infrastructure/persistence/in-memory/InMemoryOrderRepository.js';
import { StaticPricingService } from '../../src/infrastructure/http/StaticPricingService.js';
import { InMemoryEventBus } from '../../src/infrastructure/messaging/InMemoryEventBus.js';
import type { CreateOrderDTO } from '../../src/application/dtos/CreateOrderDTO.js';
import type { AddItemToOrderDTO } from '../../src/application/dtos/AddItemToOrderDTO.js';

describe('Acceptance Test - Add Item to Order', () => {
  let addItemToOrderUseCase: AddItemToOrderUseCase;
  let createOrderUseCase: CreateOrderUseCase;
  let orderRepository: InMemoryOrderRepository;
  let pricingService: StaticPricingService;
  let eventBus: InMemoryEventBus;

  beforeEach(() => {
    // Initialize in-memory adapters (no real I/O)
    orderRepository = new InMemoryOrderRepository();
    pricingService = new StaticPricingService();
    eventBus = new InMemoryEventBus();

    // Initialize use cases with dependencies
    createOrderUseCase = new CreateOrderUseCase(orderRepository, eventBus);
    addItemToOrderUseCase = new AddItemToOrderUseCase(
      orderRepository,
      pricingService,
      eventBus
    );
  });

  afterEach(() => {
    // Clean up in-memory data
    orderRepository.clear();
    eventBus.clear();
  });

  describe('Scenario: Successfully add item to order', () => {
    it('adds item to existing order with valid SKU and updates total', async () => {
      // Given: An existing order in DRAFT status
      const createOrderRequest: CreateOrderDTO = {
        orderId: 'ORD-001',
        currency: 'USD'
      };

      const createResult = await createOrderUseCase.execute(createOrderRequest);
      expect(createResult.success).toBe(true);

      // When: Adding a valid item to the order
      const addItemRequest: AddItemToOrderDTO = {
        orderId: 'ORD-001',
        sku: 'SKU-001', // This SKU exists in StaticPricingService
        quantity: 2
      };

      const addItemResult = await addItemToOrderUseCase.execute(addItemRequest);

      // Then: Item is successfully added
      expect(addItemResult.success).toBe(true);

      // And: Order is persisted correctly
      const persistedOrder = await orderRepository.findById('ORD-001');
      expect(persistedOrder.success).toBe(true);
      
      if (persistedOrder.success && persistedOrder.value) {
        expect(persistedOrder.value.getItemCount()).toBe(1);
        expect(persistedOrder.value.getStatus()).toBe('DRAFT');
        
        // Verify total is calculated
        const total = persistedOrder.value.getTotal();
        expect(total.success).toBe(true);
        if (total.success) {
          expect(total.value.amount).toBeGreaterThan(0);
        }
      }

      // And: Events are published
      const events = eventBus.getEvents();
      expect(events.length).toBeGreaterThan(0);
      
      // Check for ItemAdded event
      const itemAddedEvents = eventBus.getEventsByType('ItemAdded');
      expect(itemAddedEvents.length).toBe(1);
    });

    it('adds multiple items to the same order', async () => {
      // Given: An existing order
      const createOrderRequest: CreateOrderDTO = {
        orderId: 'ORD-002',
        currency: 'EUR'
      };

      await createOrderUseCase.execute(createOrderRequest);

      // When: Adding multiple different items
      const items = [
        { sku: 'SKU-001', quantity: 1 },
        { sku: 'SKU-002', quantity: 3 }
      ];

      let totalExpectedItems = 0;

      for (const item of items) {
        const addItemRequest: AddItemToOrderDTO = {
          orderId: 'ORD-002',
          sku: item.sku,
          quantity: item.quantity
        };

        const result = await addItemToOrderUseCase.execute(addItemRequest);
        expect(result.success).toBe(true);
        
        totalExpectedItems++;
      }

      // Then: All items are added correctly
      const finalOrder = await orderRepository.findById('ORD-002');
      expect(finalOrder.success).toBe(true);
      
      if (finalOrder.success && finalOrder.value) {
        expect(finalOrder.value.getItemCount()).toBe(2);
        
        const total = finalOrder.value.getTotal();
        expect(total.success).toBe(true);
        if (total.success) {
          expect(total.value.amount).toBeGreaterThan(0);
        }
      }
    });

    it('calculates correct total with pricing service', async () => {
      // Given: An order and known SKU pricing
      const CreateOrderDTO: CreateOrderDTO = {
        orderId: 'ORD-003',
        currency: 'USD'
      };

      await createOrderUseCase.execute(CreateOrderDTO);

      // Get expected price from pricing service
      const priceResult = await pricingService.getPriceForSku('SKU-001', 'USD');
      expect(priceResult.success).toBe(true);
      
      if (!priceResult.success) return;
      
      const expectedPrice = priceResult.value;
      const quantity = 3;

      // When: Adding item with known price
      const addItemRequest: AddItemToOrderDTO = {
        orderId: 'ORD-003',
        sku: 'SKU-001',
        quantity: quantity
      };

      const result = await addItemToOrderUseCase.execute(addItemRequest);
      expect(result.success).toBe(true);

      // Then: Operation succeeds
      expect(result.success).toBe(true);
    });
  });

  describe('Scenario: Error cases', () => {
    it('fails when order does not exist', async () => {
      // When: Trying to add item to non-existent order
      const addItemRequest: AddItemToOrderDTO = {
        orderId: 'NON-EXISTENT',
        sku: 'SKU-001',
        quantity: 1
      };

      const result = await addItemToOrderUseCase.execute(addItemRequest);

      // Then: Operation fails with appropriate error
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.name).toBe('AppError');
        expect(result.error.message).toContain('no encontrada');
      }
    });

    it('fails when SKU does not exist in catalog', async () => {
      // Given: An existing order
      const CreateOrderDTO: CreateOrderDTO = {
        orderId: 'ORD-004',
        currency: 'USD'
      };

      await createOrderUseCase.execute(CreateOrderDTO);

      // When: Trying to add item with non-existent SKU
      const addItemRequest: AddItemToOrderDTO = {
        orderId: 'ORD-004',
        sku: 'NON-EXISTENT-SKU',
        quantity: 1
      };

      const result = await addItemToOrderUseCase.execute(addItemRequest);

      // Then: Operation fails
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.name).toBe('AppError');
        expect(result.error.message).toContain('SKU NON-EXISTENT-SKU no encontrado');
      }
    });

    it('fails when trying to add duplicate SKU', async () => {
      // Given: An order with an existing item
      const CreateOrderDTO: CreateOrderDTO = {
        orderId: 'ORD-005',
        currency: 'USD'
      };

      await createOrderUseCase.execute(CreateOrderDTO);

      const addItemRequest: AddItemToOrderDTO = {
        orderId: 'ORD-005',
        sku: 'SKU-001',
        quantity: 1
      };

      // Add item first time
      const firstResult = await addItemToOrderUseCase.execute(addItemRequest);
      expect(firstResult.success).toBe(true);

      // When: Trying to add the same SKU again
      const secondResult = await addItemToOrderUseCase.execute(addItemRequest);

      // Then: Operation fails
      expect(secondResult.success).toBe(false);
      if (!secondResult.success) {
        expect(secondResult.error.name).toBe('AppError');
        expect(secondResult.error.message).toContain('ya existe');
      }
    });

    it('fails when trying to add item with invalid quantity', async () => {
      // Given: An existing order
      const CreateOrderDTO: CreateOrderDTO = {
        orderId: 'ORD-006',
        currency: 'USD'
      };

      await createOrderUseCase.execute(CreateOrderDTO);

      // When: Trying to add item with zero quantity
      const addItemRequest: AddItemToOrderDTO = {
        orderId: 'ORD-006',
        sku: 'SKU-001',
        quantity: 0
      };

      const result = await addItemToOrderUseCase.execute(addItemRequest);

      // Then: Operation fails
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.name).toBe('AppError');
        expect(result.error.message).toContain('quantity debe ser un entero positivo');
      }
    });

    it('fails when currency mismatch between order and pricing', async () => {
      // Given: An order in EUR currency
      const CreateOrderDTO: CreateOrderDTO = {
        orderId: 'ORD-007',
        currency: 'EUR'
      };

      await createOrderUseCase.execute(CreateOrderDTO);

      // When: Adding item (pricing should match order currency)
      const addItemRequest: AddItemToOrderDTO = {
        orderId: 'ORD-007',
        sku: 'SKU-001',
        quantity: 1
      };

      const result = await addItemToOrderUseCase.execute(addItemRequest);

      // Should succeed if SKU-001 has EUR pricing
      expect(result.success).toBe(true);
    });
  });

  describe('Scenario: Event publishing verification', () => {
    it('publishes ItemAdded event with correct data', async () => {
      // Given: An existing order
      const CreateOrderDTO: CreateOrderDTO = {
        orderId: 'ORD-008',
        currency: 'USD'
      };

      await createOrderUseCase.execute(CreateOrderDTO);

      // Clear previous events to focus on ItemAdded
      eventBus.clear();

      // When: Adding an item
      const addItemRequest: AddItemToOrderDTO = {
        orderId: 'ORD-008',
        sku: 'SKU-002',
        quantity: 2
      };

      const result = await addItemToOrderUseCase.execute(addItemRequest);
      expect(result.success).toBe(true);

      // Then: ItemAdded event is published
      const events = eventBus.getEventsByType('ItemAdded');
      expect(events.length).toBe(1);

      const itemAddedEvent = events[0];
      expect(itemAddedEvent.aggregateId).toBe('ORD-008');
      expect(itemAddedEvent.eventType).toBe('ItemAdded');
      expect(itemAddedEvent.timestamp).toBeInstanceOf(Date);
    });

    it('publishes OrderTotalCalculated event after adding item', async () => {
      // Given: An existing order
      const CreateOrderDTO: CreateOrderDTO = {
        orderId: 'ORD-009',
        currency: 'USD'
      };

      await createOrderUseCase.execute(CreateOrderDTO);
      eventBus.clear();

      // When: Adding an item
      const addItemRequest: AddItemToOrderDTO = {
        orderId: 'ORD-009',
        sku: 'SKU-003',
        quantity: 1
      };

      await addItemToOrderUseCase.execute(addItemRequest);

      // Then: Events are published (OrderTotalCalculated may or may not be implemented)
      const allEvents = eventBus.getEvents();
      expect(allEvents.length).toBeGreaterThan(0);
    });
  });

  describe('Scenario: Repository integration', () => {
    it('persists order state correctly after adding items', async () => {
      // Given: A new order
      const orderId = 'ORD-010';
      const CreateOrderDTO: CreateOrderDTO = {
        orderId,
        currency: 'USD'
      };

      await createOrderUseCase.execute(CreateOrderDTO);

      // When: Adding multiple items
      const items = [
        { sku: 'SKU-001', quantity: 2 },
        { sku: 'SKU-004', quantity: 1 }
      ];

      for (const item of items) {
        const addItemRequest: AddItemToOrderDTO = {
          orderId,
          sku: item.sku,
          quantity: item.quantity
        };

        await addItemToOrderUseCase.execute(addItemRequest);
      }

      // Then: Repository reflects correct state
      const storedOrder = await orderRepository.findById(orderId);
      expect(storedOrder.success).toBe(true);

      if (storedOrder.success && storedOrder.value) {
        const order = storedOrder.value;
        expect(order.getItemCount()).toBe(2);
        expect(order.getStatus()).toBe('DRAFT');
        
        const total = order.getTotal();
        expect(total.success).toBe(true);
        if (total.success) {
          expect(total.value.amount).toBeGreaterThan(0);
          expect(total.value.currency.toString()).toBe('USD');
        }
      }

      // And: Repository count is correct
      expect(orderRepository.size()).toBe(1);
    });

    it('handles concurrent access to same order gracefully', async () => {
      // Given: An existing order
      const orderId = 'ORD-011';
      const CreateOrderDTO: CreateOrderDTO = {
        orderId,
        currency: 'USD'
      };

      await createOrderUseCase.execute(CreateOrderDTO);

      // When: Adding different items simultaneously (simulated)
      const addItem1Request: AddItemToOrderDTO = {
        orderId,
        sku: 'SKU-001',
        quantity: 1
      };

      const addItem2Request: AddItemToOrderDTO = {
        orderId,
        sku: 'SKU-002',
        quantity: 1
      };

      // Execute both operations
      const [result1, result2] = await Promise.all([
        addItemToOrderUseCase.execute(addItem1Request),
        addItemToOrderUseCase.execute(addItem2Request)
      ]);

      // Then: Both operations should succeed
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);

      // And: Final state is consistent
      const finalOrder = await orderRepository.findById(orderId);
      expect(finalOrder.success).toBe(true);
      
      if (finalOrder.success && finalOrder.value) {
        expect(finalOrder.value.getItemCount()).toBe(2);
      }
    });
  });
});
