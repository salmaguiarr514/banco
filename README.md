# Home Banking

## Archivos creados

- `sql/homebanking_schema.sql`: script de base de datos PostgreSQL
- `backend/`: API REST en Node.js + Express
- `frontend/index.html`: interfaz principal
- `frontend/styles.css`: estilos del frontend
- `frontend/app.js`: logica del frontend

## Como usar

1. Crear una base PostgreSQL llamada `homebanking`
2. Ejecutar `sql/homebanking_schema.sql`
3. Entrar a `backend/`
4. Copiar `.env.example` como `.env`
5. Ejecutar `npm install`
6. Ejecutar `npm run dev`
7. Abrir `frontend/index.html`

## Endpoints

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/cuentas`
- `GET /api/cuentas/saldo`
- `GET /api/movimientos`
- `POST /api/transferencias` - Realizar transferencia
- `GET /api/transferencias/sincronizar` - Sincronizar transferencias recibidas de otros bancos

## Sincronización de Transferencias

Cuando otras instituciones (conectadas a la API del Banco Central) envían transferencias a sus cuentas, 
puede sincronizar estas transferencias llamando a:

```bash
GET /api/transferencias/sincronizar
```

Este endpoint:
1. Consulta todas las transacciones en el Banco Central para cada cuenta
2. Identifica las transferencias recibidas que aún no están registradas
3. Actualiza automáticamente los saldos
4. Registra los movimientos en el historial

Las transferencias se identifican por su ID en el Banco Central para evitar duplicados.
