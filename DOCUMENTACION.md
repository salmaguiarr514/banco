# NODO — Documentación

## Tecnologías

- **Backend:** Node.js + Express, corre en `localhost:3000`
- **Base de datos:** PostgreSQL (Supabase)
- **Autenticación:** Supabase Auth con tokens JWT
- **Frontend:** HTML, CSS y JavaScript vanilla
- **IA:** Groq API (modelo llama-3.1-8b-instant)

---

## Cómo correr el proyecto

```bash
cd backend
node server.js
```

Abre `http://localhost:3000/login.html` en el navegador. El backend sirve tanto la API como el frontend.

---

## Archivos principales

```
backend/
  server.js              - Punto de entrada
  src/app.js             - Rutas y configuración de Express
  src/config/db.js       - Conexión a la base de datos, crea las tablas al iniciar
  src/middleware/        - Verificación de tokens
  src/routes/            - Definición de endpoints
  src/controllers/       - Lógica de cada endpoint

frontend/
  login.html             - Pantalla de login y registro
  dashboard.html         - Pantalla principal
  network.js             - Animación de nodos en el fondo
  app.js                 - [DEPRECADO] Monolítico original (referencia)
  styles.css             - [DEPRECADO] CSS monolítico original (referencia)

  css/                   - Estilos modularizados por sección
    base.css             - Variables CSS, reset, utilidades
    login.css            - Pantalla de login / registro
    layout.css           - App shell, sidebar, content-area
    balance.css          - Header, hero saldo, actividad
    mercado.css          - Cotizaciones USD, Reservas
    components.css       - Cards, forms, avatar, dropdown, loader
    modals.css           - Modales USD, QR, canvas network
    transferencias.css   - Modal de transferencia, contactos
    tarjeta.css          - Panel tarjeta, estados, toast, splash
    ui.css               - Preloader, dark mode, responsive
    prestamos.css        - Simulador de préstamos, Mis Préstamos

  js/                    - Lógica modularizada por feature
    config.js            - API_URL, Supabase, globals, showToast
    api.js               - apiFetch, cerrarSesion, copiarAlPortapapeles
    receipt.js           - getReceiptCanvas, downloadReceipt, shareReceipt
    contacts.js          - loadBanks, renderContacts, selectRecipient
    tarjeta.js           - cargarTarjeta, renderTarjeta, cargarHistorialTarjeta
    saldo.js             - loadSaldo, animarSaldo, renderUSDAccount
    mercado.js           - loadMercado, renderCotizacionesUSD, abrirConvertModal
    auth.js              - actualizarIndicadorPerfil, login, registro, logout
    transferencias.js    - openTransferModal/closeTransferModal/toggleOperation, transferForm
    tarjeta-handlers.js  - Toggle panel, emitir, bloquear, revelar PAN/CVV, pagar
    perfil.js            - loadPerfilBtn, aliasForm, perfilForm, passwordForm
    reservas.js          - cargarReservas, abrirReservaDetail, reservaForm
    finanzas.js          - gastosChart, tabs ARS/USD, actividad, modales USD
    ia.js                - Chat IA (Groq/Gemini)
    qr.js                - Generar QR cobrar, escanear QR pagar
    prestamos.js         - Simulador PMT, Mis Préstamos, mora
    main.js              - Seguridad, splash, loadMercado, polling, sidebar nav
```

### Orden de carga (dashboard.html)

```
1. config.js   → globals y Supabase
2. api.js      → apiFetch sobre globals
3. receipt / contacts / tarjeta / saldo / mercado   → funciones externas (sin DOMContentLoaded)
4. auth / transferencias / tarjeta-handlers / perfil / reservas / finanzas / ia / qr / prestamos
   → cada uno registra su propio DOMContentLoaded
5. main.js     → seguridad + carga inicial + sidebar (DOMContentLoaded, debe ir último)
```

---

## Base de datos

El archivo `db.js` crea las tablas automáticamente al arrancar si no existen.

