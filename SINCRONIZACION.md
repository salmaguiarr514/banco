# Sistema de Transferencias Entre Bancos

## El Problema
Cuando otros bancos conectados a la API del Banco Central le envían dinero:
1. La transferencia se registra en el Banco Central
2. Pero **no se actualiza automáticamente** en su base de datos local
3. Por eso el dinero aparece en el Banco Central pero no en su saldo

## La Solución: Sincronización

Ahora el sistema permite **sincronizar automáticamente** las transferencias recibidas.

### Endpoints Disponibles

#### 1. Sincronizar Todas las Transferencias
```
GET /api/transferencias/sincronizar
```

Sincroniza TODAS las cuentas del banco con el Banco Central.

**Respuesta:**
```json
{
  "message": "Sincronización completada",
  "transferenciasRecibidas": 2,
  "detalles": [
    {
      "id": "tx-123456",
      "monto": "1500.50",
      "origen": "022000000000000005692",
      "cuenta": 1,
      "estado": "procesada"
    }
  ]
}
```

#### 2. Ver Transferencias Pendientes de una Cuenta
```
GET /api/transferencias/:cuentaId/pendientes
```

Permite ver qué transferencias están pendientes de sincronizar para una cuenta específica.

**Ejemplo:**
```
GET /api/transferencias/1/pendientes
```

**Respuesta:**
```json
{
  "transacciones": [
    {
      "id": "tx-123456",
      "cbuOrigen": "022000000000000005692",
      "cbuDestino": "022000000000000005690",
      "importe": "1500.50",
      "estado": "completada",
      "yaRegistrada": false
    }
  ],
  "pendientes": [
    {
      "id": "tx-123456",
      "cbuOrigen": "022000000000000005692",
      "cbuDestino": "022000000000000005690",
      "importe": "1500.50",
      "estado": "completada",
      "yaRegistrada": false
    }
  ]
}
```

#### 3. Hacer Transferencias (ya existente)
```
POST /api/transferencias
```

Realiza una transferencia a otra cuenta.

## Cómo Funciona la Sincronización

1. **Consulta el Banco Central**: Se conecta a la API del Banco Central
2. **Obtiene todas las transacciones** para cada CBU
3. **Filtra las recibidas**: Solo toma las donde su CBU es el destino
4. **Verifica si existen**: Comprueba que no esté ya registrada (usa el ID del Banco Central)
5. **Actualiza saldos**: Suma el monto a la cuenta
6. **Registra movimiento**: Guarda un registro del movimiento

### Ventajas de este Método

✓ **Sin duplicados**: Usa el ID del Banco Central para evitar procesar 2 veces lo mismo
✓ **Automático**: Se actualiza el saldo sin intervención manual
✓ **Seguro**: Solo registra transferencias completadas
✓ **Auditado**: Queda constancia en el historial de movimientos

## Cómo Usar

### Opción 1: Desde Terminal
```bash
# En Linux/Mac
./scripts/sincronizar.sh

# En PowerShell (Windows)
./scripts/sincronizar.ps1
```

### Opción 2: Desde la Aplicación
Llame al endpoint directamente:
```bash
curl -X GET "http://localhost:3000/api/transferencias/sincronizar"
```

### Opción 3: Automáticamente
Puede agregar un cron job o programar una tarea para que se sincronice periódicamente:
```bash
# Cada 5 minutos
*/5 * * * * curl -X GET "http://localhost:3000/api/transferencias/sincronizar"
```

## Pasos para Resolver el Problema Actual

1. **Iniciar el servidor backend**
   ```bash
   cd backend
   npm run dev
   ```

2. **Ejecutar la sincronización**
   ```bash
   curl -X GET "http://localhost:3000/api/transferencias/sincronizar"
   ```

3. **Verificar en la aplicación**
   - Abra el frontend
   - Vaya a "Mis Movimientos"
   - Debería ver la transferencia recibida

4. **Confirmar el saldo**
   - El saldo debe haber aumentado con el monto recibido

## Tabla de Transferencias

La base de datos ahora registra todas las transferencias en la tabla `transferencias`:

```sql
CREATE TABLE transferencias (
    id SERIAL PRIMARY KEY,
    cuenta_origen_id INT NOT NULL,
    cuenta_destino_id INT NOT NULL,
    monto NUMERIC(15,2) NOT NULL,
    concepto VARCHAR(255),
    estado VARCHAR(20) DEFAULT 'pendiente',
    fecha_transferencia TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

Los estados pueden ser:
- `pendiente`: Transferencia iniciada pero no completada
- `completada`: Transferencia completada exitosamente
- `fallida`: Transferencia rechazada

## Debugging

Si no ve las transferencias después de sincronizar:

1. **Verifique que el servidor está corriendo**
   ```bash
   curl -X GET "http://localhost:3000/api/health"
   ```

2. **Verifique las credenciales del Banco Central**
   ```bash
   # En backend/.env
   BANCO_API_KEY=su_clave_aqui
   BANCO_ENV=test
   ```

3. **Vea el historial de movimientos**
   ```bash
   GET /api/movimientos
   ```

4. **Verifique la tabla transferencias**
   ```sql
   SELECT * FROM transferencias;
   ```

## Notas

- La sincronización es segura y puede ejecutarse múltiples veces sin duplicar datos
- Las transferencias recibidas aparecen en "Mis Movimientos" con tipo "transferencia_recibida"
- El saldo se actualiza inmediatamente después de la sincronización
