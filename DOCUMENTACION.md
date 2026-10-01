# NODO — Documentación

NODO es una aplicación de homebanking con backend en Node.js, base de datos en Supabase y frontend en HTML/CSS/JS.

---

## Cómo correr el proyecto

```bash
cd backend
node server.js
```

Abrí `http://localhost:3000/login.html` en el navegador.  
El backend sirve tanto la API como el frontend desde el mismo servidor.

**En producción:** el sitio está publicado en Vercel. Hacer push a `main` en GitHub despliega automáticamente.

---

## Variables de entorno (`backend/.env`)

| Variable | Para qué sirve |
|---|---|
| `PORT` | Puerto del servidor (default 3000) |
| `DATABASE_URL` | URL de conexión a Supabase/PostgreSQL |
| `SUPABASE_URL` | URL del proyecto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave de servicio de Supabase (para autenticación) |
| `BANCO_API_KEY` | Clave para la API del Banco Central |
| `BANCO_TOKEN` | Token adicional del Banco Central |
| `BANCO_URL` | URL base de la API del Banco Central |
| `BANCO_ENV` | **Siempre `test`** — nunca cambiar a producción |
| `GROQ_API_KEY` | Clave para el asistente IA (Groq/Llama) |
| `NODO_BANK_CODE` | Código del banco NODO en el sistema del BC |
| `BANK_REGISTRY_JSON` | Mapa de códigos de banco → URL base (para descubrir claves QR de otros bancos) |

---

## Estructura de archivos

```
backend/
  server.js              → Punto de entrada local
  vercel.js              → Punto de entrada en Vercel (producción)
  src/app.js             → Rutas y configuración de Express
  src/config/db.js       → Conexión a la base de datos
  src/routes/            → Definición de endpoints
  src/controllers/       → Lógica de cada endpoint

frontend/
  login.html             → Pantalla de login y registro
  dashboard.html         → Pantalla principal

  css/
    base.css             → Variables de color, reset general
    login.css            → Estilos del login
    layout.css           → Sidebar, barra superior, estructura
    balance.css          → Hero de saldo, panel de actividad
    mercado.css          → Cotizaciones, reservas
    components.css       → Cards, formularios, avatar
    modals.css           → Modales USD y QR
    transferencias.css   → Modal de transferencia
    tarjeta.css          → Panel de tarjeta
    ui.css               → Preloader, dark mode, responsive, dropdown perfil
    prestamos.css        → Simulador de préstamos

  js/
    config.js            → API_URL, Supabase, showToast, variables globales
    api.js               → apiFetch (todas las llamadas al backend van por acá)
    saldo.js             → Carga y muestra el saldo ARS y USD
    mercado.js           → Cotizaciones, comprar/vender USD, transferir USD
    auth.js              → Login, registro, logout, panel de actividad
    transferencias.js    → Modal de transferencia en pesos
    tarjeta.js           → Carga datos de la tarjeta Visa
    tarjeta-handlers.js  → Emitir, bloquear, revelar datos, pagar con tarjeta
    perfil.js            → Editar perfil, alias, contraseña
    reservas.js          → Ver y crear reservas de ahorro
    finanzas.js          → Gráfico de gastos, tabs ARS/USD
    qr.js                → Generar QR para cobrar, escanear QR para pagar
    prestamos.js         → Simulador de cuotas, Mis Préstamos
    contacts.js          → Buscar destinatarios por alias o CBU
    bankKeys.js          → Claves públicas de otros bancos (para verificar QR)
    ia.js                → Chat con asistente IA
    main.js              → Seguridad, carga inicial, sidebar (va último)
```

---

## Base de datos

Las tablas se crean automáticamente al arrancar, excepto `cards` y `card_transactions` que hay que ejecutar manualmente (`backend/migrations/002_cards.sql` en el SQL Editor de Supabase).

| Tabla | Para qué sirve |
|---|---|
| `usuarios` | Datos del usuario (nombre, email, DNI, etc.) |
| `cuentas` | Cuenta bancaria con CBU, alias, saldo y moneda (ARS o USD) |
| `movimientos` | Historial de todos los movimientos |
| `transferencias` | Registro de cada transferencia entre cuentas |
| `reservas` | Dinero reservado con plazo e interés |
| `cards` | Tarjetas Visa Débito virtuales |
| `card_transactions` | Historial de pagos con tarjeta |

---

## Endpoints de la API

Todos requieren el header `Authorization: Bearer <token>`, excepto login y registro.

### Autenticación
| Ruta | Método | Qué hace |
|---|---|---|
| `/api/auth/register` | POST | Crear cuenta nueva |
| `/api/auth/login` | POST | Iniciar sesión |
| `/api/auth/perfil` | PUT | Actualizar datos del perfil |
| `/api/auth/password` | PUT | Cambiar contraseña |

### Cuentas y saldo
| Ruta | Método | Qué hace |
|---|---|---|
| `/api/cuentas/saldo` | GET | Ver saldo ARS y USD |
| `/api/cuentas/abrir` | POST | Abrir cuenta (`{ moneda: "ARS" o "USD" }`) |
| `/api/cuentas/convertir` | POST | Comprar o vender dólares |
| `/api/cuentas/transferir-usd` | POST | Transferir USD a otra cuenta |

