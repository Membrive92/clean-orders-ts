/**
 * DTO para agregar un item a una orden
 * Datos de entrada del usuario
 */
export interface AddItemToOrderDTO {
  orderId: string;
  sku: string;
  quantity: number;
}
