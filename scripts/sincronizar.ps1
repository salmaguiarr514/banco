# Script para sincronizar transferencias recibidas desde otros bancos
# Ejecutar esto cuando sospeche que tiene transferencias pendientes

$API_BASE = "http://localhost:3000/api"

Write-Host "================================"
Write-Host "Sincronización de Transferencias"
Write-Host "================================"
Write-Host ""

# Opción 1: Sincronizar todas las transferencias
Write-Host "Sincronizando todas las transferencias del Banco Central..."
Invoke-WebRequest -Uri "$API_BASE/transferencias/sincronizar" `
  -Method Get `
  -Headers @{"Content-Type"="application/json"} | ConvertTo-Json | Write-Host

Write-Host ""
Write-Host ""
Write-Host "✓ Sincronización completada"
Write-Host ""
Write-Host "Si recibió transferencias, se habrán actualizado automáticamente los saldos"
Write-Host "Puede verificar sus movimientos en la aplicación"