| Tabla | Para qué sirve |
|---|---|
| `usuarios` | Datos del usuario (nombre, email, DNI, etc.) |
| `cuentas` | Cuenta bancaria con CBU, alias, saldo y moneda (ARS o USD). Un usuario puede tener múltiples cuentas, una por moneda |
| `movimientos` | Historial de todos los movimientos (depósitos, transferencias, pagos con tarjeta) |
| `transferencias` | Registro de cada transferencia entre cuentas |
| `reservas` | Reservas de dinero con plazo e interés |
| `cards` | Tarjetas Visa Débito virtuales emitidas por usuario |
| `card_transactions` | Historial de pagos y devoluciones realizados con cada tarjeta |

> Las tablas `cards` y `card_transactions` **no se crean automáticamente** en `db.js`. Hay que ejecutar `backend/migrations/002_cards.sql` en el SQL Editor de Supabase.

---

## API Endpoints

Todos los endpoints (excepto login y registro) requieren el token JWT en el header:
`Authorization: Bearer <token>`

| Ruta | Método | Descripción |
|---|---|---|
| `/api/auth/register` | POST | Crear cuenta nueva |
| `/api/auth/login` | POST | Iniciar sesión |
| `/api/auth/perfil` | PUT | Actualizar datos del perfil |
| `/api/auth/password` | PUT | Cambiar contraseña |
| `/api/cuentas/saldo` | GET | Obtener saldo y datos de todas las cuentas del usuario (ARS + USD si existe) |
| `/api/cuentas/abrir` | POST | Abrir caja de ahorro (`{ moneda: "ARS"\|"USD" }`). Llama a BC `POST /accounts`, asigna alias `nombre.apellido.usd`, crea cuenta local |
| `/api/mercado/dolares` | GET | Cotizaciones del dólar en tiempo real (DolarAPI) — oficial, blue, MEP, CCL, tarjeta, mayorista, cripto |
| `/api/mercado/plazo-fijo` | GET | Tasas de plazo fijo por banco (ArgentinaDatos) |
| `/api/mercado/inflacion` | GET | Último dato de inflación mensual (ArgentinaDatos) |
| `/api/mercado/riesgo-pais` | GET | Último dato de riesgo país en puntos básicos (ArgentinaDatos) |
| `/api/movimientos` | GET | Ver movimientos |
| `/api/movimientos/deposito` | POST | Depositar dinero |
| `/api/transferencias` | POST | Hacer una transferencia |
| `/api/transferencias/sincronizar` | GET | Sincronizar transferencias del Banco Central |
| `/api/reservas` | GET | Ver reservas |
| `/api/reservas` | POST | Crear una reserva |
| `/api/chat` | POST | Enviar mensaje al asistente IA |
| `/api/cards` | GET | Listar tarjetas activas del usuario |
| `/api/cards` | POST | Emitir nueva tarjeta Visa Débito virtual |
| `/api/cards/:id/status` | PATCH | Bloquear o desbloquear tarjeta (`{ status: "active"\|"blocked" }`) |
| `/api/cards/:id` | DELETE | Cancelar tarjeta permanentemente |
| `/api/cards/:id/transactions` | GET | Historial de pagos de una tarjeta |
| `/api/cards/visa/authorize` | POST | Autorizar un pago con tarjeta (débito inmediato) |
| `/api/cards/visa/refund/:txId` | POST | Devolver un pago aprobado |

---

## Arquitectura de navegación (Sidebar Layout)

El dashboard usa una arquitectura de sidebar + secciones de contenido.

```
.app-shell
  header                          ← barra superior con logo, perfil, tema
  .app-body
    nav.sidebar                   ← navegación lateral (sticky)
      Inicio / Tarjetas / Préstamos / Finanzas
    .content-area
      .mora-banner (si aplica)
      section#section-inicio      ← saldo, depósito, actividad
      section#section-tarjetas    ← SOLO la tarjeta Visa (sin modales)
      section#section-prestamos   ← simulador + modal de préstamo
      section#section-finanzas    ← reservas + gastos
      [todos los modales aquí]    ← FUERA de las sections, siempre en DOM activo
```

