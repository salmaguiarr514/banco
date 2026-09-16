# NODO — Home Banking

App de homebanking estilo fintech, construida con Node.js + Express (backend), HTML/CSS/JS vanilla (frontend) y Supabase (Auth + PostgreSQL).

---

## Stack

| Capa | Tecnología |
|---|---|
| Backend | Node.js + Express |
| Frontend | HTML, CSS, JS vanilla (sin frameworks) |
| Auth | Supabase Auth |
| Base de datos | Supabase PostgreSQL (pg pool) |
| Banco Central | `https://centralbank.brocoly.cc/api` — siempre `x-environment: test` |
| Cotizaciones | `https://dolarapi.com/v1/dolares` |

---

## Estructura del proyecto

```
homebanking/
├── backend/
│   ├── src/
│   │   ├── app.js                      # Express app + rutas
│   │   ├── server.js                   # Entrypoint
│   │   ├── config/
│   │   │   └── db.js                   # Pool pg + initDb (crea tablas)
│   │   ├── middleware/
│   │   │   └── authMiddleware.js       # Valida JWT Supabase
│   │   ├── controllers/
│   │   │   ├── authController.js
│   │   │   ├── cuentaController.js
│   │   │   ├── movimientoController.js
│   │   │   ├── transferenciaController.js
│   │   │   ├── reservaController.js
│   │   │   ├── prestamoController.js   # ← Módulo Préstamos
│   │   │   ├── chatController.js
│   │   │   ├── cardController.js
│   │   │   └── mercadoController.js
│   │   ├── routes/
│   │   │   ├── authRoutes.js
│   │   │   ├── cuentaRoutes.js
│   │   │   ├── movimientoRoutes.js
│   │   │   ├── transferenciaRoutes.js
│   │   │   ├── reservaRoutes.js
│   │   │   ├── prestamoRoutes.js       # ← Módulo Préstamos
│   │   │   ├── chatRoutes.js
│   │   │   ├── cardRoutes.js
│   │   │   └── mercadoRoutes.js
│   │   └── services/
│   │       └── bancoCentralService.js  # Cliente BC API (siempre test)
│   ├── .env                            # Variables de entorno (no commitear)
│   └── package.json
└── frontend/
    ├── login.html
    ├── dashboard.html
    ├── app.js
    └── styles.css
```

---

## Cómo levantar

```bash
# Desde backend/
npm install
node server.js
# → http://localhost:3000
```

El servidor sirve el frontend como archivos estáticos. `GET /` redirige a `/login.html`.

### Variables de entorno (.env)

```
DATABASE_URL=postgresql://...    # URL de conexión Supabase
SUPABASE_URL=https://...
SUPABASE_SERVICE_KEY=...
BANCO_ENV=test                   # SIEMPRE test, nunca prod
```

---

## Base de datos

Las tablas se crean automáticamente en `initDb()` al arrancar. No hay migraciones manuales.

| Tabla | Descripción |
|---|---|
| `cuentas` | Cuentas ARS y USD de cada usuario |
| `movimientos` | Historial de transacciones por cuenta |
| `transferencias` | Transferencias inter-cuenta |
| `reservas` | Metas de ahorro con fecha de vencimiento |
| `prestamos` | Préstamos solicitados (amortización francesa) |
| `cards` | Tarjetas Visa Débito virtuales |

### Tabla `prestamos`

```sql
id               SERIAL PRIMARY KEY
usuario_id       UUID → auth.users(id)
cuenta_acreditada_id  INTEGER → cuentas(id)
monto            NUMERIC(14,2)
cuotas           INTEGER  CHECK (IN (3, 6, 12, 24, 36))
tna              NUMERIC(6,4)
cuota_mensual    NUMERIC(14,2)
estado           VARCHAR(20)  DEFAULT 'activo'  CHECK (IN ('activo','cancelado','saldado'))
fecha_solicitud  TIMESTAMP  DEFAULT NOW()
```

---

## API Endpoints

