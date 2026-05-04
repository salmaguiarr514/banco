#!/bin/bash

# Script para sincronizar transferencias recibidas desde otros bancos
# Ejecutar esto cuando sospeche que tiene transferencias pendientes

API_BASE="http://localhost:3000/api"

echo "================================"
echo "Sincronización de Transferencias"
echo "================================"
echo ""

# Opción 1: Sincronizar todas las transferencias
echo "Sincronizando todas las transferencias del Banco Central..."
curl -X GET "$API_BASE/transferencias/sincronizar" \
  -H "Content-Type: application/json"

echo ""
echo ""
echo "✓ Sincronización completada"
echo ""
echo "Si recibió transferencias, se habrán actualizado automáticamente los saldos"
echo "Puede verificar sus movimientos en la aplicación"
