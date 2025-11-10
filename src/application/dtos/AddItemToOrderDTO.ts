/**
 * DTO for adding an item to an order
 * User input data
 */
export interface AddItemToOrderDTO {
  orderId: string;
  sku: string;
  quantity: number;
}