### Auth
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/auth/register` | Registro de usuario |
| POST | `/api/auth/login` | Login, devuelve JWT |
| POST | `/api/auth/logout` | Cierre de sesión |

### Cuentas
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/cuentas` | Lista cuentas del usuario |
| GET | `/api/cuentas/saldo` | Saldo de cada cuenta |
| POST | `/api/cuentas/depositar` | Depósito en cuenta ARS |
| POST | `/api/cuentas/abrir` | Abre cuenta USD (vía BC API) |
| POST | `/api/cuentas/convertir` | Conversión ARS ↔ USD |
| GET | `/api/cuentas/buscar-usd/:valor` | Busca cuenta USD por CBU o alias (local) |
| PUT | `/api/cuentas/alias-usd` | Cambia alias de cuenta USD |
| POST | `/api/cuentas/transferir-usd` | Transferencia USD (inter-banco vía BC) |

### Movimientos
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/movimientos` | Historial de movimientos |

### Transferencias
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/transferencias` | Transferencia ARS entre cuentas |
| GET | `/api/transferencias/buscar/:cbu` | Busca titular por CBU (BC API) |
| GET | `/api/transferencias/alias/:alias` | Busca titular por alias (BC API) |
| GET | `/api/transferencias/sincronizar` | Sincroniza transferencias recibidas desde BC |

### Préstamos
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/prestamos` | Lista préstamos del usuario |
| POST | `/api/prestamos/solicitar` | Solicita préstamo (acredita en ARS) |
| PUT | `/api/prestamos/:id/cancelar` | Cancela un préstamo activo |

**Parámetros de `POST /api/prestamos/solicitar`:**
```json
{ "monto": 200000, "cuotas": 12 }
```
- `monto`: entre $10.000 y $5.000.000
- `cuotas`: 3, 6, 12, 24 o 36

**Sistema de amortización:** Francés (cuotas fijas). TNA = 95%, IVA sobre intereses = 21%.

Solo se permite un préstamo activo por usuario a la vez.

### Reservas
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/reservas` | Lista reservas del usuario |
| POST | `/api/reservas` | Crea una reserva |
| DELETE | `/api/reservas/:id` | Elimina una reserva |

### Chat IA
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/chat` | Chat con asistente IA integrado |

### Tarjetas
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/cards` | Obtiene tarjeta virtual del usuario |
| POST | `/api/cards/emitir` | Emite tarjeta Visa Débito virtual |
| POST | `/api/cards/bloquear` | Bloquea/desbloquea tarjeta |

### Mercado
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/mercado/cotizaciones` | Cotizaciones del dólar (DolarAPI) |

---

## Banco Central API

**Base URL:** `https://centralbank.brocoly.cc/api`  
**Ambiente:** siempre `x-environment: test` — **nunca usar prod**

Endpoints usados:
- `POST /accounts` — crear cuenta USD
- `PUT /persons/{cbu}/alias` — asignar alias (limitación: falla para CBUs USD)
- `POST /transactions` — transferencia (funciona con CBUs USD aunque GET /persons los devuelva 404)
- `GET /persons/{cbu}` y `GET /persons/alias/{alias}` — lookup de titular

---

## Módulo de Préstamos (frontend)

El simulador en `dashboard.html` permite:

1. **Slider de monto** ($10.000 – $5.000.000 en pasos de $10.000)
2. **Pills de plazo** (3 / 6 / 12 / 24 / 36 meses)
3. **Panel de resumen en tiempo real**: cuota mensual, TNA, TEA, total intereses, IVA, total a pagar, CFT estimado
4. **Tabla de amortización** (accordion expandible): columnas # / Capital / Interés / Cuota / Saldo
5. **Modal de confirmación** con detalle completo antes de acreditar
6. **Banner de préstamo activo** cuando el usuario ya tiene uno: oculta el simulador y muestra monto, cuotas y cuota mensual

---

## Notas de ambiente

- El proyecto de Supabase puede pausarse por inactividad. Al reanudarlo, el pool puede recibir un error de conexión — el handler `pool.on('error')` evita que el proceso crashee.
- La variable `BANCO_ENV=test` debe estar siempre presente en `.env`.
- El frontend usa `localStorage` para caché del avatar de usuario (clave por `user.id`).
- Las cotizaciones del dólar se cachean en `_dolares` global y se refrescan cada 5 minutos.