**Regla crítica — modales fuera de `content-section`:** las secciones inactivas tienen `display: none`, lo que oculta todos sus descendientes incluyendo los `position: fixed`. Por eso todos los modales (`reservaDetailModal`, `transferModal`, `cardPayModal`, `perfilModal`, `aliasModal`, `passwordModal`, asistente IA) viven directamente bajo `.content-area`, después del cierre de `section-tarjetas`.

En **responsive** (`max-width: 720px`) el sidebar se convierte en una barra de tabs horizontal en la parte inferior.

---

## Funcionalidades del dashboard

- **Saldo:** muestra el balance con opción de ocultar, CBU y alias con botón de copiar
- **Transferir:** modal de 2 pasos, busca destinatario por alias o CBU, genera comprobante descargable
- **Depositar:** formulario inline debajo del saldo
- **Sincronizar:** trae transferencias recibidas del Banco Central
- **QR:** escaner para pagar y generador para cobrar
- **Reservas / Rendimientos:** ahorro con TNA 18%, interés **compuesto** diario
  - Fórmula: `valor_actual = monto × (1 + 0.18/365)^días`; ganancia del día n: `monto × (1 + r)^(n-1) × r`
  - Total proyectado al vencimiento: `monto × (1 + r)^diasTotal`, donde `diasTotal = max(días_vencimiento, días_transcurridos)` (nunca retrocede)
  - Cuando `diasRest === 0` se muestra "Reserva finalizada ✓" y se oculta el total estimado
  - Los días se calculan en el momento de render (sin timers). Modelo similar a Mercado Pago: el saldo crece día a día, no segundo a segundo
  - La lista muestra TNA pill, ganancia diaria compuesta y valor actual con 2 decimales
  - El modal de detalle incluye hero con monto + ganancia acumulada, historial día a día (colapsable, ganancia creciente hacia atrás) y botones **Ingresar más** y **Retirar reserva**
  - El campo `fecha_creacion` viene del backend (columna `fecha_creacion TIMESTAMP` en la tabla `reservas`)
- **Caja de ahorro USD:** tarjeta en el dashboard que muestra el saldo en dólares con CBU y alias propios. Debajo del monto muestra el equivalente en ARS al dólar blue. Si no tenés cuenta USD, aparece el botón "Abrir caja de ahorro en USD"
- **Mercado:** sección en el dashboard con datos en tiempo real de fuentes públicas (sin autenticación requerida):
  - **Chips macro:** inflación mensual (ArgentinaDatos) y riesgo país en pb (ArgentinaDatos)
  - **Cotizaciones del dólar:** grilla con compra/venta de oficial, blue, tarjeta, MEP, CCL, mayorista y cripto (DolarAPI). La venta se muestra en verde
  - **Tasas de plazo fijo:** top 8 bancos ordenados por TNA para clientes (ArgentinaDatos)
  - Se refresca automáticamente cada 5 minutos
- **Gastos:** gráfico dona con gastos agrupados por categoría (se filtran las categorías con monto = 0)
- **Préstamos:** simulador con layout en 2 columnas (controles a la izquierda, resultados pegajosos a la derecha)
  - Amortización francesa: `PMT = P × (r×(1+r)^n) / ((1+r)^n - 1)`, TNA 95%, IVA 21% sobre intereses aplicado por cuota
  - **CFT:** calculado via Newton-Raphson IRR sobre los flujos reales `[-monto, PMT₁+IVA₁, …, PMTₙ+IVAₙ]`, anualizado como `(1+TIR_mensual)^12 - 1`. Esperado ~200 % para 6 cuotas a TNA 95 %
  - **Tabla de amortización:** 6 columnas — `#`, `Capital`, `Interés`, `IVA`, `Cuota c/IVA`, `Saldo`. Invariante garantizado: Capital + Interés + IVA = Cuota c/IVA en cada fila
  - **Modal TyC:** modal independiente con TNA, TEA, IVA, arrepentimiento (10 días hábiles), mora, cancelación anticipada. Se abre al clickear el link "Términos y Condiciones" del modal de confirmación
  - **Estilos de botones:** `btn-primary`, `btn-secondary`, `btn-danger` definidos en `components.css` (disponibles en `dashboard.html`). Los mismos nombres en `login.css` aplican sólo al login
  - **Modal de confirmación:** `modal-overlay` / `modal-box` / `modal-close` / `modal-title` / `modal-actions` definidos en `prestamos.css`
  - Límite pre-aprobado: `min(5.000.000, max(100.000, saldoARS × 5))`
  - Con input vacío o en cero muestra `—` en todos los campos y deshabilita el botón y el acordeón
  - Si el monto supera el límite: borde rojo en el input + mensaje de error inline; el botón se deshabilita
  - La TNA se atenúa (`.muted`) cuando el input está vacío