### Movimientos y transferencias
| Ruta | Método | Qué hace |
|---|---|---|
| `/api/movimientos` | GET | Ver historial de movimientos |
| `/api/movimientos/deposito` | POST | Depositar dinero |
| `/api/transferencias` | POST | Hacer una transferencia en pesos |
| `/api/transferencias/sincronizar` | GET | Traer transferencias recibidas del Banco Central |

### Mercado
| Ruta | Método | Qué hace |
|---|---|---|
| `/api/mercado/dolares` | GET | Cotizaciones del dólar en tiempo real |
| `/api/mercado/plazo-fijo` | GET | Tasas de plazo fijo por banco |
| `/api/mercado/inflacion` | GET | Último dato de inflación |
| `/api/mercado/riesgo-pais` | GET | Riesgo país actual |

### Tarjeta Visa
| Ruta | Método | Qué hace |
|---|---|---|
| `/api/cards` | GET | Ver tarjetas del usuario |
| `/api/cards` | POST | Emitir nueva tarjeta |
| `/api/cards/:id/status` | PATCH | Bloquear o desbloquear |
| `/api/cards/:id` | DELETE | Cancelar tarjeta |
| `/api/cards/:id/transactions` | GET | Historial de pagos |
| `/api/cards/visa/authorize` | POST | Pagar con tarjeta |
| `/api/cards/visa/refund/:txId` | POST | Devolver un pago |

### QR
| Ruta | Método | Qué hace |
|---|---|---|
| `/api/qr/firmar` | POST | Generar un QR firmado para cobrar |
| `/api/qr/public-key` | GET | Exponer la clave pública de NODO (para que otros bancos verifiquen nuestros QR) |
| `/api/qr/discover/:bankCode` | GET | Obtener la clave pública de otro banco automáticamente |

### Otros
| Ruta | Método | Qué hace |
|---|---|---|
| `/api/reservas` | GET | Ver reservas |
| `/api/reservas` | POST | Crear una reserva |
| `/api/chat` | POST | Enviar mensaje al asistente IA |

---

## Funcionalidades

### Saldo y cuentas
- Muestra el balance en ARS y USD con opción de ocultar
- Muestra CBU y alias con botón de copiar
- Si no tenés cuenta USD, aparece el botón para abrirla

### Transferencias en pesos
- Modal de 2 pasos: primero buscás el destinatario por alias o CBU, después ingresás el monto
- Genera un comprobante descargable al finalizar

### Transferencias en dólares
- Mismo flujo de 2 pasos pero para cuentas USD
- Muestra el equivalente en ARS al tipo de cambio blue como referencia

### Sincronizar transferencias recibidas
- El Banco Central no actualiza tu saldo automáticamente cuando alguien te transfiere
- El botón "Sincronizar" o el endpoint `/api/transferencias/sincronizar` trae esas transferencias y actualiza tu saldo
- Es seguro ejecutarlo varias veces: no duplica datos

### QR — Cobrar
- Generás un QR con tu CBU y un monto opcional
- Podés elegir cobrar en ARS o en USD
- El QR está firmado digitalmente para que el pagador pueda verificar que es tuyo

### QR — Pagar
- Escaneás el QR de otro usuario con la cámara
- Si el QR viene de un banco conocido, se verifica la firma automáticamente
- Si viene de un banco desconocido, el sistema intenta obtener su clave pública automáticamente (auto-discovery)
- Al confirmar, se abre el modal de transferencia ya pre-completado con los datos del destinatario
- Soporta QR en ARS y en USD

### Cotizaciones del mercado
- Dólar oficial, blue, tarjeta, MEP, CCL, mayorista y cripto (se actualiza cada 5 minutos)
- Inflación mensual y riesgo país
- Tasas de plazo fijo de los principales bancos

### Comprar/Vender dólares
- Convertís pesos a dólares (o al revés) usando el tipo de cambio blue de referencia
- La operación actualiza tu saldo al instante

### Reservas de ahorro
- Separás dinero con un nombre, monto y plazo
- Genera interés compuesto diario (TNA 18%)
- Podés ver el crecimiento día a día y retirar cuando quieras

### Tarjeta Visa Débito Virtual
- Emitís una tarjeta virtual al instante
- Podés bloquearla temporalmente o cancelarla
- Simulás pagos a comercios o transferencias a personas
- Historial de transacciones con devoluciones

### Préstamos
- Simulador con cuotas a 3, 6, 12, 24 o 36 meses
- Muestra cuota mensual, TNA, TEA y CFT antes de pedir
- Límite pre-aprobado basado en tu saldo

### Asistente IA
- Chat flotante con Llama 3 (Groq)
- Responde consultas sobre el banco y tus datos

### Perfil
- Editás nombre, teléfono, dirección
- Cambiás alias y contraseña desde modales separados
- La barra de progreso del perfil muestra qué tan completo está

### Tema claro/oscuro
- Se guarda en `localStorage` con la clave `nodo_theme`
- Aplica el atributo `data-theme="dark"` al elemento `html`

---

## Bugs conocidos

| Bug | Estado |
|---|---|
| CORS abierto a todos los orígenes | Pendiente (solo importa en producción) |
| "Ingresar más" en modal de reserva | Placeholder (muestra toast); flujo completo pendiente |
