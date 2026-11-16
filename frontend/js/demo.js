// ── Cuenta demo ──
// Todo es ficticio y vive en este navegador: las llamadas a /api y a Supabase se responden acá
// y nunca llegan al servidor ni a la base. Se carga antes que config.js para que el cliente de
// Supabase se cree ya con el fetch interceptado.
(() => {
  const FLAG   = 'nodo_demo';
  const PREFIX = 'nodo_demo:';
  const SHARED = new Set(['nodo_theme']);   // claves que la demo comparte con la cuenta real

  const proto = Storage.prototype;
  const orig  = { get: proto.getItem, set: proto.setItem, remove: proto.removeItem };

  let active = false;
  try { active = sessionStorage.getItem(FLAG) === '1'; } catch {}

  const clearDemoStorage = () => {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX)) keys.push(k);
    }
    keys.forEach(k => orig.remove.call(localStorage, k));
  };

  const enter = () => {
    clearDemoStorage();
    sessionStorage.setItem(FLAG, '1');
    sessionStorage.setItem('justLoggedIn', '1');
    window.location.href = 'dashboard.html';
  };

  const exit = () => {
    clearDemoStorage();
    sessionStorage.removeItem(FLAG);
  };

  window.NodoDemo = { get active() { return active; }, enter, exit, patchAuth() {} };

  if (!active) {
    document.addEventListener('DOMContentLoaded', () => {
      document.getElementById('demoBtn')?.addEventListener('click', enter);
    });
    return;
  }

  // ── localStorage separado: la demo nunca lee ni pisa datos de la cuenta real ──
  const key = (store, k) => (store === window.localStorage && !SHARED.has(k) ? PREFIX + k : k);
  proto.getItem    = function (k)    { return orig.get.call(this, key(this, k)); };
  proto.setItem    = function (k, v) { return orig.set.call(this, key(this, k), v); };
  proto.removeItem = function (k)    { return orig.remove.call(this, key(this, k)); };

  // ── Utilidades ──
  const DAY = 86400000;
  const now = () => new Date().toISOString();
  const ago = (days, hours = 0) => new Date(Date.now() - days * DAY - hours * 3600000).toISOString();
  const inDays = (days) => new Date(Date.now() + days * DAY).toISOString().slice(0, 10);
  const round2 = (n) => Math.round(n * 100) / 100;
  const money = (n) => Math.round(n).toLocaleString('es-AR');
  const cuotaDe = (monto, cuotas, tna) => { const r = tna / 12; return monto * (r * (1 + r) ** cuotas) / ((1 + r) ** cuotas - 1); };
  const luhn = (partial) => {
    let sum = 0;
    partial.split('').map(Number).forEach((d, i, a) => {
      if ((a.length - i) % 2 === 1) { d *= 2; if (d > 9) d -= 9; }
      sum += d;
    });
    return (10 - (sum % 10)) % 10;
  };
  const newPan = () => { const p = '453998' + Array.from({ length: 9 }, () => Math.floor(Math.random() * 10)).join(''); return p + luhn(p); };
  const authCode = () => Math.random().toString(16).slice(2, 8).toUpperCase();
  const txId = () => 'DEMO-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();

  const TASAS = { pf: 0.32, badlar: 0.30, caucion: 0.50, prestamo: 0.85, cclVenta: 1450, cclCompra: 1420 };

  // Personas ficticias a las que se puede transferir (incluye los "sugeridos" del modal)
  const DIRECTORIO = [
    { nombre: 'Lucas',     apellido: 'Pérez',     alias: 'lucas.perez.nodo',      cbu: '0000003100011122233344', bankCode: 31, bankName: 'NODO' },
    { nombre: 'Valentina', apellido: 'García',    alias: 'valentina.garcia.nodo', cbu: '0000003100022233344455', bankCode: 31, bankName: 'NODO' },
    { nombre: 'Mateo',     apellido: 'López',     alias: 'mateo.lopez.nodo',      cbu: '0000003100033344455566', bankCode: 31, bankName: 'NODO' },
    { nombre: 'Sofía',     apellido: 'Martínez',  alias: 'sofia.martinez.nodo',   cbu: '0000003100055566677788', bankCode: 31, bankName: 'NODO' },
    { nombre: 'Lucía',     apellido: 'Fernández', alias: 'lucia.fernandez',       cbu: '0110599520000001234567', bankCode: 11, bankName: 'Banco Nación' },
    { nombre: 'Tomás',     apellido: 'Rivero',    alias: 'tomas.rivero',          cbu: '0070089420000009876543', bankCode: 7,  bankName: 'Banco Galicia' },
    { nombre: 'Café',      apellido: 'Central',   alias: 'cafe.central',          cbu: '0000003100099911122233', bankCode: 31, bankName: 'NODO' },
  ];
  const DIRECTORIO_USD = [
    { nombre: 'Lucía', apellido: 'Fernández', alias: 'lucia.fernandez.usd', cbu: '0110599520000001234574' },
    { nombre: 'Tomás', apellido: 'Rivero',    alias: 'tomas.rivero.usd',    cbu: '0070089420000009876550' },
  ];
  const BANCOS = [{ bankCode: 31, name: 'NODO' }, { bankCode: 11, name: 'Banco Nación' }, { bankCode: 7, name: 'Banco Galicia' }];

  // ── Estado inicial ──
  const seed = () => {
    const s = {
      seq: 100, startedAt: Date.now(), incomingDone: false, meta: {},
      user: { id: 'demo-user', nombre: 'Raul', apellido: 'Borda', email: 'demo@nodo-homebanking.com', dni: '30123456', telefono: '1155550123', direccion: 'Av. Corrientes 1234, CABA' },
      cuentas: [
        { id: 1, numero_cuenta: 'NODO-000001', cbu: '0000003100047281935562', alias: 'raul.borda.ars', tipo_cuenta: 'caja_ahorro', saldo: 1248350.75, moneda: 'ARS', estado: 'activa' },
        { id: 2, numero_cuenta: 'NODO-000002', cbu: '0000003100047281935579', alias: 'raul.borda.usd', tipo_cuenta: 'caja_ahorro', saldo: 1520, moneda: 'USD', estado: 'activa' },
      ],
      movimientos: [], cards: [], cardTx: [], prestamos: [], pf: [], cauciones: [], reservas: [],
    };

    // Movimientos de ejemplo, del más nuevo al más viejo; los saldos se reconstruyen hacia atrás
    const cuotaPrestamo = cuotaDe(300000, 12, TASAS.prestamo);
    const ejemplos = [
      [1, 'transferencia_recibida', 185000,  'Transferencia de Estudio Ríos · Banco Galicia', ago(1, 3)],
      [1, 'pago_tarjeta',          -6400,    'Pago con tarjeta · Café Central',               ago(1, 9)],
      [1, 'debito',                 5000,    'Recarga Movistar - 1155550123',                 ago(2, 2)],
      [1, 'debito',                 40000,   'Reserva creada — Vacaciones',                   ago(3, 5)],
      [1, 'transferencia_enviada', -18500,   'Pago factura internet',                         ago(5, 4)],
      [1, 'pago_tarjeta',          -27850,   'Pago con tarjeta · Supermercado Día',           ago(7, 1)],
      [1, 'transferencia_enviada', -12000,   'Uber · viajes de la semana',                    ago(9, 6)],
      [1, 'debito',                 100000,  `Plazo Fijo 30 días — ${(TASAS.pf * 100).toFixed(1)}% TNA`, ago(23, 2)],
      [1, 'credito',                300000,  `Préstamo NODO — 12 cuotas de $${money(cuotaPrestamo)}`,  ago(25, 3)],
      [1, 'conversion_salida',      169800,  'Compra U$D 120.00 @ $1.415',                    ago(26, 1)],
      [2, 'conversion_entrada',     120,     'Compra U$D 120.00 @ $1.415',                    ago(26, 1)],
      [2, 'transferencia_recibida', 1400,    'Transferencia USD recibida',                    ago(27, 5)],
      [1, 'deposito',               500000,  'Deposito ficticio',                             ago(28, 2)],
    ];
    const running = Object.fromEntries(s.cuentas.map(c => [c.id, c.saldo]));
    ejemplos.forEach(([cuentaId, tipo, monto, descripcion, fecha], i) => {
      const efecto = esIngreso(tipo) ? Math.abs(monto) : -Math.abs(monto);
      const posterior = running[cuentaId];
      const anterior = round2(posterior - efecto);
      running[cuentaId] = anterior;
      s.movimientos.push({ id: 200 - i, cuenta_id: cuentaId, tipo, monto, descripcion, saldo_anterior: anterior, saldo_posterior: posterior, referencia: null, fecha_movimiento: fecha });
    });

    const pan = newPan();
    const vto = new Date();
    s.cards.push({ id: 1, last_four: pan.slice(-4), pan_masked: `${pan.slice(0, 4)} **** **** ${pan.slice(-4)}`, pan, bin: '453998',
      expiry_month: vto.getMonth() + 1, expiry_year: vto.getFullYear() + 3, cvv: '381', status: 'active', daily_limit: 50000, created_at: ago(30) });
    s.cardTx.push(
      { id: 2, card_id: 1, merchant_name: 'Café Central',     merchant_category: 'gastronomia',  amount: 6400,  currency: 'ARS', status: 'approved', authorization_code: authCode(), created_at: ago(1, 9) },
      { id: 1, card_id: 1, merchant_name: 'Supermercado Día', merchant_category: 'supermercado', amount: 27850, currency: 'ARS', status: 'approved', authorization_code: authCode(), created_at: ago(7, 1) },
    );
    s.prestamos.push({ id: 1, usuario_id: 'demo-user', cuenta_acreditada_id: 1, monto: 300000, cuotas: 12, tna: TASAS.prestamo,
      cuota_mensual: round2(cuotaPrestamo), estado: 'activo', cuotas_pagadas: 0, fecha_proximo_vencimiento: inDays(5), fecha_solicitud: ago(25, 3) });
    s.pf.push({ id: 1, cuenta_id: 1, monto: 100000, tna: TASAS.pf, dias: 30, fecha_inicio: ago(23, 2), fecha_vencimiento: inDays(7), estado: 'activo' });
    s.reservas.push({ id: 1, cuenta_id: 1, nombre: 'Vacaciones', monto: 40000, fecha_vencimiento: inDays(60), fecha_creacion: ago(3, 5) });
    return s;
  };

  const STATE_KEY = PREFIX + 'state';
  let S;
  try { S = JSON.parse(orig.get.call(localStorage, STATE_KEY)); } catch {}
  if (!S) {
    S = seed();
    orig.set.call(localStorage, PREFIX + 'user', JSON.stringify(S.user));
    orig.set.call(localStorage, PREFIX + 'nodo_recientes', JSON.stringify(DIRECTORIO.slice(4, 6)));
  }
  const save = () => { try { orig.set.call(localStorage, STATE_KEY, JSON.stringify(S)); } catch {} };
  save();

  // ── Helpers de dominio ──
  function esIngreso(tipo) {
    return ['credito', 'deposito', 'transferencia_recibida', 'conversion_entrada', 'devolucion_tarjeta'].includes(tipo);
  }
  const nextId = () => ++S.seq;
  const cuenta = (moneda) => S.cuentas.find(c => c.moneda === moneda);
  const cuentaPorId = (id) => S.cuentas.find(c => c.id === Number(id));
  const resumen = (c) => ({ ...c, nombre_cuenta: `Cuenta ${c.id}` });
  const mover = (c, tipo, monto, descripcion, nuevoSaldo, referencia = null) => {
    S.movimientos.unshift({ id: nextId(), cuenta_id: c.id, tipo, monto: round2(monto), descripcion, saldo_anterior: c.saldo,
      saldo_posterior: round2(nuevoSaldo), referencia, fecha_movimiento: now() });
    c.saldo = round2(nuevoSaldo);
  };
  const ok = (body, status = 200) => ({ status, body });
  const fail = (status, message, extra = {}) => ({ status, body: { message, ...extra } });
  const normCbu = (v) => String(v || '').trim().padStart(22, '0');
  const buscarPersona = (valor) => {
    const v = String(valor || '').trim().toLowerCase();
    return DIRECTORIO.find(p => p.alias === v || p.cbu === normCbu(v));
  };
  // Destinatarios reales: se busca el nombre en el Banco Central (solo lectura, /api/demo).
  // La transferencia igual queda solo en la demo: no le llega a nadie.
  const cacheReal = new Map();
  const buscarReal = async (valor) => {
    const v = String(valor || '').trim().toLowerCase();
    if (cacheReal.has(v)) return cacheReal.get(v);
    let persona = null;
    try {
      const r = await realFetch(`${window.location.origin}/api/demo/persona/${encodeURIComponent(v)}`);
      if (r.ok) persona = await r.json();
      else if (r.status !== 404) persona = undefined;   // Banco Central no disponible
    } catch { persona = undefined; }
    if (persona !== undefined) cacheReal.set(v, persona);
    return persona;
  };
  const resolverDestino = async (valor) => {
    const local = buscarPersona(valor);
    if (local) return local;
    const real = await buscarReal(valor);
    if (real) return { ...real, bankName: real.bankName || (real.bankCode ? `Banco ${real.bankCode}` : null) };
    if (real === null) return null;
    // Sin respuesta del Banco Central: un CBU igual se acepta con nombre genérico
    return /^\d{22}$/.test(String(valor).trim())
      ? { nombre: 'Destinatario', apellido: 'externo', alias: null, cbu: normCbu(valor), bankCode: null, bankName: 'Otro banco' }
      : null;
  };
  const dolarBlue = async () => {
    try {
      const data = await realFetch(`${location.origin}/api/mercado/dolares`).then(r => r.json());
      const blue = Array.isArray(data) && data.find(d => d.casa === 'blue');
      if (blue?.compra && blue?.venta) return { compra: Number(blue.compra), venta: Number(blue.venta) };
    } catch {}
    return { compra: 1395, venta: 1415 };
  };

  // ── Respuestas del asistente (sin IA real en la demo) ──
  const RESPUESTAS = [
    [/saldo|cuanto tengo|plata/, 'Tu saldo en pesos aparece arriba de todo en Inicio. Tocá el ojo para mostrarlo u ocultarlo.'],
    [/transfer|enviar|cbu|alias/, 'Para transferir tocá "Transferir" en Inicio, elegí un contacto o escribí un CBU o alias, poné el monto y confirmá.'],
    [/plazo fijo|invert|caucion|cedear/, 'En Inversiones podés armar un plazo fijo a 30, 60 o 90 días. El interés se calcula día a día y se cobra al vencimiento.'],
    [/tarjeta|bloque|visa/, 'En Tarjetas podés bloquear tu Visa Débito con un toque. Mientras está bloqueada, cualquier pago se rechaza.'],
    [/prestamo|cuota/, 'En Préstamos simulás el monto y las cuotas, y ves la cuota exacta antes de pedirlo.'],
    [/dolar|usd|cotiz/, 'En la cuenta en dólares podés comprar y vender al instante con la cotización del día.'],
    [/reserva|ahorr/, 'Las reservas te sirven para apartar plata con un objetivo. Las ves en tu perfil, en Reservas.'],
    [/recarga|celular|sube/, 'En Recargas elegís la compañía, el número y el monto, y la recarga se hace al momento.'],
  ];
  const responder = (texto) => {
    const t = String(texto || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const hit = RESPUESTAS.find(([re]) => re.test(t));
    return hit ? hit[1] : 'Estoy en modo demo, así que respondo dudas generales: transferencias, tarjeta, plazo fijo, préstamos, dólares, reservas o recargas. ¿Sobre cuál querés saber?';
  };

  // ── Rutas ──
  const RUTAS = [];
  const on = (method, pattern, handler) => RUTAS.push({ method, re: new RegExp(`^${pattern}$`), handler });

  // Cuentas
  on('GET', '/cuentas(?:/saldo)?', () => ok(S.cuentas.map(resumen)));
  on('POST', '/cuentas/depositar', ({ cuenta_id, monto }) => {
    const c = cuentaPorId(cuenta_id) || cuenta('ARS'); const m = Number(monto);
    if (!m || m <= 0) return fail(400, 'Cuenta ID y monto positivo requeridos');
    mover(c, 'deposito', m, 'Deposito ficticio', c.saldo + m);
    return ok({ message: 'Deposito realizado', nuevo_saldo: c.saldo, auto_debito: null });
  });
  on('POST', '/cuentas/abrir', ({ moneda }) => {
    if (!['ARS', 'USD'].includes(moneda)) return fail(400, 'Moneda debe ser ARS o USD');
    const existente = cuenta(moneda);
    if (existente) return ok({ message: 'Ya existe una cuenta en esa moneda', cuenta: resumen(existente) });
    const c = { id: nextId(), numero_cuenta: `NODO-${S.seq}`, cbu: '00000031000' + String(Date.now()).slice(-11), alias: `raul.borda.${moneda.toLowerCase()}`,
      tipo_cuenta: 'caja_ahorro', saldo: 0, moneda, estado: 'activa' };
    S.cuentas.push(c);
    return ok({ message: `Caja de ahorro en ${moneda} abierta`, cuenta: resumen(c) }, 201);
  });
  on('POST', '/cuentas/convertir', async ({ de, a, monto }) => {
    const m = Number(monto);
    if (!['ARS', 'USD'].includes(de) || !['ARS', 'USD'].includes(a) || de === a || !m || m <= 0) return fail(400, 'Parámetros inválidos');
    const { compra, venta } = await dolarBlue();
    const tasa = de === 'ARS' ? venta : compra;
    const usd = de === 'ARS' ? m / tasa : m;
    const ars = de === 'ARS' ? m : m * tasa;
    const origen = cuenta(de), dest = cuenta(a);
    if (!dest) return fail(404, `No tenés cuenta en ${a}. Abrila primero.`);
    const debitado = de === 'ARS' ? ars : usd, acreditado = a === 'ARS' ? ars : usd;
    if (origen.saldo < debitado) return fail(400, 'Saldo insuficiente');
    const desc = `${de === 'ARS' ? 'Compra' : 'Venta'} U$D ${usd.toFixed(2)} @ $${tasa.toLocaleString('es-AR')}`;
    mover(origen, 'conversion_salida', debitado, desc, origen.saldo - debitado);
    mover(dest, 'conversion_entrada', acreditado, desc, dest.saldo + acreditado);
    return ok({ message: desc, tasa, saldoOrigen: origen.saldo, saldoDest: dest.saldo });
  });
  on('GET', '/cuentas/buscar-usd/(.+)', (_, valor) => {
    const v = valor.trim().toLowerCase();
    const p = DIRECTORIO_USD.find(x => x.alias === v || x.cbu === normCbu(v));
    return ok(p ? { found: true, ...p } : { found: false, message: 'No se encontró una cuenta USD con ese CBU o alias' });
  });
  on('PUT', '/cuentas/alias-usd', ({ alias }) => {
    if (!alias) return fail(400, 'El alias es obligatorio');
    if (!/^[a-z0-9.-]+$/.test(alias)) return fail(400, 'Formato inválido. Solo letras minúsculas, números, puntos y guiones.');
    const c = cuenta('USD');
    if (!c) return fail(404, 'No tenés cuenta en USD');
    if (alias === c.alias) return fail(400, 'El alias nuevo es igual al actual');
    c.alias = alias;
    return ok({ message: 'Alias USD actualizado', alias });
  });
  on('POST', '/cuentas/transferir-usd', ({ cbuDestino, monto }) => {
    const m = Number(monto); const c = cuenta('USD');
    if (!cbuDestino || !m || m <= 0) return fail(400, 'CBU destino y monto positivo requeridos');
    if (!c) return fail(404, 'No tenés cuenta en USD');
    if (c.saldo < m) return fail(400, 'Saldo insuficiente');
    if (normCbu(c.cbu) === normCbu(cbuDestino)) return fail(400, 'No podés transferirte a vos mismo');
    const p = DIRECTORIO_USD.find(x => x.cbu === normCbu(cbuDestino));
    const nombre = p ? `${p.nombre} ${p.apellido}` : null; const ref = txId();
    mover(c, 'transferencia_enviada', -m, `Transferencia USD a ${nombre || normCbu(cbuDestino)}`, c.saldo - m, ref);
    return ok({ message: `Transferencia USD exitosa${nombre ? ` a ${nombre}` : ''}`, transaccionId: ref, nuevoSaldo: c.saldo });
  });
  on('POST', '/cuentas/recarga-celular', ({ cuenta_id, operador, numero_celular, monto }) => {
    const m = Number(monto); const tel = String(numero_celular || '').replace(/\D/g, '');
    if (!['Movistar', 'Personal', 'Claro', 'Tuenti'].includes(operador)) return fail(400, 'Operador no válido. Debe ser Movistar, Personal, Claro o Tuenti.');
    if (tel.length < 10 || tel.length > 12) return fail(400, 'El número debe tener entre 10 y 12 dígitos (sin 0 ni 15).');
    if (!m || m <= 0) return fail(400, 'El monto debe ser mayor a cero.');
    const c = cuentaPorId(cuenta_id) || cuenta('ARS');
    if (c.saldo < m) return fail(400, 'Saldo insuficiente para realizar la recarga.', { approved: false, saldo_disponible: c.saldo, monto_solicitado: m });
    const anterior = c.saldo;
    mover(c, 'debito', m, `Recarga ${operador} - ${tel}`, c.saldo - m);
    return ok({ approved: true, message: 'Recarga realizada con éxito', comprobante: `REC-${Date.now().toString().slice(-6)}${Math.floor(1000 + Math.random() * 9000)}`,
      operador, numero_celular: tel, monto: m, saldo_anterior: anterior, nuevo_saldo: c.saldo, fecha: now() });
  });

  // Movimientos y perfil
  on('GET', '/movimientos', () => ok(S.movimientos.slice(0, 100).map(m => ({ ...m, moneda: cuentaPorId(m.cuenta_id)?.moneda || 'ARS' }))));
  on('POST', '/auth/(?:login|register)', () => fail(400, 'Estás usando la cuenta demo. Cerrá sesión para ingresar con tu cuenta.'));
  on('PUT', '/auth/perfil', ({ alias, nombre, apellido, telefono, direccion }) => {
    const c = cuenta('ARS');
    if (alias && alias !== c.alias) {
      if (!/^[a-z0-9.-]+$/.test(alias)) return fail(400, 'Formato de alias inválido. Solo se permiten letras minúsculas, números, puntos y guiones.');
      c.alias = alias;
    }
    Object.entries({ nombre, apellido, telefono, direccion }).forEach(([k, v]) => { if (v) S.user[k] = v; });
    return ok({ message: 'Perfil actualizado correctamente', user: S.user, alias: c.alias });
  });
  on('PUT', '/auth/password', ({ currentPassword, newPassword }) => {
    if (!currentPassword || !newPassword) return fail(400, 'Contraseña actual y nueva son obligatorias');
    return ok({ message: 'Contraseña actualizada correctamente (cuenta demo: no se guarda)' });
  });
  on('GET', '/auth/gastos-categoria', () => {
    const cat = { inversiones: 0, transporte: 0, comida: 0, recargas: 0, servicios: 0, otros: 0 };
    const words = {
      inversiones: ['plazo fijo', 'cauci', 'reserva creada', 'cedear'],
      recargas: ['recarga', 'movistar', 'personal claro', 'tuenti', 'celular'],
      transporte: ['transporte', 'taxi', 'uber', 'combustible', 'nafta', 'gasolina', 'subte', 'colectivo', 'tren', 'peaje', 'estacionamiento'],
      comida: ['comida', 'restaurante', 'supermercado', 'almuerzo', 'cena', 'desayuno', 'kiosko', 'panaderia', 'carniceria', 'verduleria'],
      servicios: ['servicio', 'factura', 'electricidad', 'gas', 'agua', 'internet', 'telefono', 'seguro', 'alquiler'],
    };
    const desde = Date.now() - 30 * DAY;
    S.movimientos
      .filter(m => ['transferencia_enviada', 'debito', 'pago', 'compra', 'recarga'].includes(m.tipo) && new Date(m.fecha_movimiento) >= desde)
      .forEach(m => {
        const d = (m.descripcion || '').toLowerCase();
        const nombre = Object.keys(words).find(n => words[n].some(w => d.includes(w))) || 'otros';
        cat[nombre] += Math.abs(m.monto);
      });
    const etiquetas = { inversiones: 'Inversiones', recargas: 'Recargas', transporte: 'Transporte', comida: 'Comida', servicios: 'Servicios', otros: 'Otros' };
    return ok({ categorias: Object.keys(etiquetas).map(k => ({ nombre: etiquetas[k], monto: cat[k] })), total: Object.values(cat).reduce((a, b) => a + b, 0) });
  });

  // Transferencias
  on('GET', '/transferencias/central/bancos', () => ok(BANCOS));
  on('GET', '/transferencias/alias/(.+)', async (_, alias) => {
    const p = await resolverDestino(alias);
    return p ? ok(p) : fail(404, 'Alias no encontrado');
  });
  on('GET', '/transferencias/buscar/(.+)', async (_, cbu) => {
    if (!/^\d{22}$/.test(cbu)) return fail(400, 'El CBU debe tener exactamente 22 dígitos numéricos');
    if (S.cuentas.some(c => c.cbu === cbu)) return fail(400, 'Ese CBU es de tu propia cuenta');
    const p = await resolverDestino(cbu);
    return p ? ok(p) : fail(404, 'CBU no encontrado');
  });
  on('POST', '/transferencias', async ({ cuentaOrigenId, cbuDestino, monto, concepto }) => {
    const m = Number(monto);
    if (!cuentaOrigenId || !cbuDestino || !m) return fail(400, 'Datos incompletos');
    if (m <= 0) return fail(400, 'El monto debe ser mayor a cero');
    const valor = String(cbuDestino).trim();
    const persona = await resolverDestino(/^\d+$/.test(valor) ? normCbu(valor) : valor);
    if (!persona) return fail(404, `Alias "${valor}" no encontrado`);
    const c = cuentaPorId(cuentaOrigenId);
    if (!c) return fail(404, 'Cuenta de origen no encontrada');
    if (c.saldo < m) return fail(400, 'Saldo insuficiente');
    if (normCbu(c.cbu) === normCbu(persona.cbu)) return fail(400, 'No puede transferir a la misma cuenta');
    const ref = txId();
    mover(c, 'transferencia_enviada', -m, concepto || `Transferencia a ${persona.nombre} ${persona.apellido}`, c.saldo - m, ref);
    return ok({ message: 'Transferencia exitosa', transaccionId: ref, nuevoSaldo: c.saldo });
  });
  on('GET', '/transferencias/sincronizar', () => {
    // Para mostrar cómo llega una transferencia: una sola vez, pasados 30 segundos de demo
    if (!S.incomingDone && Date.now() - S.startedAt > 30000) {
      S.incomingDone = true;
      const c = cuenta('ARS');
      mover(c, 'transferencia_recibida', 25000, 'Transferencia de Tomás Rivero · Banco Galicia', c.saldo + 25000, txId());
      return ok({ message: 'Sincronización manual completada', transferenciasRecibidas: 1, detalles: [] });
    }
    return ok({ message: 'Sincronización manual completada', transferenciasRecibidas: 0, detalles: [] });
  });

  // Tarjetas
  const tarjeta = (id) => S.cards.find(c => c.id === Number(id) && c.status !== 'cancelled');
  on('GET', '/cards', () => ok({ cards: S.cards.filter(c => c.status !== 'cancelled') }));
  on('POST', '/cards', () => {
    if (S.cards.some(c => c.status !== 'cancelled')) return fail(409, 'Ya tenés una tarjeta activa. Cancelala para emitir una nueva.');
    const pan = newPan(), vto = new Date(), cvv = String(Math.floor(Math.random() * 900) + 100);
    const card = { id: nextId(), last_four: pan.slice(-4), pan_masked: `${pan.slice(0, 4)} **** **** ${pan.slice(-4)}`, pan, bin: '453998',
      expiry_month: vto.getMonth() + 1, expiry_year: vto.getFullYear() + 3, cvv, status: 'active', daily_limit: 50000, created_at: now() };
    S.cards.push(card);
    return ok({ ...card, message: 'Tarjeta emitida correctamente.' }, 201);
  });
  on('PATCH', '/cards/(\\d+)/status', ({ status }, id) => {
    if (!['active', 'blocked'].includes(status)) return fail(400, 'Estado inválido. Usá "active" o "blocked".');
    const card = tarjeta(id);
    if (!card) return fail(404, 'Tarjeta no encontrada');
    card.status = status;
    return ok({ message: `Tarjeta ${status === 'active' ? 'activada' : 'bloqueada'}`, id: card.id, status });
  });
  on('DELETE', '/cards/(\\d+)', (_, id) => {
    const card = tarjeta(id);
    if (!card) return fail(404, 'Tarjeta no encontrada');
    card.status = 'cancelled';
    return ok({ message: 'Tarjeta cancelada' });
  });
  on('GET', '/cards/(\\d+)/transactions', (_, id) => ok({ transactions: S.cardTx.filter(t => t.card_id === Number(id)) }));
  on('POST', '/cards/visa/authorize', ({ cardId, merchantName, merchantCategory, amount, cbuDestino }) => {
    const m = Number(amount);
    if (!cardId || !merchantName || !amount) return fail(400, 'cardId, merchantName y amount son obligatorios');
    if (!m || m <= 0) return fail(400, 'El monto debe ser mayor a 0');
    const card = S.cards.find(c => c.id === Number(cardId));
    if (!card) return fail(404, 'Tarjeta no encontrada', { approved: false });
    if (card.status === 'cancelled') return fail(400, 'Tarjeta cancelada', { approved: false, declineCode: 'DO_NOT_HONOR' });
    if (card.status === 'blocked') return fail(400, 'Tarjeta bloqueada. Desbloqueala desde el dashboard.', { approved: false, declineCode: 'CARD_BLOCKED' });
    const c = cuenta('ARS');
    if (c.saldo < m) return fail(400, 'Saldo insuficiente', { approved: false, declineCode: 'INSUFFICIENT_FUNDS' });
    const hoy = new Date().toDateString();
    const gastadoHoy = S.cardTx.filter(t => t.card_id === card.id && t.status === 'approved' && new Date(t.created_at).toDateString() === hoy).reduce((s, t) => s + t.amount, 0);
    if (gastadoHoy + m > card.daily_limit) {
      return fail(400, `Límite diario excedido. Gastado hoy: $${gastadoHoy.toLocaleString('es-AR')} de $${card.daily_limit.toLocaleString('es-AR')}`, { approved: false, declineCode: 'EXCEEDED_DAILY_LIMIT' });
    }
    const code = authCode();
    mover(c, 'pago_tarjeta', -m, `Pago con tarjeta · ${merchantName}`, c.saldo - m, cbuDestino ? txId() : code);
    const tx = { id: nextId(), card_id: card.id, merchant_name: merchantName, merchant_category: merchantCategory || 'general', amount: m, currency: 'ARS', status: 'approved', authorization_code: code, created_at: now() };
    S.cardTx.unshift(tx);
    return ok({ approved: true, authorizationCode: code, transactionId: tx.id, amount: m, merchantName, newBalance: c.saldo, timestamp: tx.created_at });
  });
  on('POST', '/cards/visa/refund/(\\d+)', (_, id) => {
    const tx = S.cardTx.find(t => t.id === Number(id));
    if (!tx) return fail(404, 'Transacción no encontrada');
    if (tx.status !== 'approved') return fail(400, `No se puede devolver una transacción en estado "${tx.status}"`);
    const c = cuenta('ARS');
    mover(c, 'devolucion_tarjeta', tx.amount, `Devolución · ${tx.merchant_name}`, c.saldo + tx.amount, `REFUND-${tx.authorization_code}`);
    tx.status = 'refunded';
    return ok({ message: 'Devolución procesada correctamente', amount: tx.amount, newBalance: c.saldo });
  });

  // Inversiones
  const CEDEARS = [
    ['AAPL', 'Apple Inc.', 21.5, 0.85], ['NVDA', 'NVIDIA Corp.', 13.2, 2.14], ['SPY', 'SPDR S&P 500 ETF', 57.3, 0.42], ['QQQ', 'Invesco QQQ Trust', 49.8, 0.61],
    ['TSLA', 'Tesla Inc.', 24.1, -1.33], ['MSFT', 'Microsoft Corp.', 44.7, 0.29], ['GOOGL', 'Alphabet Inc.', 17.8, 1.05], ['AMZN', 'Amazon.com Inc.', 21.9, -0.47],
  ];
  on('GET', '/inversiones/tasas', () => ok(TASAS));
  on('GET', '/inversiones/cedears', () => ok({
    cedears: CEDEARS.map(([ticker, nombre, precioUSD, variacion]) => ({ ticker, nombre, precioUSD, variacion, precioARS: Math.round(precioUSD * TASAS.cclVenta) })),
    ccl: TASAS.cclVenta,
  }));
  const invertir = (lista, diasValidos, tnaDefault, etiqueta) => ({ monto, dias, tna }) => {
    const m = Number(monto), d = Number(dias), t = Number(tna) || tnaDefault;
    if (!m || m <= 0 || !diasValidos.includes(d)) return fail(400, `Datos inválidos. Monto > 0 y plazo ${diasValidos.join('/')} días.`);
    const c = cuenta('ARS');
    if (c.saldo < m) return fail(400, `Saldo insuficiente. Disponible: $${money(c.saldo)}`);
    mover(c, 'debito', m, etiqueta(d, t), c.saldo - m);
    const item = { id: nextId(), cuenta_id: c.id, monto: m, tna: t, dias: d, fecha_inicio: now(), fecha_vencimiento: inDays(d), estado: 'activo' };
    lista().unshift(item);
    return ok({ ...item, nuevoSaldo: c.saldo }, 201);
  };
  const rescatar = (lista, nombre, etiqueta) => (_, id) => {
    const item = lista().find(x => x.id === Number(id) && x.estado === 'activo');
    if (!item) return fail(404, `${nombre} no encontrado.`);
    const dias = Math.max(0, Math.floor((Date.now() - new Date(item.fecha_inicio)) / DAY));
    const rendimiento = item.monto * (item.tna / 365) * dias, total = item.monto + rendimiento;
    const c = cuenta('ARS');
    mover(c, 'credito', total, etiqueta(dias), c.saldo + total);
    item.estado = 'rescatado';
    return ok({ message: `${nombre} rescatado`, nuevoSaldo: c.saldo, rendimiento: round2(rendimiento), montoTotal: round2(total) });
  };
  on('GET', '/inversiones/plazo-fijo', () => ok(S.pf.filter(p => p.estado === 'activo').map(p => ({ ...p, saldo_cuenta: cuenta('ARS').saldo }))));
  on('POST', '/inversiones/plazo-fijo', invertir(() => S.pf, [30, 60, 90], TASAS.pf, (d, t) => `Plazo Fijo ${d} días — ${(t * 100).toFixed(1)}% TNA`));
  on('DELETE', '/inversiones/plazo-fijo/(\\d+)', rescatar(() => S.pf, 'Plazo Fijo', (d) => `Rescate Plazo Fijo — ${d} días acreditados`));
  on('GET', '/inversiones/cauciones', () => ok(S.cauciones.filter(c => c.estado === 'activo')));
  on('POST', '/inversiones/cauciones', invertir(() => S.cauciones, [1, 7, 14], TASAS.caucion, (d, t) => `Caución bursátil ${d} día${d > 1 ? 's' : ''} — ${(t * 100).toFixed(1)}% TNA`));
  on('DELETE', '/inversiones/cauciones/(\\d+)', rescatar(() => S.cauciones, 'Caución', (d) => `Rescate caución — ${d} día${d !== 1 ? 's' : ''} acreditados`));

  // Préstamos
  const conMora = (p) => ({ ...p, en_mora: p.estado === 'activo' && p.cuotas_pagadas < p.cuotas && new Date(p.fecha_proximo_vencimiento) < new Date(new Date().toDateString()) });
  on('GET', '/prestamos', () => ok(S.prestamos.map(conMora)));
  on('POST', '/prestamos/auto-debit', () => ok({ debited: false, result: null }));
  on('POST', '/prestamos/solicitar', ({ monto, cuotas }) => {
    const m = Number(monto), n = Number(cuotas);
    if (!m || m < 10000 || m > 5000000) return fail(400, 'Monto debe estar entre $10.000 y $5.000.000');
    if (![3, 6, 12, 24, 36].includes(n)) return fail(400, 'Plazo inválido. Opciones: 3, 6, 12, 24 o 36 meses.');
    const activo = S.prestamos.filter(p => p.estado === 'activo').reduce((s, p) => s + p.monto, 0);
    if (activo + m > 5000000) return fail(400, `El monto supera tu límite disponible. Capital activo: $${money(activo)}. Disponible: $${money(5000000 - activo)}.`);
    const cuota = cuotaDe(m, n, TASAS.prestamo), c = cuenta('ARS');
    const prestamo = { id: nextId(), usuario_id: S.user.id, cuenta_acreditada_id: c.id, monto: m, cuotas: n, tna: TASAS.prestamo, cuota_mensual: round2(cuota),
      estado: 'activo', cuotas_pagadas: 0, fecha_proximo_vencimiento: inDays(30), fecha_solicitud: now() };
    S.prestamos.unshift(prestamo);
    mover(c, 'credito', m, `Préstamo NODO — ${n} cuotas de $${money(cuota)}`, c.saldo + m);
    return ok({ message: 'Préstamo acreditado exitosamente.', prestamo, nuevoSaldo: c.saldo }, 201);
  });
  on('POST', '/prestamos/(\\d+)/pagar-cuota', (_, id) => {
    const p = S.prestamos.find(x => x.id === Number(id) && x.estado === 'activo');
    if (!p) return fail(404, 'Préstamo no encontrado o no activo.');
    if (p.cuotas_pagadas >= p.cuotas) return fail(400, 'Todas las cuotas ya fueron pagadas.');
    const c = cuentaPorId(p.cuenta_acreditada_id) || cuenta('ARS');
    if (c.saldo < p.cuota_mensual) return fail(400, `Saldo insuficiente. Necesitás $${money(p.cuota_mensual)} para pagar la cuota.`);
    p.cuotas_pagadas += 1;
    const saldado = p.cuotas_pagadas >= p.cuotas;
    p.estado = saldado ? 'saldado' : 'activo';
    const sig = new Date(p.fecha_proximo_vencimiento); sig.setMonth(sig.getMonth() + 1);
    p.fecha_proximo_vencimiento = saldado ? null : sig.toISOString().slice(0, 10);
    mover(c, 'debito', p.cuota_mensual, `Cuota ${p.cuotas_pagadas}/${p.cuotas} — Préstamo NODO`, c.saldo - p.cuota_mensual);
    return ok({ message: saldado ? '¡Préstamo cancelado completamente! 🎉' : `Cuota ${p.cuotas_pagadas}/${p.cuotas} pagada.`,
      cuotas_pagadas: p.cuotas_pagadas, total_cuotas: p.cuotas, estado: p.estado, fecha_proximo_vencimiento: p.fecha_proximo_vencimiento, nuevo_saldo: c.saldo });
  });
  on('PUT', '/prestamos/(\\d+)/cancelar', (_, id) => {
    const p = S.prestamos.find(x => x.id === Number(id) && x.estado === 'activo');
    if (!p) return fail(404, 'Préstamo no encontrado o ya cancelado.');
    p.estado = 'cancelado';
    return ok({ message: 'Préstamo cancelado.' });
  });

  // Reservas
  on('GET', '/reservas', () => ok([...S.reservas].sort((a, b) => a.fecha_vencimiento.localeCompare(b.fecha_vencimiento))));
  on('POST', '/reservas', ({ nombre, monto, fecha_vencimiento }) => {
    const m = Number(monto);
    if (!nombre || !monto || !fecha_vencimiento) return fail(400, 'nombre, monto y fecha_vencimiento son requeridos');
    if (!m || m <= 0) return fail(400, 'El monto debe ser mayor a cero.');
    const c = cuenta('ARS');
    if (c.saldo < m) return fail(400, `Saldo insuficiente en pesos para crear esta reserva. Disponible: $${money(c.saldo)}`);
    mover(c, 'debito', m, `Reserva creada — ${nombre}`, c.saldo - m);
    const r = { id: nextId(), cuenta_id: c.id, nombre, monto: m, fecha_vencimiento, fecha_creacion: now() };
    S.reservas.push(r);
    return ok({ ...r, nuevoSaldo: c.saldo }, 201);
  });
  on('DELETE', '/reservas/(\\d+)', (_, id) => {
    const r = S.reservas.find(x => x.id === Number(id));
    if (!r) return fail(404, 'Reserva no encontrada');
    const c = cuentaPorId(r.cuenta_id) || cuenta('ARS');
    mover(c, 'credito', r.monto, `Rescate de reserva — ${r.nombre}`, c.saldo + r.monto);
    S.reservas = S.reservas.filter(x => x !== r);
    return ok({ message: 'Reserva rescatada', nuevoSaldo: c.saldo });
  });

  // QR: el token no lleva firma real, así que al escanearlo se muestra como "origen no verificado"
  const b64url = (o) => btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  on('POST', '/qr/firmar', ({ cbu, alias, monto, moneda }) => {
    if (!cbu || !moneda) return fail(400, 'cbu y moneda son obligatorios');
    const iat = Math.floor(Date.now() / 1000);
    const claims = { iss: 9999, cbu, moneda, iat, exp: iat + 600, ...(alias ? { alias } : {}), ...(monto ? { monto: Number(monto) } : {}) };
    return ok({ jwt: `${b64url({ alg: 'ES256', typ: 'JWT', kid: 'demo' })}.${b64url(claims)}.demo` });
  });
  on('GET', '/qr/discover/(\\d+)', (_, code) => fail(404, `Banco ${code} no registrado`));

  // Asistente
  on('POST', '/chat', ({ message }) => ok({ reply: responder(message) }));

  const responderRuta = async (method, path, body) => {
    for (const r of RUTAS) {
      const m = r.method === method && path.match(r.re);
      if (m) {
        const res = await r.handler(body || {}, ...m.slice(1).map(decodeURIComponent));
        save();
        return res;
      }
    }
    return fail(404, 'Esta función no está disponible en la cuenta demo.');
  };

  // ── Interceptor de red ──
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url, window.location.href);
    if (url.origin === window.location.origin && url.pathname.startsWith('/api/')) {
      const path = url.pathname.slice(4);
      // Cotizaciones públicas: solo lectura, no tocan la base
      if (path.startsWith('/mercado/')) return realFetch(input, init);
      let body = {};
      try { body = init.body ? JSON.parse(init.body) : {}; } catch {}
      await new Promise(r => setTimeout(r, 200 + Math.random() * 250));
      const { status, body: out } = await responderRuta((init.method || 'GET').toUpperCase(), path, body);
      return new Response(JSON.stringify(out), { status, headers: { 'Content-Type': 'application/json' } });
    }
    // Supabase nunca recibe pedidos desde la demo
    if (/supabase\.co$/.test(url.hostname)) {
      return new Response(JSON.stringify({ message: 'Bloqueado en la cuenta demo' }), { status: 503, headers: { 'Content-Type': 'application/json' } });
    }
    return realFetch(input, init);
  };

  // ── Sesión ficticia de Supabase (la llama config.js apenas crea el cliente) ──
  const authUser = () => ({ id: S.user.id, email: S.user.email, user_metadata: S.meta });
  const fakeSession = () => ({ access_token: 'demo', token_type: 'bearer', expires_in: 3600, user: authUser() });
  window.NodoDemo.patchAuth = (client) => {
    const a = client.auth;
    a.getSession = async () => ({ data: { session: fakeSession() }, error: null });
    a.getUser = async () => ({ data: { user: authUser() }, error: null });
    a.setSession = async () => ({ data: { session: fakeSession() }, error: null });
    a.updateUser = async ({ data } = {}) => { Object.assign(S.meta, data || {}); save(); return { data: { user: authUser() }, error: null }; };
    a.signOut = async () => { exit(); return { error: null }; };
    a.onAuthStateChange = () => ({ data: { subscription: { unsubscribe() {} } } });
    a.stopAutoRefresh?.();
  };

  // ── Aviso visible de que es una demo ──
  document.addEventListener('DOMContentLoaded', () => {
    const header = document.querySelector('.header');
    if (!header) return;
    const badge = document.createElement('span');
    badge.className = 'demo-badge';
    badge.title = 'Cuenta demo: todo es ficticio y no se guarda en el banco';
    badge.innerHTML = '<span class="demo-badge-long">Cuenta demo · datos ficticios</span><span class="demo-badge-short">Demo</span>';
    header.prepend(badge);
  });
})();