- **Tarjeta Visa Débito Virtual:** emitir, bloquear/desbloquear, simular pago en comercio o a persona, devoluciones, historial de transacciones
  - BIN `453998` (Visa), PAN de 16 dígitos con Luhn válido
  - CVV y PAN visibles con botón de revelar (almacenados en texto plano en columnas `cvv` y `pan`)
  - Límite diario configurable (default $50.000 ARS)
  - **Pago a comercio:** ingresás nombre del comercio y categoría
  - **Pago a persona:** buscás por alias o CBU (igual que una transferencia); registra la operación en el Banco Central API (`crearTransaccion`) para que el banco destino la sincronice; si además la cuenta es local, acredita directamente
  - Los pagos generan un `movimiento` de tipo `pago_tarjeta` y se reflejan en el balance
  - Las devoluciones generan un `movimiento` de tipo `devolucion_tarjeta`
  - El botón **Dar de baja tarjeta** vive dentro del panel de datos de la tarjeta (no como botón flotante separado)
- **Perfil:** editar datos, cambiar alias y contraseña (cada uno abre un modal)
- **Asistente IA:** chat flotante con Groq (Llama 3), responde consultas sobre el banco

---

## Variables de entorno (.env)

```
PORT=3000
DATABASE_URL=...
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
BANCO_API_KEY=...
BANCO_TOKEN=...
BANCO_URL=...
GROQ_API_KEY=...       - API key de Groq para el asistente IA
```

---

## Temas (claro / oscuro)

El tema se guarda en `localStorage` con la clave `nodo_theme`. Cambia aplicando el atributo `data-theme="dark"` al elemento `html`. La animacion de nodos del fondo tambien actualiza sus colores al cambiar de tema.

---

## Card Engine — Flujo de autorización

```
Usuario hace clic en "Pagar con tarjeta"
  → Elige tab: Comercio  →  ingresa nombre + categoría
              Persona    →  busca alias/CBU (resolución en tiempo real)

  → POST /api/cards/visa/authorize  { cardId, merchantName, merchantCategory, amount, cbuDestino? }
      → Verifica: tarjeta activa, no vencida
      → Verifica: saldo >= monto
      → Verifica: gasto diario + monto <= límite diario
      → UPDATE cuentas SET saldo = saldo - monto  (débito origen)
      → Si cbuDestino (pago a persona):
          → crearTransaccion en Banco Central API  ← igual que transferencia normal
          → INSERT movimientos (tipo: pago_tarjeta, referencia = transaccionId del BC)
          → Si cuenta destino es local: UPDATE saldo + INSERT movimientos (tipo: transferencia_recibida)
      → Si no hay cbuDestino (pago a comercio):
          → INSERT movimientos (tipo: pago_tarjeta, referencia = authCode)
      → INSERT card_transactions (status: approved)
      → Retorna authorizationCode + newBalance
  → Frontend actualiza saldo y muestra toast con auth code
```

---

## Capas y z-index

| Elemento | z-index | Notas |
|---|---|---|
| `canvas.dash-network` | -1 | Animación de nodos; siempre detrás del contenido |
| `.app-shell`, `.card`, `.balance-hero` | 1 | Contenido principal |
| `.header` | 10 | Barra superior |
| `.sidebar` | 10 | Navegación lateral |
| Modales (`position: fixed`) | 2000 | Siempre fuera de `content-section` para no ser ocultados por `display: none` del padre |

---

## Bugs conocidos

| Bug | Estado |
|---|---|
| CORS abierto a todos los origenes | Pendiente (solo importa en produccion) |
| "Ingresar más" en modal de reserva | Placeholder (toast); flujo completo pendiente |
