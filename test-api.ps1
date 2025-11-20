# Test API endpoints with PowerShell

# Create a new order
Write-Host "=== Creating new order ===" -ForegroundColor Green
$createOrderBody = @{
    currency = "USD"
} | ConvertTo-Json

$newOrder = Invoke-RestMethod -Uri "http://localhost:3000/orders" -Method POST -Body $createOrderBody -ContentType "application/json"
Write-Host "Created order:" -ForegroundColor Cyan
$newOrder | ConvertTo-Json
$orderId = $newOrder.id

# Get all orders
Write-Host "`n=== Getting all orders ===" -ForegroundColor Green
$allOrders = Invoke-RestMethod -Uri "http://localhost:3000/orders" -Method GET
Write-Host "Total orders: $($allOrders.Count)" -ForegroundColor Cyan
$allOrders | ForEach-Object {
    Write-Host "  - Order $($_.id): $($_.status) ($($_.currency))"
}

# Get specific order
Write-Host "`n=== Getting order $orderId ===" -ForegroundColor Green
$order = Invoke-RestMethod -Uri "http://localhost:3000/orders/$orderId" -Method GET
$order | ConvertTo-Json

# Add item to order
Write-Host "`n=== Adding item to order ===" -ForegroundColor Green
$addItemBody = @{
    sku = "LAPTOP-PRO-15"
    quantity = 2
} | ConvertTo-Json

$updatedOrder = Invoke-RestMethod -Uri "http://localhost:3000/orders/$orderId/items" -Method POST -Body $addItemBody -ContentType "application/json"
Write-Host "Order after adding item:" -ForegroundColor Cyan
$updatedOrder | ConvertTo-Json -Depth 10

# Confirm order
Write-Host "`n=== Confirming order ===" -ForegroundColor Green
$confirmedOrder = Invoke-RestMethod -Uri "http://localhost:3000/orders/$orderId/confirm" -Method POST
Write-Host "Order confirmed:" -ForegroundColor Cyan
$confirmedOrder | ConvertTo-Json -Depth 10

Write-Host "`n=== All tests completed! ===" -ForegroundColor Green
