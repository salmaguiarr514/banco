const API_URL = "http://localhost:3000/api";

// ── Tema claro / oscuro ──
const THEME_KEY = 'nodo_theme';
const applyTheme = (theme) => {
  document.documentElement.setAttribute('data-theme', theme);
  document.querySelectorAll('.btn-theme-toggle').forEach(btn => {
    btn.innerHTML = theme === 'dark' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
    btn.title = theme === 'dark' ? 'Modo claro' : 'Modo oscuro';
  });
  // Actualizar color de la red de nodos del dashboard
  window.dashNet?.setColor(theme === 'dark' ? 'rgba(148,163,184,' : 'rgba(30,41,59,');
  localStorage.setItem(THEME_KEY, theme);
};
const toggleTheme = () => applyTheme(
  document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'
);
applyTheme(localStorage.getItem(THEME_KEY) || 'light');

// Inicialización de Supabase Client
// Reemplaza estas cadenas con la URL y la Anon Key de TU PROPIO proyecto de Supabase (Settings -> API)
const SUPABASE_URL = 'https://fjbjqetnyrhvbbrymhde.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_bG5yTGeEYFH5t2g2x619jQ_VxG6xXpj';
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const output = document.getElementById("output");
const saldoList = document.getElementById("saldoList");
const movimientosList = document.getElementById("movimientosList");
const logoutBtn = document.getElementById("logoutBtn");

const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const transferForm = document.getElementById("transferForm");

const loadMovimientosBtn = document.getElementById("loadMovimientosBtn");

// Global para manejo de saldo oculto
let saldoActual = 0;
let saldoOculto = true;
// Variables globales para la cuenta activa
let cuentaActiva = null;
// Variable para guardar el CBU verificado
let cbuDestinoVerificado = "";
// Objeto para guardar info completa del destinatario validado
let destinatarioValidado = null;
// Instancia del escáner
let html5QrCode = null;

const tabs = document.querySelectorAll(".tab");

const debounce = (fn, delay) => {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
};

// ── Botón loading ──
const btnLoad = (btn, on) => {
  if (!btn) return;
  if (on) {
    btn._origHTML = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    btn.disabled = true;
    btn.classList.add('btn-loading');
  } else {
    btn.innerHTML = btn._origHTML ?? btn.innerHTML;
    btn.disabled = false;
    btn.classList.remove('btn-loading');
  }
};
const formLoad = (form, on) => btnLoad(form?.querySelector('button[type="submit"]'), on);

// ── Toast ──
const showToast = (msg, duration = 3500, type = 'success') => {
  const toast    = document.getElementById('syncToast');
  const toastMsg = document.getElementById('syncToastMsg');
  const toastIcon = toast?.querySelector('i');
  if (!toast || !toastMsg) return;

  const icons = { success: 'fas fa-check-circle', info: 'fas fa-info-circle', error: 'fas fa-exclamation-circle' };
  if (toastIcon) toastIcon.className = icons[type] || icons.success;

  toast.className = `sync-toast sync-toast--${type}`;
  toastMsg.textContent = msg;
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.add('hidden'), duration);
};

// ── Comprobante: descargar y compartir ──
const getReceiptCanvas = async () => {
  const card    = document.querySelector('.receipt-card');
  const toHide  = card.querySelectorAll('.receipt-actions, .btn-primary');
  toHide.forEach(el => el.style.display = 'none');
  try {
    return await html2canvas(card, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
  } finally {
    toHide.forEach(el => el.style.display = '');
  }
};

const downloadReceipt = async () => {
  try {
    const canvas = await getReceiptCanvas();
    const link = document.createElement('a');
    link.download = `comprobante-nodo-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    showToast('Comprobante descargado', 3000, 'success');
  } catch {
    showToast('No se pudo descargar el comprobante', 3500, 'error');
  }
};

const shareReceipt = async () => {
  const amount  = document.getElementById('receiptAmount').textContent.trim();
  const toInfo  = document.getElementById('receiptToInfo').innerText.trim();
  const dateStr = document.getElementById('receiptDateTime').textContent.trim();
  const text    = `Comprobante Nodo\n${amount}\nPara: ${toInfo}\n${dateStr}`;

  try {
    const canvas = await getReceiptCanvas();

    canvas.toBlob(async (blob) => {
      const file = new File([blob], 'comprobante-nodo.png', { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ title: 'Comprobante Nodo', files: [file] });
      } else if (navigator.share) {
        await navigator.share({ title: 'Comprobante Nodo', text });
      } else {
        await navigator.clipboard.writeText(text);
        showToast('Texto copiado al portapapeles');
      }
    }, 'image/png');
  } catch (err) {
    if (err.name !== 'AbortError') showToast('No se pudo compartir el comprobante');
  }
};

// ── Mapa de bancos ──
let banksMap = new Map();
const loadBanks = async () => {
  try {
    const banks = await apiFetch('/transferencias/central/bancos');
    if (Array.isArray(banks)) banks.forEach(b => banksMap.set(String(b.bankCode), b.name));
  } catch {}
};
const getBankName = (bankCode) => bankCode ? (banksMap.get(String(bankCode)) || `Banco ${bankCode}`) : null;

// ── Favoritos & Recientes ──
const FAV_KEY = 'nodo_favoritos';
const REC_KEY = 'nodo_recientes';
const getFavoritos = () => JSON.parse(localStorage.getItem(FAV_KEY) || '[]');
const getRecientes = () => JSON.parse(localStorage.getItem(REC_KEY) || '[]');
const saveFavoritos = (list) => localStorage.setItem(FAV_KEY, JSON.stringify(list));
const saveRecientes = (list) => localStorage.setItem(REC_KEY, JSON.stringify(list));

const AVATAR_COLORS = ['#10B981','#3B82F6','#8B5CF6','#EC4899','#F59E0B','#0EA5E9','#EF4444'];
const getAvatarColor = (nombre) => {
  let sum = 0;
  for (const c of (nombre || '')) sum += c.charCodeAt(0);
  return AVATAR_COLORS[sum % AVATAR_COLORS.length];
};
const getInitials = (nombre, apellido) =>
  ((nombre || '')[0] || '').toUpperCase() + ((apellido || '')[0] || '').toUpperCase() || '?';

const SUGERIDOS = [
  { nombre: 'Lucas',     apellido: 'Pérez',    alias: 'lucas.perez.nodo' },
  { nombre: 'Valentina', apellido: 'García',   alias: 'valentina.garcia.nodo' },
  { nombre: 'Mateo',     apellido: 'López',    alias: 'mateo.lopez.nodo' },
  { nombre: 'Sofía',     apellido: 'Martínez', alias: 'sofia.martinez.nodo' },
];

function renderContactCard(persona, isStarred) {
  const ini   = getInitials(persona.nombre, persona.apellido);
  const color = getAvatarColor(persona.nombre);
  const label = `${persona.nombre || ''} ${((persona.apellido || '')[0] || '')}.`.trim();
  const starClass = isStarred ? 'contact-star starred' : 'contact-star';
  return `
    <div class="contact-card"
      data-nombre="${persona.nombre || ''}"
      data-apellido="${persona.apellido || ''}"
      data-cbu="${persona.cbu || ''}"
      data-alias="${persona.alias || ''}"
      data-banco="${persona.bankName || 'Nodo'}">
      <div class="contact-avatar" style="background:${color}">${ini}</div>
      <span class="contact-name">${label}</span>
      <button class="${starClass}"
        data-nombre="${persona.nombre || ''}"
        data-apellido="${persona.apellido || ''}"
        data-cbu="${persona.cbu || ''}"
        data-alias="${persona.alias || ''}">
        <i class="fas fa-star"></i>
      </button>
    </div>`;
}

function renderContacts() {
  const favs = getFavoritos();
  const recs = getRecientes();
  const favKeys = new Set(favs.map(f => f.cbu || f.alias));

  const sections = [
    { listId: 'favoritosList', sectionId: 'favoritosSection', items: favs, starred: () => true },
    { listId: 'recientesList', sectionId: 'recientesSection', items: recs.slice(0,6), starred: p => favKeys.has(p.cbu || p.alias) },
    { listId: 'sugeridosList', sectionId: 'sugeridosSection',
      items: SUGERIDOS.filter(s => !favKeys.has(s.alias) && !recs.some(r => r.alias === s.alias)),
      starred: () => false },
  ];

  sections.forEach(({ listId, sectionId, items, starred }) => {
    const list = document.getElementById(listId);
    const sec  = document.getElementById(sectionId);
    if (!list || !sec) return;
    if (items.length === 0) { sec.classList.add('hidden'); return; }
    sec.classList.remove('hidden');
    list.innerHTML = items.map(p => renderContactCard(p, starred(p))).join('');
  });

  document.querySelectorAll('.contact-card').forEach(card => {
    card.addEventListener('click', e => {
      if (e.target.closest('.contact-star')) return;
      selectRecipient({
        nombre:   card.dataset.nombre,
        apellido: card.dataset.apellido,
        cbu:      card.dataset.cbu,
        alias:    card.dataset.alias,
        bankName: card.dataset.banco,
      });
    });
  });

  document.querySelectorAll('.contact-star').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      toggleFavorito({ nombre: btn.dataset.nombre, apellido: btn.dataset.apellido, cbu: btn.dataset.cbu, alias: btn.dataset.alias });
      renderContacts();
    });
  });
}

function selectRecipient(persona) {
  destinatarioValidado  = persona;
  cbuDestinoVerificado  = persona.cbu || '';
  const cbuInput = document.getElementById('cbuDestino');
  if (cbuInput) cbuInput.value = persona.alias || persona.cbu || '';

  const preview = document.getElementById('recipientPreview');
  if (preview) {
    const ini   = getInitials(persona.nombre, persona.apellido);
    const color = getAvatarColor(persona.nombre);
    const bankLabel = persona.bankName || getBankName(persona.bankCode) || 'Nodo';
    preview.innerHTML = `
      <div class="contact-avatar" style="background:${color};width:44px;height:44px;font-size:0.95rem;">${ini}</div>
      <div class="recipient-info">
        <b>${persona.nombre || ''} ${persona.apellido || ''}</b>
        <span>${persona.alias || persona.cbu || ''}</span>
        <span class="recipient-bank"><i class="fas fa-university"></i> ${bankLabel}</span>
      </div>`;
  }

  document.getElementById('transferStep1')?.classList.add('hidden');
  document.getElementById('transferStep2')?.classList.remove('hidden');
  setTimeout(() => document.getElementById('monto')?.focus(), 80);
}

function toggleFavorito(persona) {
  let favs = getFavoritos();
  const key = persona.cbu || persona.alias;
  const idx = favs.findIndex(f => (f.cbu || f.alias) === key);
  if (idx >= 0) favs.splice(idx, 1);
  else { favs.unshift({ ...persona }); if (favs.length > 12) favs.length = 12; }
  saveFavoritos(favs);
}

function addReciente(persona) {
  if (!persona?.nombre) return;
  let recs = getRecientes().filter(r => (r.cbu || r.alias) !== (persona.cbu || persona.alias));
  recs.unshift({ ...persona, fecha: new Date().toISOString() });
  if (recs.length > 8) recs.length = 8;
  saveRecientes(recs);
}

const setOutput = (data) => {
  if (output) {
    output.textContent = typeof data === "string" ? data : JSON.stringify(data, null, 2);
  } else if (typeof data === "string" || data.message) {
    console.error("Error de API:", data);
  }
};

// ── Card Engine ──
let tarjetaActiva = null;
let payCardCBUVerificado = '';

const cargarTarjeta = async () => {
  try {
    const data = await apiFetch('/cards');
    const cards = data.cards || [];
    tarjetaActiva = cards[0] || null;
    renderTarjeta();
    if (tarjetaActiva) cargarHistorialTarjeta(tarjetaActiva.id);
  } catch (_) {}
};

const renderTarjeta = () => {
  const noCard    = document.getElementById('noCardState');
  const container = document.getElementById('cardContainer');
  const badge     = document.getElementById('cardStatusBadge');
  if (!noCard || !container) return;

  if (!tarjetaActiva) {
    noCard.classList.remove('hidden');
    container.classList.add('hidden');
    if (badge) badge.classList.add('hidden');
    return;
  }

  noCard.classList.add('hidden');
  container.classList.remove('hidden');

  // Badge de estado
  if (badge) {
    badge.textContent = tarjetaActiva.status === 'active' ? 'Activa' : 'Bloqueada';
    badge.className = `card-status-badge ${tarjetaActiva.status}`;
    badge.classList.remove('hidden');
  }

  // Visual de la tarjeta
  const [panPrefix, , , panLast] = tarjetaActiva.pan_masked.split(' ');
  const binEl  = document.getElementById('cardNumBin');
  const lastEl = document.getElementById('userCardLast4');
  if (binEl)  binEl.textContent  = panPrefix || '4539';
  if (lastEl) lastEl.textContent = panLast   || '••••';

  const expiryEl = document.getElementById('userCardExpiry');
  if (expiryEl) {
    const mm = String(tarjetaActiva.expiry_month).padStart(2, '0');
    const yy = String(tarjetaActiva.expiry_year).slice(-2);
    expiryEl.textContent = `${mm}/${yy}`;
  }

  // Panel "Ver datos"
  const panEl    = document.getElementById('cardDataPan');
  const expiryD  = document.getElementById('cardDataExpiry');
  const limitEl  = document.getElementById('cardDataLimit');
  if (panEl)   { panEl.textContent = tarjetaActiva.pan_masked; panEl.dataset.value = tarjetaActiva.pan_masked.replace(/\s/g,''); }
  if (expiryD) {
    const mm = String(tarjetaActiva.expiry_month).padStart(2, '0');
    expiryD.textContent = `${mm}/${tarjetaActiva.expiry_year}`;
  }
  if (limitEl) limitEl.textContent = `$${Number(tarjetaActiva.daily_limit).toLocaleString('es-AR')} / día`;

  // CVV — siempre empieza oculto
  const cvvEl = document.getElementById('cardDataCvv');
  if (cvvEl) cvvEl.textContent = '•••';

  // Botón bloquear / activar
  const toggleBtn = document.getElementById('toggleCardStatusBtn');
  if (toggleBtn) {
    const blocked = tarjetaActiva.status === 'blocked';
    toggleBtn.innerHTML = blocked
      ? '<i class="fas fa-lock-open"></i><span>Desbloquear</span>'
      : '<i class="fas fa-lock"></i><span>Bloquear</span>';
    toggleBtn.classList.toggle('blocked-state', blocked);
  }

  // Tarjeta bloqueada: overlay visual
  const cardEl = document.getElementById('visaCardEl');
  if (cardEl) cardEl.style.filter = tarjetaActiva.status === 'blocked' ? 'grayscale(0.7) brightness(0.7)' : '';
};

const cargarHistorialTarjeta = async (cardId) => {
  try {
    const data = await apiFetch(`/cards/${cardId}/transactions`);
    const list = document.getElementById('cardTxList');
    if (!list) return;
    const txs = data.transactions || [];
    if (txs.length === 0) {
      list.innerHTML = '<li class="list-empty">Sin movimientos con tarjeta todavía</li>';
      return;
    }
    list.innerHTML = txs.map(tx => {
      const isRefund = tx.status === 'refunded';
      const icon  = isRefund ? 'fa-undo' : 'fa-shopping-bag';
      const iconColor = isRefund ? 'var(--green)' : 'var(--text-secondary)';
      const iconBg    = isRefund ? 'rgba(16,185,129,0.1)' : 'var(--bg)';
      const amtColor  = isRefund ? 'var(--green)' : '#ef4444';
      const sign  = isRefund ? '+' : '-';
      const fecha = new Date(tx.created_at).toLocaleDateString('es-AR', { day:'2-digit', month:'short' });
      const badge = isRefund ? '<span style="font-size:0.62rem;background:rgba(16,185,129,0.12);color:var(--green);padding:1px 6px;border-radius:8px;margin-left:4px;">devuelto</span>' : '';
      return `<li class="movement-item">
        <div class="movement-icon" style="background:${iconBg};border:1.5px solid var(--border);">
          <i class="fas ${icon}" style="color:${iconColor};font-size:0.85rem;"></i>
        </div>
        <div class="movement-info">
          <span class="movement-desc">${tx.merchant_name}${badge}</span>
          <span class="movement-date">${fecha} · Auth: ${tx.authorization_code}</span>
        </div>
        <span class="movement-amount" style="color:${amtColor}">${sign}$${Number(tx.amount).toLocaleString('es-AR')}</span>
      </li>`;
    }).join('');
  } catch (_) {}
};

const getCuentaLabel = (cuenta) => cuenta.nombre_cuenta || `Cuenta ${cuenta.id || cuenta.numero_cuenta || ""}`.trim();

const getCuentaCbu = (cuenta) => cuenta.cbu || cuenta.CBU || "No disponible";

const renderCuentaSaldo = (cuenta) =>
  `<li>${getCuentaLabel(cuenta)} | CBU: ${getCuentaCbu(cuenta)} | Saldo: ${cuenta.saldo} ${cuenta.moneda}</li>`;

const actualizarDisplaySaldo = () => {
  const display = document.getElementById("displayBalance");
  const icon = document.getElementById("balanceIcon");
  if (display) {
    display.textContent = saldoOculto ? "**********" : saldoActual.toLocaleString('es-AR', { minimumFractionDigits: 2 });
  }
  if (icon) {
    icon.className = saldoOculto ? "fas fa-eye" : "fas fa-eye-slash";
  }
};

const animarSaldo = (anterior, nuevo) => {
  const display = document.getElementById('displayBalance');
  if (!display) return;

  const duracion = 750;
  const inicio = performance.now();
  const diff = nuevo - anterior;
  const easeOut = t => t * (2 - t);

  display.classList.remove('balance-flash-up', 'balance-flash-down');
  void display.offsetWidth; // fuerza reflow para reiniciar animación CSS
  display.classList.add(diff >= 0 ? 'balance-flash-up' : 'balance-flash-down');

  const step = (ahora) => {
    const t = Math.min((ahora - inicio) / duracion, 1);
    const valor = anterior + diff * easeOut(t);
    display.textContent = valor.toLocaleString('es-AR', { minimumFractionDigits: 2 });
    if (t < 1) requestAnimationFrame(step);
    else display.textContent = nuevo.toLocaleString('es-AR', { minimumFractionDigits: 2 });
  };

  requestAnimationFrame(step);
};

const loadSaldo = async () => {
  try {
    const display = document.getElementById("displayBalance");
    if (display && saldoOculto) display.textContent = "**********";
    
    const cuentas = await apiFetch("/cuentas/saldo");
    if (saldoList) saldoList.innerHTML = cuentas.map(renderCuentaSaldo).join("");
    if (setOutput) setOutput(cuentas);
    
    if (cuentas.length > 0) {
      cuentaActiva = cuentas[0];
      const anterior = saldoActual;
      saldoActual = cuentas[0].saldo;

      const icon = document.getElementById("balanceIcon");
      if (icon) icon.className = saldoOculto ? "fas fa-eye" : "fas fa-eye-slash";

      if (!saldoOculto && anterior !== saldoActual) {
        animarSaldo(anterior, saldoActual);
      } else {
        actualizarDisplaySaldo();
      }

      const cbuVal   = getCuentaCbu(cuentaActiva);
      const aliasVal = cuentaActiva.alias || '';

      const displayCbuEl   = document.getElementById('displayCbu');
      const displayAliasEl = document.getElementById('displayAlias');
      if (displayCbuEl)   { displayCbuEl.textContent   = cbuVal   || '—'; displayCbuEl.dataset.value   = cbuVal;   }
      if (displayAliasEl) { displayAliasEl.textContent = aliasVal || '—'; displayAliasEl.dataset.value = aliasVal; }

      // Actualizar sección USD
      const cuentaUSD = cuentas.find(c => c.moneda === 'USD');
      renderUSDAccount(cuentaUSD || null);
    }
  } catch (error) {
    saldoActual = 0;
    actualizarDisplaySaldo();
    if (setOutput) setOutput(error.message);
  }
};

let _cuentaUSD = null;

const renderUSDAccount = (cuenta) => {
  _cuentaUSD = cuenta;
  const sinEl = document.getElementById('heroUSDSin');
  const conEl = document.getElementById('heroUSDCon');
  if (!sinEl || !conEl) return;

  if (cuenta) {
    sinEl.classList.add('hidden');
    conEl.classList.remove('hidden');
    const saldoUSD = Number(cuenta.saldo);
    const balEl = document.getElementById('usdDisplayBalance');
    if (balEl) {
      balEl.dataset.value = saldoUSD;
      balEl.textContent = saldoUSD.toLocaleString('es-AR', { minimumFractionDigits: 2 });
    }
    const eq = document.getElementById('usdEquivalente');
    if (eq) eq.dataset.saldo = saldoUSD;
    const cbuEl   = document.getElementById('usdDisplayCbu');
    const aliasEl = document.getElementById('usdDisplayAlias');
    if (cbuEl)   cbuEl.textContent   = cuenta.cbu   || '—';
    if (aliasEl) aliasEl.textContent = cuenta.alias || '—';
    // botones compra/venta
    document.getElementById('btnComprarUSD')?.addEventListener('click', () => abrirConvertModal('ARS','USD'));
    document.getElementById('btnVenderUSD')?.addEventListener('click',  () => abrirConvertModal('USD','ARS'));
    document.getElementById('btnTransferirUSD')?.addEventListener('click', abrirTransferirUSD);
  } else {
    sinEl.classList.remove('hidden');
    conEl.classList.add('hidden');
    document.getElementById('btnAbrirUSD')?.addEventListener('click', handleAbrirUSD);
  }
  renderCotizacionesUSD();
};

const handleAbrirUSD = () => {
  const modal = document.getElementById('usdAbrirModal');
  modal.classList.remove('hidden');
};

const _confirmarAbrirUSD = async () => {
  const modal   = document.getElementById('usdAbrirModal');
  const confirm = document.getElementById('usdAbrirConfirm');
  const cancel  = document.getElementById('usdAbrirCancel');
  const btn     = document.getElementById('btnAbrirUSD');

  confirm.disabled = true;
  cancel.disabled  = true;
  confirm.textContent = 'Abriendo…';

  try {
    const data = await apiFetch('/cuentas/abrir', {
      method: 'POST',
      body: JSON.stringify({ moneda: 'USD' }),
    });
    modal.classList.add('hidden');
    showToast(data.message || 'Cuenta USD abierta', 3000, 'success');
    await loadSaldo();
  } catch (e) {
    modal.classList.add('hidden');
    showToast(e.message || 'Error al abrir cuenta USD', 5000, 'error');
  } finally {
    confirm.disabled = false;
    cancel.disabled  = false;
    confirm.textContent = 'Confirmar';
    if (btn) btnLoad(btn, false);
  }
};


const apiFetch = async (endpoint, options = {}) => {
  const { data: { session } } = await _supabase.auth.getSession();

  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
    ...(session ? { "Authorization": `Bearer ${session.access_token}` } : {}),
  };

  let response;
  try {
    response = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
  } catch (networkErr) {
    throw new Error("Sin conexión con el servidor. Verificá tu red o que el servidor esté activo.");
  }

  // Parsear de forma segura — el servidor puede devolver HTML en errores 404/500
  let data = {};
  try {
    const text = await response.text();
    if (text) data = JSON.parse(text);
  } catch {
    if (!response.ok) {
      throw new Error(`Error del servidor (${response.status}). Verificá que el backend esté corriendo.`);
    }
    return {};
  }

  if (!response.ok) {
    if (response.status === 401 && !window.location.href.includes('login.html')) {
      cerrarSesion();
    }
    const detailParts = [data.message, data.error];
    if (data.details?.error) detailParts.push(data.details.error);
    throw new Error(detailParts.filter(Boolean).join(" | ") || "Error en la solicitud");
  }

  return data;
};

const cerrarSesion = async () => {
  try {
    await _supabase.auth.signOut();
    localStorage.removeItem("user");
    window.location.href = "login.html";
  } catch (error) {
    showToast('Error al cerrar sesión', 3500, 'error');
  }
};

const copiarAlPortapapeles = (texto) => {
  if (!texto) return;
  navigator.clipboard.writeText(texto)
    .then(() => showToast('Copiado al portapapeles', 2500, 'success'))
    .catch(() => showToast('No se pudo copiar', 2500, 'error'));
};

// ── Mercado (cotizaciones integradas en la tarjeta USD) ──
const fmt = (n) => n != null ? `$${Number(n).toLocaleString('es-AR')}` : '—';

let _dolares = [];

const loadMercado = async () => {
  try {
    const data = await fetch(`${API_URL}/mercado/dolares`).then(r => r.json());
    if (Array.isArray(data)) {
      _dolares = data;
      renderCotizacionesUSD();
    }
  } catch (_) {}
};

const renderHeroMovimientos = (movimientos) => {
  const el = document.getElementById('heroMovimientos');
  if (!el) return;
  if (!movimientos || movimientos.length === 0) { el.classList.add('hidden'); return; }
  const ultimos = movimientos.slice(0, 3);
  el.classList.remove('hidden');
  el.innerHTML = `<p class="hero-mov-hdr">Últimos movimientos</p>` + ultimos.map(mov => {
    const ingreso = mov.tipo === 'credito' || mov.tipo === 'deposito' || mov.tipo === 'transferencia_recibida' || mov.tipo === 'conversion_entrada';
    const monto = Math.abs(mov.monto);
    const fecha = new Date(mov.fecha_movimiento).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
    const icon  = ingreso ? 'fa-arrow-down' : 'fa-arrow-up';
    const desc  = (mov.descripcion || 'Operación').replace(/^(Depósito|Deposito) ficticio$/i, 'Depósito');
    return `
      <div class="hero-mov-item">
        <div class="hero-mov-icon ${ingreso ? 'ingreso' : 'egreso'}"><i class="fas ${icon}"></i></div>
        <div class="hero-mov-text">
          <p class="hero-mov-desc">${desc}</p>
          <p class="hero-mov-date">${fecha}</p>
        </div>
        <span class="hero-mov-amount ${ingreso ? 'ingreso' : 'egreso'}">${ingreso ? '+' : '-'}$${monto.toLocaleString('es-AR')}</span>
      </div>`;
  }).join('');
};

const renderCotizacionesUSD = () => {
  const el = document.getElementById('usdCotizaciones');
  if (!el || !_dolares.length) return;
  const blue    = _dolares.find(d => d.casa === 'blue');
  const oficial = _dolares.find(d => d.casa === 'oficial');
  const ts      = blue?.fechaActualizacion
    ? new Date(blue.fechaActualizacion).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
    : null;

  const cotizRow = (label, data) => `
    <div class="cotiz-row">
      <span class="cotiz-label">${label}</span>
      <div class="cotiz-col">
        <span class="cotiz-sub">Compra</span>
        <span class="cotiz-val">${fmt(data?.compra)}</span>
      </div>
      <div class="cotiz-col cotiz-venta">
        <span class="cotiz-sub">Venta</span>
        <span class="cotiz-val">${fmt(data?.venta)}</span>
      </div>
    </div>`;

  el.innerHTML = `
    <div class="cotiz-widget-hdr">
      <span class="cotiz-widget-title">Cotización USD</span>
      ${ts ? `<span class="cotiz-ts">Act. ${ts}</span>` : ''}
    </div>
    ${cotizRow('Blue', blue)}
    ${cotizRow('Oficial', oficial)}`;

  // Actualizar equivalente ARS en saldo USD
  if (blue?.venta) {
    window._dolarBlueVenta = blue.venta;
    const eq = document.getElementById('usdEquivalente');
    if (eq) {
      const saldo = parseFloat(eq.dataset.saldo || '0');
      eq.textContent = saldo > 0 ? `≈ ${fmt(saldo * blue.venta)} ARS (blue)` : '';
    }
  }
};

// ── Toggle hero ARS/USD ──
const _setHeroTab = (vista) => {
  document.getElementById('tabARS')?.classList.toggle('active', vista === 'ARS');
  document.getElementById('tabUSD')?.classList.toggle('active', vista === 'USD');
  document.getElementById('tabARS')?.setAttribute('aria-selected', vista === 'ARS');
  document.getElementById('tabUSD')?.setAttribute('aria-selected', vista === 'USD');
};
const mostrarHeroARS = () => {
  document.getElementById('heroARS')?.classList.remove('hidden');
  document.getElementById('heroUSD')?.classList.add('hidden');
  _setHeroTab('ARS');
};
const mostrarHeroUSD = () => {
  document.getElementById('heroARS')?.classList.add('hidden');
  document.getElementById('heroUSD')?.classList.remove('hidden');
  _setHeroTab('USD');
  renderCotizacionesUSD();
};

// ── Modal compra/venta USD ──
const abrirConvertModal = (de, a) => {
  const modal   = document.getElementById('usdConvertModal');
  const title   = document.getElementById('usdConvertTitle');
  const badge   = document.getElementById('usdConvertRateBadge');
  const prefix  = document.getElementById('usdConvertPrefix');
  const suffix  = document.getElementById('usdConvertSuffix');
  const preview = document.getElementById('usdConvertPreview');
  const preAmt  = document.getElementById('usdConvertPreviewAmt');
  const input   = document.getElementById('usdConvertMonto');
  const confirm = document.getElementById('usdConvertConfirm');
  if (!modal) return;

  const blue = _dolares.find(d => d.casa === 'blue');
  const tasa = de === 'ARS' ? blue?.venta : blue?.compra;
  const esCompra = de === 'ARS';

  title.textContent  = esCompra ? 'Comprar dólares' : 'Vender dólares';
  badge.textContent  = esCompra
    ? `Tasa blue venta · ${fmt(tasa)}`
    : `Tasa blue compra · ${fmt(tasa)}`;
  prefix.textContent = esCompra ? '$' : 'U$D';
  suffix.textContent = esCompra ? 'ARS' : 'USD';
  input.value = '';
  preview.classList.remove('visible');
  confirm.disabled = true;
  modal.classList.remove('hidden');
  setTimeout(() => input.focus(), 50);

  const updatePreview = () => {
    const raw = input.value.replace(/\./g, '').replace(',', '.');
    const n   = Number(raw);
    confirm.disabled = !n || n <= 0;
    if (!n || !tasa) { preview.classList.remove('visible'); return; }
    preview.classList.add('visible');
    if (esCompra) {
      preAmt.textContent = `U$D ${(n / tasa).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    } else {
      preAmt.textContent = `${fmt(n * tasa)} ARS`;
    }
  };
  input.oninput = updatePreview;

  confirm.onclick = async () => {
    const monto = Number(input.value.replace(/\./g, '').replace(',', '.'));
    if (!monto || monto <= 0) return;
    btnLoad(confirm, true);
    try {
      const data = await apiFetch('/cuentas/convertir', {
        method: 'POST',
        body: JSON.stringify({ de, a, monto }),
      });
      modal.classList.add('hidden');
      showToast(data.message, 4000, 'success');
      await loadSaldo();
    } catch (e) {
      showToast(e.message || 'Error en la conversión', 4000, 'error');
    } finally {
      btnLoad(confirm, false);
    }
  };
};

// ── Modal transferir USD (2 pasos) ──
const abrirTransferirUSD = () => {
  const modal   = document.getElementById('usdTransferModal');
  if (!modal) return;

  const step1   = document.getElementById('usdTransferStep1');
  const step2   = document.getElementById('usdTransferStep2');
  const destInput  = document.getElementById('usdTransferDest');
  const searchResult = document.getElementById('usdTransferSearchResult');
  const searchErr  = document.getElementById('usdTransferSearchError');
  const nextBtn    = document.getElementById('usdTransferNextBtn');

  const montoInput = document.getElementById('usdTransferMonto');
  const errEl      = document.getElementById('usdTransferError');
  const equiv      = document.getElementById('usdTransferEquiv');
  const badge      = document.getElementById('usdTransferRateBadge');
  const confirm    = document.getElementById('usdTransferConfirm');
  const recipCard  = document.getElementById('usdTransferRecipientCard');

  const blue = _dolares.find(d => d.casa === 'blue');

  // Helpers
  const closeModal = () => modal.classList.add('hidden');
  const goStep1 = () => {
    step1?.classList.remove('hidden');
    step2?.classList.add('hidden');
    destInput.value = '';
    searchResult?.classList.add('hidden');
    searchErr && (searchErr.style.display = 'none');
    if (nextBtn) nextBtn.disabled = true;
    setTimeout(() => destInput?.focus(), 50);
  };
  const goStep2 = (destinatario) => {
    step1?.classList.add('hidden');
    step2?.classList.remove('hidden');
    montoInput.value = '';
    if (errEl) errEl.style.display = 'none';
    equiv?.classList.remove('visible');
    if (confirm) confirm.disabled = true;

    // Badge tasa
    if (badge && blue) badge.textContent = `Referencia blue · ${fmt(blue.compra)} ARS/USD`;

    // Tarjeta destinatario
    if (recipCard) {
      const iniciales = `${destinatario.nombre[0]}${destinatario.apellido[0]}`.toUpperCase();
      recipCard.innerHTML = `
        <div class="usd-recipient-avatar">${iniciales}</div>
        <div class="usd-recipient-info">
          <p class="usd-recipient-name">${destinatario.nombre} ${destinatario.apellido}</p>
          <p class="usd-recipient-alias">${destinatario.alias || destinatario.cbu}</p>
        </div>
        <span class="usd-recipient-badge">USD</span>`;
      recipCard.classList.remove('hidden');
    }
    setTimeout(() => montoInput?.focus(), 50);
  };

  // Abrir en paso 1
  modal.classList.remove('hidden');
  goStep1();

  // ── Paso 1: buscar destinatario ──
  let _destinatarioUSD = null;
  let _searchTimer = null;

  destInput.oninput = () => {
    const valor = destInput.value.trim();
    searchResult?.classList.add('hidden');
    searchErr && (searchErr.style.display = 'none');
    if (nextBtn) nextBtn.disabled = true;
    _destinatarioUSD = null;
    clearTimeout(_searchTimer);
    if (valor.length < 3) return;
    _searchTimer = setTimeout(async () => {
      try {
        // CBU → BC primero, fallback local; alias → BC primero, fallback local
        const esCBU = /^\d{22}$/.test(valor);
        let data;
        if (esCBU) {
          try {
            data = await apiFetch(`/transferencias/buscar/${encodeURIComponent(valor)}`);
          } catch (_) {
            // BC no encontró por CBU (cuentas USD no están en /persons) — buscar en DB local
            const local = await apiFetch(`/cuentas/buscar-usd/${encodeURIComponent(valor)}`);
            if (local.found) {
              data = local;
            } else {
              // CBU externo válido — BC acepta la transacción aunque no devuelva el nombre
              data = { cbu: valor, nombre: 'Cuenta', apellido: 'externa', alias: valor };
            }
          }
        } else {
          try {
            data = await apiFetch(`/transferencias/alias/${encodeURIComponent(valor)}`);
          } catch (_) {
            // BC no lo encontró — buscar alias en DB local (cuentas USD de este banco)
            const local = await apiFetch(`/cuentas/buscar-usd/${encodeURIComponent(valor)}`);
            if (!local.found) throw new Error('No se encontró una cuenta USD con ese alias o CBU');
            data = local;
          }
        }

        _destinatarioUSD = { ...data, _busquedaCbu: valor };
        if (searchErr) searchErr.style.display = 'none';
        if (searchResult) {
          const nombre   = data.nombre   || data.name || '?';
          const apellido = data.apellido || '';
          const ini = `${nombre[0]}${apellido[0] || ''}`.toUpperCase();
          searchResult.innerHTML = `
            <div class="usd-recipient-avatar">${ini}</div>
            <div class="usd-recipient-info">
              <p class="usd-recipient-name">${nombre} ${apellido}</p>
              <p class="usd-recipient-alias">${data.alias || data.cbu || valor}</p>
            </div>
            <span class="usd-recipient-badge">USD</span>`;
          searchResult.classList.remove('hidden');
        }
        if (nextBtn) nextBtn.disabled = false;
      } catch (e) {
        _destinatarioUSD = null;
        if (searchResult) searchResult.classList.add('hidden');
        if (searchErr) {
          searchErr.textContent = e.message?.includes('404') || e.message?.includes('no encontrad')
            ? 'No se encontró una cuenta con ese alias o CBU'
            : (e.message || 'No encontrado');
          searchErr.style.display = '';
        }
      }
    }, 500);
  };

  if (nextBtn) nextBtn.onclick = () => { if (_destinatarioUSD) goStep2(_destinatarioUSD); };

  // ── Paso 2: monto ──
  montoInput.oninput = () => {
    const n = Number(montoInput.value.replace(',', '.'));
    if (confirm) confirm.disabled = !n || n <= 0;
    if (n > 0 && blue?.compra) {
      if (equiv) { equiv.textContent = `≈ ${fmt(n * blue.compra)} ARS al tipo de cambio blue`; equiv.classList.add('visible'); }
    } else {
      equiv?.classList.remove('visible');
    }
  };

  if (confirm) confirm.onclick = async () => {
    const monto = Number(montoInput.value.replace(',', '.'));
    if (!monto || monto <= 0 || !_destinatarioUSD) return;
    if (errEl) errEl.style.display = 'none';
    btnLoad(confirm, true);
    try {
      const data = await apiFetch('/cuentas/transferir-usd', {
        method: 'POST',
        body: JSON.stringify({ cbuDestino: _destinatarioUSD.cbu, monto }),
      });
      closeModal();
      showToast(data.message || 'Transferencia realizada', 4000, 'success');
      await loadSaldo();
    } catch (e) {
      if (errEl) { errEl.textContent = e.message || 'Error en la transferencia'; errEl.style.display = ''; }
    } finally {
      btnLoad(confirm, false);
    }
  };

  const backBtn   = document.getElementById('usdTransferBack');
  const close2Btn = document.getElementById('usdTransferClose2');
  if (backBtn)   backBtn.onclick   = goStep1;
  if (close2Btn) close2Btn.onclick = closeModal;
};

// Inicializar solo si los elementos existen
document.addEventListener("DOMContentLoaded", async () => {
  // Verificación de seguridad inmediata
  const isAuthPage = window.location.href.includes("login.html") || window.location.href.includes("index.html") || window.location.pathname === "/";
  
  const { data: { session } } = await _supabase.auth.getSession();

  if (!session && !isAuthPage && window.location.href.includes("dashboard.html")) {
    window.location.href = "login.html";
    return;
  }

  // Ocultar pageLoader si no hay sesión activa (página de login)
  const pageLoaderEl = document.getElementById('pageLoader');
  if (pageLoaderEl && (!session || isAuthPage)) {
    pageLoaderEl.style.display = 'none';
  }

  // Splash de bienvenida (solo en el primer acceso tras login)
  if (session && sessionStorage.getItem("justLoggedIn")) {
    sessionStorage.removeItem("justLoggedIn");
    const splash     = document.getElementById("loginSplash");
    const splashName = document.getElementById("splashName");
    if (splash) {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      if (splashName) splashName.textContent = user.nombre || "";
      splash.classList.add("active");
      setTimeout(() => {
        splash.classList.remove("active");
        setTimeout(() => { splash.style.display = "none"; }, 1000);
      }, 2000);
    }
  }

  // Tabs
  if (tabs.length && loginForm && registerForm) {
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        tabs.forEach((item) => item.classList.remove("active"));
        tab.classList.add("active");

        const target = tab.dataset.target;
        loginForm.classList.toggle("hidden", target !== "login");
        registerForm.classList.toggle("hidden", target !== "register");
      });
    });
  }

  // Login form
  if (loginForm) {
    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      formLoad(loginForm, true);
      try {
        const data = await apiFetch("/auth/login", {
          method: "POST",
          body: JSON.stringify({
            email: document.getElementById("loginEmail").value,
            password: document.getElementById("loginPassword").value,
          }),
        });

        localStorage.setItem("user", JSON.stringify(data.user));
        if (data.session) await _supabase.auth.setSession(data.session);
        if (setOutput) setOutput(data);
        sessionStorage.setItem("justLoggedIn", "1");
        window.location.href = "dashboard.html";
      } catch (error) {
        showToast(error.message || 'Credenciales incorrectas', 4000, 'error');
        formLoad(loginForm, false);
      }
    });
  }

  // Register form
  if (registerForm) {
    registerForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      formLoad(registerForm, true);
      try {
        const data = await apiFetch("/auth/register", {
          method: "POST",
          body: JSON.stringify({
            nombre: document.getElementById("registerNombre").value,
            apellido: document.getElementById("registerApellido").value,
            dni: document.getElementById("registerDni").value,
            email: document.getElementById("registerEmail").value,
            password: document.getElementById("registerPassword").value,
          }),
        });

        localStorage.setItem("user", JSON.stringify(data.user));
        if (data.session) await _supabase.auth.setSession(data.session);
        sessionStorage.setItem("justLoggedIn", "1");
        window.location.href = "dashboard.html";
      } catch (error) {
        showToast(error.message || 'Error en el registro', 4000, 'error');
        formLoad(registerForm, false);
      }
    });
  }

  // Load movimientos button
  if (loadMovimientosBtn) {
    loadMovimientosBtn.addEventListener("click", async () => {
      btnLoad(loadMovimientosBtn, true);
      try {
        movimientosList.innerHTML = '<div class="loader">Cargando movimientos...</div>';
        const movimientos = await apiFetch("/movimientos");
        renderHeroMovimientos(movimientos);
        if (movimientosList) {
          if (movimientos.length === 0) {
            movimientosList.innerHTML = '<li class="muted" style="text-align:center; padding:20px;">No hay movimientos recientes</li>';
            return;
          }
          movimientosList.innerHTML = movimientos
            .map((mov) => {
              const isIngreso = mov.tipo === 'credito' || mov.tipo === 'deposito' || mov.tipo === 'transferencia_recibida';
              const icon = isIngreso ? 'fa-plus' : 'fa-minus';
              const iconBg = isIngreso ? 'amount-positive' : 'muted';
              
              const bankBadge = mov.banco_nombre
                ? `<span class="mov-bank-badge">${mov.banco_nombre}</span>`
                : '';
              return `
                <li class="movement-item">
                  <div class="mov-info">
                    <div class="mov-icon ${iconBg}"><i class="fas ${icon}"></i></div>
                    <div class="mov-text">
                      <b>${mov.descripcion || "Operación Nodo"}</b>
                      <span>${new Date(mov.fecha_movimiento).toLocaleDateString()}${bankBadge}</span>
                    </div>
                  </div>
                  <div class="mov-amount ${isIngreso ? 'amount-positive' : ''}">${isIngreso ? '+' : ''}$${Math.abs(mov.monto).toLocaleString()}</div>
                </li>
              `;
            })
            .join("");
        }
        if (setOutput) setOutput(movimientos);
      } catch (error) {
        if (setOutput) setOutput(error.message);
      } finally {
        btnLoad(loadMovimientosBtn, false);
      }
    });
  }

  // Logout button
  if (logoutBtn) {
    logoutBtn.addEventListener("click", cerrarSesion);
  }

  // Theme toggle
  document.querySelectorAll('.btn-theme-toggle').forEach(btn => btn.addEventListener('click', toggleTheme));

  // Verificación de CBU en tiempo real
  const cbuDestinoInput = document.getElementById("cbuDestino");
  const receptorInfo = document.getElementById("receptorInfo");

  if (cbuDestinoInput && receptorInfo) {
    cbuDestinoInput.addEventListener("input", debounce(async () => {
      const valor = cbuDestinoInput.value.trim();
      
      // Si son 22 números, buscamos por CBU
      if (valor.length === 22 && /^\d+$/.test(valor)) {
        receptorInfo.textContent = "Verificando destinatario...";
        receptorInfo.style.color = "#666";
        cbuDestinoVerificado = "";
        destinatarioValidado = null;
        
        try {
          const persona = await apiFetch(`/transferencias/buscar/${valor}`);
          receptorInfo.textContent = `${persona.nombre} ${persona.apellido}`;
          receptorInfo.style.color = "#059669";
          cbuDestinoVerificado = persona.cbu;
          destinatarioValidado = persona;
          setTimeout(() => selectRecipient(persona), 500);
        } catch (error) {
          receptorInfo.textContent = "CBU no encontrado";
          receptorInfo.style.color = "#d32f2f";
        }
      } 
      // Si no es un CBU pero tiene longitud mínima de alias (ej. 4 caracteres)
      else if (valor.length >= 4 && !/^\d+$/.test(valor)) {
        cbuDestinoVerificado = "";
        destinatarioValidado = null;
        try {
          const aliasNorm = valor.trim();
          const persona = await apiFetch(`/transferencias/alias/${encodeURIComponent(aliasNorm)}`);
          receptorInfo.textContent = `${persona.nombre} ${persona.apellido}`;
          receptorInfo.style.color = "#059669";
          cbuDestinoVerificado = persona.cbu;
          destinatarioValidado = persona;
          setTimeout(() => selectRecipient(persona), 500);
        } catch (error) {
          const msg = error.message?.includes("404") || error.message?.toLowerCase().includes("no encontrado")
            ? "Alias no encontrado"
            : error.message || "Error al buscar alias";
          receptorInfo.textContent = msg;
          receptorInfo.style.color = "#d32f2f";
          cbuDestinoVerificado = "";
          destinatarioValidado = null;
        }
      } else {
        receptorInfo.textContent = "";
      }
    }, 400));
  }

  // Transfer form
  if (transferForm) {
    transferForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      if (!cuentaActiva) {
        showToast('No se pudo identificar tu cuenta. Recargá la página.', 4000, 'error');
        return;
      }

      const monto = Number(document.getElementById("monto").value);

      if (isNaN(monto) || monto <= 0) {
        showToast('Ingresá un monto válido mayor a cero.', 3500, 'error');
        return;
      }

      if (monto > saldoActual) {
        showToast('Saldo insuficiente para realizar esta transferencia.', 4000, 'error');
        return;
      }

      const cbuDest = cbuDestinoVerificado || document.getElementById("cbuDestino").value;
      const receptorNombre = destinatarioValidado ? `${destinatarioValidado.nombre} ${destinatarioValidado.apellido}` : cbuDest;
      const receptorDni = destinatarioValidado?.dni || "No disponible";
      const receptorBanco = destinatarioValidado?.bankName || "Entidad Externa";

      try {
        formLoad(transferForm, true);

        const data = await apiFetch("/transferencias", {
          method: "POST",
          body: JSON.stringify({
            cuentaOrigenId: cuentaActiva.id,
            cbuDestino: cbuDest,
            monto: monto,
            concepto: document.getElementById("concepto").value,
          }),
        });

        // Mostrar Comprobante
        const user = JSON.parse(localStorage.getItem("user") || "{}");
        const ahora = new Date();
        
        document.getElementById("receiptAmount").textContent = `$ ${monto.toLocaleString('es-AR')}`;
        document.getElementById("receiptDateTime").textContent = ahora.toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        document.getElementById("receiptFromInfo").innerHTML = `<b>${user.nombre} ${user.apellido}</b><br>DNI: ${user.dni || 'No disponible'}<br>Banco: Nodo<br>CBU: ${cuentaActiva.cbu}`;
        document.getElementById("receiptToInfo").innerHTML = `<b>${receptorNombre}</b><br>DNI: ${receptorDni}<br>Banco: ${receptorBanco}<br>CBU: ${cbuDest}`;
        
        document.getElementById("receiptModal").classList.remove("hidden");

        if (destinatarioValidado) addReciente(destinatarioValidado);
        cbuDestinoVerificado = "";
        destinatarioValidado = null;
        transferForm.reset();
        if (receptorInfo) receptorInfo.textContent = "";

        // Cerrar modal
        closeTransferModal();

        // Recargar datos de la interfaz
        loadSaldo();
        if (loadMovimientosBtn) loadMovimientosBtn.click();

        if (setOutput) setOutput(data);
      } catch (error) {
        showToast(error.message || 'No se pudo realizar la transferencia', 4500, 'error');
        if (setOutput) setOutput("ERROR: " + error.message);
      } finally {
        formLoad(transferForm, false);
      }
    });
  }

  // Deposit form
  const depositForm = document.getElementById("depositForm");
  if (depositForm) {
    depositForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      if (!cuentaActiva) return void showToast('No se pudo identificar tu cuenta. Recargá la página.', 4000, 'error');

      const monto = Number(document.getElementById("depositMonto").value);
      if (isNaN(monto) || monto <= 0) return void showToast('Ingresá un monto válido mayor a cero.', 3500, 'error');

      formLoad(depositForm, true);
      try {
        

        const data = await apiFetch("/cuentas/depositar", {
          method: "POST",
          body: JSON.stringify({ cuenta_id: cuentaActiva.id, monto: monto }),
        });

        if (setOutput) setOutput(data);
        loadSaldo();

        // Cerrar panel y limpiar
        depositForm.reset();
        const formsContainer = document.getElementById("operationFormsContainer");
        const depositArea    = document.getElementById("depositArea");
        if (depositArea)    depositArea.classList.add("hidden");
        if (formsContainer) formsContainer.classList.add("hidden");

        showToast(`Depósito de $${monto.toLocaleString('es-AR')} acreditado`, 4000, 'success');
      } catch (error) {
        showToast(error.message || 'Error al realizar el depósito', 4000, 'error');
        if (setOutput) setOutput(error.message);
      } finally {
        formLoad(depositForm, false);
      }
    });
  }

  // Botón de Sincronización
  const syncBtn = document.getElementById("syncBtn");
  if (syncBtn) {
    syncBtn.addEventListener("click", async () => {
      try {
        syncBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sincronizando...';
        const data = await apiFetch("/transferencias/sincronizar");

        await loadSaldo();
        if (loadMovimientosBtn) loadMovimientosBtn.click();

        if (data.transferenciasRecibidas > 0) {
          const n = data.transferenciasRecibidas;
          showToast(`${n} transferencia${n > 1 ? 's' : ''} recibida${n > 1 ? 's' : ''}`, 5000, 'success');
        } else {
          showToast('Sin transferencias nuevas', 3000, 'info');
        }

      } catch (error) {
        showToast('Error al sincronizar', 4000, 'error');
        if (setOutput) setOutput(error.message);
      } finally {
        syncBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Sincronizar';
      }
    });
  }

  // Restore user session
  const savedUser = localStorage.getItem("user");
  const actualizarIndicadorPerfil = () => {
    const u = JSON.parse(localStorage.getItem("user") || "{}");
    const incompleto = !u.telefono || !u.direccion;

    // Punto en botón "Editar perfil"
    document.getElementById("loadPerfilBtn")?.classList.toggle("has-notification", incompleto);

    // Punto animado en avatar
    const avatarWrapper = document.querySelector(".avatar-wrapper");
    if (avatarWrapper) {
      avatarWrapper.style.position = "relative";
      let dot = avatarWrapper.querySelector(".avatar-notify-dot");
      if (incompleto && !dot) {
        dot = document.createElement("span");
        dot.className = "avatar-notify-dot";
        avatarWrapper.appendChild(dot);
      } else if (!incompleto && dot) {
        dot.remove();
      }
    }

    // La barra de progreso del dropdown muestra el estado de completitud
    // No inyectar banner rojo — ya existe la UI de progreso en el nuevo diseño
  };

  if (savedUser) {
    const user = JSON.parse(savedUser);
    if (document.getElementById("userName")) {
      document.getElementById("userName").textContent = `${user.nombre} ${user.apellido}`;
    }
    const nombreCompleto = `${user.nombre} ${user.apellido || ""}`.toUpperCase().trim();
    const userCardName = document.getElementById("userCardName");
    if (userCardName) userCardName.textContent = nombreCompleto;
    const cardDataTitular = document.getElementById("cardDataTitular");
    if (cardDataTitular) cardDataTitular.textContent = nombreCompleto;
    actualizarIndicadorPerfil();
  }

  // Toggle panel datos de tarjeta
  const toggleCardDataBtn = document.getElementById('toggleCardDataBtn');
  const cardDataPanel     = document.getElementById('cardDataPanel');
  if (toggleCardDataBtn && cardDataPanel) {
    toggleCardDataBtn.addEventListener('click', () => {
      const isOpen = !cardDataPanel.classList.contains('hidden');
      cardDataPanel.classList.toggle('hidden');
      toggleCardDataBtn.classList.toggle('unlocked', !isOpen);
      const icon  = toggleCardDataBtn.querySelector('i');
      const label = toggleCardDataBtn.querySelector('span');
      icon.className    = isOpen ? 'fas fa-lock' : 'fas fa-lock-open';
      label.textContent = isOpen ? 'Ver datos de tarjeta' : 'Ocultar datos';
      if (isOpen) {
        const cvvEl  = document.getElementById('cardDataCvv');
        const panEl  = document.getElementById('cardDataPan');
        const revCvv = document.getElementById('revealCvvBtn');
        const revPan = document.getElementById('revealPanBtn');
        if (cvvEl)  cvvEl.textContent = '•••';
        if (panEl && tarjetaActiva)  { panEl.textContent = tarjetaActiva.pan_masked; panEl.dataset.value = tarjetaActiva.pan_masked?.replace(/\s/g,'') || ''; }
        if (revCvv) revCvv.innerHTML  = '<i class="fas fa-eye"></i>';
        if (revPan) revPan.innerHTML  = '<i class="fas fa-eye"></i>';
      }
    });
  }

  // ── Card Engine: event listeners ──
  if (session) cargarTarjeta();

  document.getElementById('emitirTarjetaBtn')?.addEventListener('click', async () => {
    const btn = document.getElementById('emitirTarjetaBtn');
    btn.disabled = true; btn.textContent = 'Emitiendo...';
    try {
      const data = await apiFetch('/cards', { method: 'POST' });
      const cvvEmitido = data.cvv;
      await cargarTarjeta();
      if (cvvEmitido) {
        showToast(`Tarjeta emitida · CVV: ${cvvEmitido}`, 8000, 'success');
      } else {
        showToast('Tarjeta emitida correctamente', 3000, 'success');
      }
    } catch (err) {
      showToast(err.message || 'Error al emitir tarjeta', 3500, 'error');
    } finally {
      const b = document.getElementById('emitirTarjetaBtn');
      if (b) { b.disabled = false; b.innerHTML = '<i class="fas fa-plus" style="margin-right:6px;"></i>Emitir tarjeta virtual'; }
    }
  });

  document.getElementById('toggleCardStatusBtn')?.addEventListener('click', async () => {
    if (!tarjetaActiva) return;
    const newStatus = tarjetaActiva.status === 'active' ? 'blocked' : 'active';
    try {
      await apiFetch(`/cards/${tarjetaActiva.id}/status`, { method: 'PATCH', body: JSON.stringify({ status: newStatus }) });
      tarjetaActiva.status = newStatus;
      renderTarjeta();
      showToast(newStatus === 'blocked' ? 'Tarjeta bloqueada' : 'Tarjeta activada', 3000, newStatus === 'blocked' ? 'error' : 'success');
    } catch (err) {
      showToast(err.message || 'Error al cambiar estado', 3500, 'error');
    }
  });

  // Revelar / ocultar número de tarjeta
  document.getElementById('revealPanBtn')?.addEventListener('click', () => {
    const panEl = document.getElementById('cardDataPan');
    const btn   = document.getElementById('revealPanBtn');
    if (!panEl || !tarjetaActiva) return;
    if (!tarjetaActiva.pan) {
      showToast('Esta tarjeta es antigua y no tiene el número guardado. Cancelala y emití una nueva.', 4000, 'error');
      return;
    }
    const visible = panEl.textContent !== tarjetaActiva.pan_masked;
    const fullPan = tarjetaActiva.pan.replace(/(\d{4})(?=\d)/g, '$1 ');
    panEl.textContent      = visible ? tarjetaActiva.pan_masked : fullPan;
    panEl.dataset.value    = visible ? tarjetaActiva.pan_masked.replace(/\s/g,'') : tarjetaActiva.pan;
    btn.innerHTML          = visible ? '<i class="fas fa-eye"></i>' : '<i class="fas fa-eye-slash"></i>';
    btn.title              = visible ? 'Mostrar número' : 'Ocultar número';
  });

  // Revelar / ocultar CVV
  document.getElementById('revealCvvBtn')?.addEventListener('click', () => {
    const cvvEl  = document.getElementById('cardDataCvv');
    const btn    = document.getElementById('revealCvvBtn');
    if (!cvvEl || !tarjetaActiva) return;
    if (!tarjetaActiva.cvv) {
      showToast('Esta tarjeta es antigua y no tiene el CVV guardado. Cancelala y emití una nueva.', 4000, 'error');
      return;
    }
    const visible = cvvEl.textContent !== '•••';
    cvvEl.textContent = visible ? '•••' : tarjetaActiva.cvv;
    btn.innerHTML     = visible ? '<i class="fas fa-eye"></i>' : '<i class="fas fa-eye-slash"></i>';
    btn.title         = visible ? 'Mostrar CVV' : 'Ocultar CVV';
  });

  // Cancelar tarjeta — confirmación inline
  const cancelConfirmEl = document.getElementById('cancelCardConfirm');
  document.getElementById('cancelarTarjetaBtn')?.addEventListener('click', () => {
    cancelConfirmEl?.classList.remove('hidden');
  });
  document.getElementById('cancelCardConfirmNo')?.addEventListener('click', () => {
    cancelConfirmEl?.classList.add('hidden');
  });
  document.getElementById('cancelCardConfirmYes')?.addEventListener('click', async () => {
    if (!tarjetaActiva) return;
    const btn = document.getElementById('cancelCardConfirmYes');
    btn.disabled = true; btn.textContent = 'Cancelando...';
    try {
      await apiFetch(`/cards/${tarjetaActiva.id}`, { method: 'DELETE' });
      tarjetaActiva = null;
      cancelConfirmEl?.classList.add('hidden');
      renderTarjeta();
      showToast('Tarjeta cancelada. Podés emitir una nueva cuando quieras.', 4000, 'success');
    } catch (err) {
      showToast(err.message || 'Error al cancelar la tarjeta', 3500, 'error');
      btn.disabled = false; btn.textContent = 'Sí, cancelar';
    }
  });

  // Modal pagar con tarjeta
  document.getElementById('pagarTarjetaBtn')?.addEventListener('click', () => {
    const modal = document.getElementById('cardPayModal');
    if (!modal) return;
    // Reset tabs to Comercio
    modal.querySelectorAll('[data-pay-tab]').forEach(b => b.classList.toggle('active', b.dataset.payTab === 'merchant'));
    document.getElementById('payMerchantSection')?.classList.remove('hidden');
    document.getElementById('payPersonSection')?.classList.add('hidden');
    const preview = document.getElementById('payAliasPreview');
    if (preview) preview.textContent = '';
    payCardCBUVerificado = '';
    modal.classList.remove('hidden');
  });
  document.getElementById('closeCardPayModal')?.addEventListener('click', () => {
    document.getElementById('cardPayModal')?.classList.add('hidden');
    payCardCBUVerificado = '';
  });

  // Tab switching inside card pay modal
  document.getElementById('cardPayModal')?.querySelectorAll('[data-pay-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('cardPayModal').querySelectorAll('[data-pay-tab]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.payTab;
      document.getElementById('payMerchantSection')?.classList.toggle('hidden', tab !== 'merchant');
      document.getElementById('payPersonSection')?.classList.toggle('hidden', tab !== 'person');
      payCardCBUVerificado = '';
      const preview = document.getElementById('payAliasPreview');
      if (preview) preview.textContent = '';
    });
  });

  // Alias resolution for card person-pay tab
  document.getElementById('payAlias')?.addEventListener('input', debounce(async () => {
    const valor = document.getElementById('payAlias').value.trim();
    const preview = document.getElementById('payAliasPreview');
    if (!preview) return;
    payCardCBUVerificado = '';
    if (!valor) { preview.textContent = ''; return; }

    preview.textContent = 'Verificando...';
    preview.style.color = '#666';
    try {
      const isCBU = valor.length === 22 && /^\d+$/.test(valor);
      let persona;
      if (isCBU) {
        persona = await apiFetch(`/transferencias/buscar/${valor}`);
      } else if (valor.length >= 4) {
        persona = await apiFetch(`/transferencias/alias/${encodeURIComponent(valor)}`);
      } else {
        preview.textContent = '';
        return;
      }
      if (persona && persona.nombre) {
        preview.textContent = `${persona.nombre} ${persona.apellido}`;
        preview.style.color = '#059669';
        payCardCBUVerificado = persona.cbu;
      } else {
        preview.textContent = 'Destinatario no encontrado';
        preview.style.color = '#d32f2f';
      }
    } catch {
      preview.textContent = 'Destinatario no encontrado';
      preview.style.color = '#d32f2f';
    }
  }, 500));

  const payAmountInput = document.getElementById('payAmount');
  if (payAmountInput) {
    payAmountInput.addEventListener('input', () => {
      const digits = payAmountInput.value.replace(/\D/g, '');
      payAmountInput.value = digits ? Number(digits).toLocaleString('es-AR') : '';
    });
  }

  document.getElementById('cardPayForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!tarjetaActiva) return;

    const activeTab = document.getElementById('cardPayModal')?.querySelector('[data-pay-tab].active')?.dataset.payTab || 'merchant';
    const amountStr = document.getElementById('payAmount').value.replace(/\./g, '').replace(/,/g, '.');
    const amount    = Number(amountStr);
    if (!amount) { showToast('Ingresá un monto válido', 3000, 'error'); return; }

    let merchantName, merchantCategory, cbuDestino;

    if (activeTab === 'person') {
      if (!payCardCBUVerificado) {
        showToast('Buscá un destinatario válido antes de confirmar', 3000, 'error');
        return;
      }
      const aliasVal = document.getElementById('payAlias').value.trim();
      const preview  = document.getElementById('payAliasPreview');
      merchantName     = preview?.textContent || aliasVal;
      merchantCategory = 'transferencia';
      cbuDestino       = payCardCBUVerificado;
    } else {
      merchantName     = document.getElementById('payMerchant').value.trim();
      merchantCategory = document.getElementById('payCategory').value;
      if (!merchantName) { showToast('Ingresá el nombre del comercio', 3000, 'error'); return; }
    }

    const btn = e.target.querySelector('button[type="submit"]');
    if (btn) { btn.disabled = true; btn.textContent = 'Procesando...'; }
    try {
      const payload = { cardId: tarjetaActiva.id, merchantName, merchantCategory, amount };
      if (cbuDestino) payload.cbuDestino = cbuDestino;

      const res = await apiFetch('/cards/visa/authorize', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      document.getElementById('cardPayModal').classList.add('hidden');
      e.target.reset();
      payCardCBUVerificado = '';
      const preview = document.getElementById('payAliasPreview');
      if (preview) preview.textContent = '';
      showToast(`Pago aprobado · Auth: ${res.authorizationCode} · Nuevo saldo: $${Number(res.newBalance).toLocaleString('es-AR')}`, 5000, 'success');
      await loadSaldo();
      await cargarHistorialTarjeta(tarjetaActiva.id);
    } catch (err) {
      showToast(err.message || 'Pago rechazado', 4000, 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Confirmar pago'; }
    }
  });

  // ========== NUEVAS FUNCIONALIDADES ==========

  // Elementos del perfil
  const loadPerfilBtn = document.getElementById("loadPerfilBtn");
  const editPerfilBtn = document.getElementById("editPerfilBtn");
  const editAliasBtn = document.getElementById("editAliasBtn");
  const aliasForm = document.getElementById("aliasForm");
  const cancelAliasBtn = document.getElementById("cancelAliasBtn");
  const perfilForm = document.getElementById("perfilForm");
  const perfilData = document.getElementById("perfilData");
  const cancelPerfilBtn = document.getElementById("cancelPerfilBtn");
  const changePasswordBtn = document.getElementById("changePasswordBtn");
  const passwordForm = document.getElementById("passwordForm");
  const cancelPasswordBtn = document.getElementById("cancelPasswordBtn");
  const aliasModal = document.getElementById("aliasModal");
  const passwordModal = document.getElementById("passwordModal");


  // Cargar datos del perfil
  if (loadPerfilBtn) {
    loadPerfilBtn.addEventListener("click", async () => {
      try {
        // Obtener datos del usuario y cuenta
        const user = JSON.parse(localStorage.getItem("user") || "{}");
        const cuentas = await apiFetch("/cuentas/saldo");
        const cuenta = cuentas[0] || {};

        if (perfilData) {
          perfilData.innerHTML = `
            <div class="profile-card">
              <div class="info-row">
                <span class="label">Nombre completo</span>
                <span class="value">${user.nombre || ""} ${user.apellido || ""}</span>
              </div>
              <div class="info-row">
                <span class="label">Email</span>
                <span class="value">${user.email || ""}</span>
              </div>
            </div>
          `;
        }

        // Mostrar botones de edición
        if (editAliasBtn) editAliasBtn.classList.remove("hidden");
        if (editPerfilBtn) editPerfilBtn.classList.remove("hidden");
        if (changePasswordBtn) changePasswordBtn.classList.remove("hidden");

        if (setOutput) setOutput({ user, cuenta });
      } catch (error) {
        if (setOutput) setOutput(error.message);
      }
    });
  }

  // Abrir modal de alias
  if (editAliasBtn) {
    editAliasBtn.addEventListener("click", () => {
      if (aliasModal) aliasModal.classList.remove("hidden");
    });
  }

  // Cerrar modal de alias
  if (cancelAliasBtn) {
    cancelAliasBtn.addEventListener("click", () => {
      if (aliasModal) aliasModal.classList.add("hidden");
    });
  }
  if (aliasModal) {
    aliasModal.addEventListener("click", (e) => {
      if (e.target === aliasModal) aliasModal.classList.add("hidden");
    });
  }

  const perfilModal = document.getElementById("perfilModal");

  // Abrir modal de perfil
  if (editPerfilBtn) {
    editPerfilBtn.addEventListener("click", () => {
      if (perfilModal) perfilModal.classList.remove("hidden");
    });
  }

  // Cerrar modal de perfil
  if (cancelPerfilBtn) {
    cancelPerfilBtn.addEventListener("click", () => {
      if (perfilModal) perfilModal.classList.add("hidden");
    });
  }
  if (perfilModal) {
    perfilModal.addEventListener("click", (e) => {
      if (e.target === perfilModal) perfilModal.classList.add("hidden");
    });
  }

  // Guardar cambio de Alias únicamente
  if (aliasForm) {
    aliasForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const newAlias = document.getElementById("newAliasInput")?.value;
      formLoad(aliasForm, true);
      try {
        const data = await apiFetch("/auth/perfil", {
          method: "PUT",
          body: JSON.stringify({
            alias: newAlias
          }),
        });

        showToast('Alias actualizado con éxito', 3000, 'success');
        
        if (setOutput) setOutput(data);

        // Limpiar y cerrar modal
        document.getElementById("newAliasInput").value = "";
        if (aliasModal) aliasModal.classList.add("hidden");

        // Recargar datos del perfil para ver el cambio
        loadPerfilBtn.click();
      } catch (error) {
        if (error.message.includes("409")) {
          showToast('El alias ya está en uso por otro usuario.', 4000, 'error');
        } else {
          showToast(error.message || 'Error al cambiar alias', 4000, 'error');
        }
        if (setOutput) setOutput(error.message);
      } finally {
        formLoad(aliasForm, false);
      }
    });
  }

  // Guardar cambios del perfil
  if (perfilForm) {
    perfilForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      formLoad(perfilForm, true);
      try {
        const data = await apiFetch("/auth/perfil", {
          method: "PUT",
          body: JSON.stringify({
            alias: document.getElementById("perfilAlias")?.value || undefined,
            nombre: document.getElementById("perfilNombre")?.value || undefined,
            apellido: document.getElementById("perfilApellido")?.value || undefined,
            telefono: document.getElementById("perfilTelefono")?.value || undefined,
            direccion: document.getElementById("perfilDireccion")?.value || undefined,
          }),
        });

        if (setOutput) setOutput(data);

        // Actualizar usuario en localStorage
        if (data.user) {
          localStorage.setItem("user", JSON.stringify(data.user));
          actualizarIndicadorPerfil();
        }

        showToast("Perfil actualizado correctamente", 3000, "success");

        // Cerrar modal
        if (perfilModal) perfilModal.classList.add("hidden");

        // Recargar datos del perfil
        loadPerfilBtn.click();
      } catch (error) {
        if (setOutput) setOutput(error.message);
      } finally {
        formLoad(perfilForm, false);
      }
    });
  }

  // Abrir modal de contraseña
  if (changePasswordBtn) {
    changePasswordBtn.addEventListener("click", () => {
      if (passwordModal) passwordModal.classList.remove("hidden");
    });
  }

  // Cerrar modal de contraseña
  if (cancelPasswordBtn) {
    cancelPasswordBtn.addEventListener("click", () => {
      if (passwordModal) passwordModal.classList.add("hidden");
    });
  }
  if (passwordModal) {
    passwordModal.addEventListener("click", (e) => {
      if (e.target === passwordModal) passwordModal.classList.add("hidden");
    });
  }

  // Guardar nueva contraseña
  if (passwordForm) {
    passwordForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      formLoad(passwordForm, true);
      try {
        const data = await apiFetch("/auth/password", {
          method: "PUT",
          body: JSON.stringify({
            currentPassword: document.getElementById("currentPassword").value,
            newPassword: document.getElementById("newPassword").value,
          }),
        });

        if (setOutput) setOutput(data);

        // Limpiar formulario
        document.getElementById("currentPassword").value = "";
        document.getElementById("newPassword").value = "";

        // Cerrar modal
        if (passwordModal) passwordModal.classList.add("hidden");
      } catch (error) {
        showToast(error.message || 'Error al cambiar contraseña', 4000, 'error');
        if (setOutput) setOutput(error.message);
      } finally {
        formLoad(passwordForm, false);
      }
    });
  }

  // ========== RESERVAS ==========
  const reservaForm        = document.getElementById("reservaForm");
  const reservasList       = document.getElementById("reservasList");
  const showReservaFormBtn = document.getElementById("showReservaFormBtn");
  const cancelReservaBtn   = document.getElementById("cancelReservaBtn");
  const reservaDetailModal = document.getElementById("reservaDetailModal");
  const closeReservaDetail = document.getElementById("closeReservaDetail");

  if (closeReservaDetail) closeReservaDetail.addEventListener("click", () => reservaDetailModal?.classList.add("hidden"));
  if (reservaDetailModal)  reservaDetailModal.addEventListener("click", e => { if (e.target === reservaDetailModal) reservaDetailModal.classList.add("hidden"); });

  // ── Reservas — lógica financiera estática (sin setInterval) ──
  const TASA_RESERVA = 0.18; // TNA 18%

  // Días completos acreditados (lógica bancaria: se acredita una vez al día)
  const _diasCompletos = (res) => {
    const desde = new Date(res.fecha_creacion);
    const ahora = new Date();
    return Math.max(0, Math.floor((ahora - desde) / 86400000));
  };

  // Ganancia por un día según el saldo principal
  const _gananciaDiaria = (monto) => monto * TASA_RESERVA / 365;

  // Interés total acumulado hasta hoy (suma de días completos)
  const _interesAcumulado = (res) => _gananciaDiaria(Number(res.monto)) * _diasCompletos(res);

  // Valor actual = capital + interés acumulado
  const _valorActualReserva = (res) => Number(res.monto) + _interesAcumulado(res);

  // Proyección al vencimiento
  const _calcProyeccion = (res) => {
    const hoy  = new Date();
    const venc = new Date(res.fecha_vencimiento);
    const monto = Number(res.monto);
    const diasRest = Math.max(0, Math.round((venc - hoy) / 86400000));
    const diasTotales = Math.round((venc - new Date(res.fecha_creacion)) / 86400000);
    return {
      diasRest,
      gananciaDiaria: _gananciaDiaria(monto),
      interesAcum: _interesAcumulado(res),
      valorActual: _valorActualReserva(res),
      total: monto + _gananciaDiaria(monto) * diasTotales,
    };
  };

  // Genera el historial de acreditaciones diarias (hasta maxDias, más reciente primero)
  const _historialDiario = (res, maxDias = 30) => {
    const dias = Math.min(_diasCompletos(res), maxDias);
    const ganancia = _gananciaDiaria(Number(res.monto));
    const hoy = new Date();
    return Array.from({ length: dias }, (_, i) => {
      const fecha = new Date(hoy);
      fecha.setDate(fecha.getDate() - i);
      return {
        label: i === 0 ? 'Hoy' : fecha.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }),
        ganancia,
      };
    });
  };

  const _fmt2 = (n) => n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // ── Modal de detalle (estático — sin timers) ──────────────────
  const abrirReservaDetail = (res) => {
    const { diasRest, gananciaDiaria, interesAcum, valorActual, total } = _calcProyeccion(res);
    const monto    = Number(res.monto);
    const historial = _historialDiario(res, 30);
    const body      = document.getElementById("reservaDetailBody");
    if (body) {
      body.innerHTML = `
        <!-- Badge TNA -->
        <div class="reserva-tna-badge">
          <i class="fas fa-chart-line"></i> Rindiendo al ${(TASA_RESERVA * 100).toFixed(0)}% TNA
        </div>

        <!-- Saldo total destacado -->
        <div class="reserva-detail-hero">
          <span class="reserva-detail-hero-label">Valor actual</span>
          <span class="reserva-detail-hero-monto">$${_fmt2(valorActual)}</span>
          <span class="reserva-detail-hero-ganancia">+$${_fmt2(interesAcum)} ganados desde el inicio</span>
        </div>

        <!-- Desglose rápido -->
        <div class="reserva-detail-grid">
          <div class="reserva-detail-row">
            <span class="reserva-detail-label">Monto depositado</span>
            <span class="reserva-detail-value">$${_fmt2(monto)}</span>
          </div>
          <div class="reserva-detail-row">
            <span class="reserva-detail-label">Rendimiento diario estimado</span>
            <span class="reserva-detail-value amount-positive">+$${_fmt2(gananciaDiaria)}</span>
          </div>
          <div class="reserva-detail-row">
            <span class="reserva-detail-label">Días acreditados</span>
            <span class="reserva-detail-value">${_diasCompletos(res)}</span>
          </div>
          <div class="reserva-detail-row">
            <span class="reserva-detail-label">Días al vencimiento</span>
            <span class="reserva-detail-value">${diasRest} días</span>
          </div>
          <div class="reserva-detail-row reserva-detail-total">
            <span class="reserva-detail-label">Total estimado al vencimiento</span>
            <span class="reserva-detail-value">$${_fmt2(total)}</span>
          </div>
          <p class="reserva-detail-date"><i class="far fa-calendar-alt"></i> Vence el ${new Date(res.fecha_vencimiento).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
        </div>

        <!-- Historial de acreditaciones (colapsable) -->
        ${historial.length > 0 ? `
        <div class="reserva-historial-wrap">
          <button class="reserva-historial-toggle" id="rvHistorialBtn" aria-expanded="false">
            <i class="fas fa-history"></i>
            <span>Historial de rendimientos (${historial.length} días)</span>
            <i class="fas fa-chevron-down reserva-historial-chevron"></i>
          </button>
          <ul class="reserva-historial-list hidden" id="rvHistorialList">
            ${historial.map(e => `
              <li class="reserva-historial-item">
                <span class="reserva-historial-fecha">${e.label}</span>
                <span class="reserva-historial-ganancia amount-positive">+$${_fmt2(e.ganancia)}</span>
              </li>`).join('')}
          </ul>
        </div>` : ''}

        <!-- Acciones -->
        <div class="reserva-modal-acciones">
          <button class="btn-secondary reserva-accion-btn" id="reservaIngresarBtn">
            <i class="fas fa-plus-circle"></i> Ingresar más
          </button>
          <button class="btn-danger reserva-accion-btn" id="reservaRescatarBtn">
            <i class="fas fa-hand-holding-usd"></i> Retirar reserva
          </button>
        </div>
      `;

      // Acordeón historial
      document.getElementById('rvHistorialBtn')?.addEventListener('click', () => {
        const list = document.getElementById('rvHistorialList');
        const btn  = document.getElementById('rvHistorialBtn');
        const open = btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', String(!open));
        btn.querySelector('.reserva-historial-chevron')?.classList.toggle('rotated', !open);
        list?.classList.toggle('hidden', open);
      });

      // Ingresar más (placeholder — flujo a implementar)
      document.getElementById('reservaIngresarBtn')?.addEventListener('click', () => {
        showToast('Función de ingreso adicional próximamente.', 2500, 'info');
      });

      // Retirar / Rescatar
      document.getElementById('reservaRescatarBtn')?.addEventListener('click', async () => {
        const rescatarBtn = document.getElementById('reservaRescatarBtn');
        rescatarBtn.disabled = true;
        rescatarBtn.textContent = 'Retirando…';
        try {
          await apiFetch(`/reservas/${res.id}`, { method: 'DELETE' });
          reservaDetailModal?.classList.add('hidden');
          showToast(`Reserva "${res.nombre}" rescatada con éxito.`, 3000, 'success');
          await cargarReservas();
        } catch (err) {
          showToast(err.message || 'Error al rescatar la reserva', 3500, 'error');
          rescatarBtn.disabled = false;
          rescatarBtn.innerHTML = '<i class="fas fa-hand-holding-usd"></i> Retirar reserva';
        }
      });
    }
    document.getElementById("reservaDetailNombre").textContent = res.nombre;
    reservaDetailModal?.classList.remove("hidden");
  };

  // ── Render de la lista (100% estático, sin setInterval) ──────
  const renderReservas = (reservas) => {
    if (!reservasList) return;

    if (reservas.length === 0) {
      reservasList.innerHTML = '<li class="muted" style="text-align:center;padding:15px;">No tenés reservas activas</li>';
      return;
    }

    reservasList.innerHTML = reservas.map(res => {
      const valorActual   = _valorActualReserva(res);
      const gananciaDiaria = _gananciaDiaria(Number(res.monto));
      const diasAcum       = _diasCompletos(res);
      return `
        <li class="reserva-item" data-id="${res.id}">
          <div class="reserva-item-top">
            <div class="reserva-item-info">
              <span class="reserva-item-nombre">${res.nombre}</span>
              <span class="reserva-tna-pill"><i class="fas fa-circle-check"></i> ${(TASA_RESERVA*100).toFixed(0)}% TNA</span>
            </div>
            <div class="reserva-item-montos">
              <span class="reserva-item-monto">$${_fmt2(valorActual)}</span>
              ${diasAcum > 0 ? `<span class="reserva-item-ganancia">+$${_fmt2(gananciaDiaria)} hoy</span>` : '<span class="reserva-item-ganancia">Acredita mañana</span>'}
            </div>
          </div>
          <div class="reserva-item-bottom">
            <span class="reserva-item-fecha"><i class="far fa-calendar-alt"></i> Vence ${new Date(res.fecha_vencimiento).toLocaleDateString('es-AR')}</span>
            <i class="fas fa-chevron-right reserva-item-arrow"></i>
          </div>
        </li>`;
    }).join("");

    reservasList.querySelectorAll(".reserva-item").forEach(li => {
      const res = reservas.find(r => String(r.id) === li.dataset.id);
      if (res) li.addEventListener("click", () => abrirReservaDetail(res));
    });
  };

  const cargarReservas = async () => {
    try {
      const reservas = await apiFetch("/reservas");
      renderReservas(reservas);
    } catch {
      renderReservas([]);
    }
  };
  if (session) cargarReservas();

  // Botones de días
  document.querySelectorAll(".reserva-dia-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".reserva-dia-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const fecha = new Date();
      fecha.setDate(fecha.getDate() + Number(btn.dataset.dias));
      const fechaInput = document.getElementById("reservaFecha");
      if (fechaInput) fechaInput.value = fecha.toISOString().slice(0, 10);
    });
  });

  if (showReservaFormBtn) {
    showReservaFormBtn.addEventListener("click", () => {
      if (reservaForm) reservaForm.classList.remove("hidden");
      showReservaFormBtn.classList.add("hidden");
    });
  }

  if (cancelReservaBtn) {
    cancelReservaBtn.addEventListener("click", () => {
      if (reservaForm) reservaForm.classList.add("hidden");
      if (showReservaFormBtn) showReservaFormBtn.classList.remove("hidden");
    });
  }

  const reservaMontoInput = document.getElementById("reservaMonto");
  if (reservaMontoInput) {
    reservaMontoInput.addEventListener("input", () => {
      const digits = reservaMontoInput.value.replace(/\D/g, "");
      reservaMontoInput.value = digits ? Number(digits).toLocaleString("es-AR") : "";
    });
  }

  if (reservaForm) {
    reservaForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fechaVal = document.getElementById("reservaFecha").value;
      if (!fechaVal) { showToast('Elegí un plazo (30, 60 o 90 días)', 3000, 'error'); return; }
      const body = {
        nombre: document.getElementById("reservaNombre").value,
        fecha_vencimiento: fechaVal,
        monto: Number(reservaMontoInput.value.replace(/\./g, "").replace(/,/g, "."))
      };
      formLoad(reservaForm, true);
      try {
        await apiFetch("/reservas", { method: "POST", body: JSON.stringify(body) });
        showToast(`Reserva "${body.nombre}" creada`, 3000, 'success');
      } catch (err) {
        showToast(err.message || `Error al crear la reserva`, 3500, 'error');
      } finally {
        reservaForm.reset();
        document.querySelectorAll(".reserva-dia-btn").forEach(b => b.classList.remove("active"));
        reservaForm.classList.add("hidden");
        if (showReservaFormBtn) showReservaFormBtn.classList.remove("hidden");
        formLoad(reservaForm, false);
        cargarReservas();
      }
    });
  }

  // ========== GASTOS POR CATEGORÍA ==========
  const loadGastosBtn = document.getElementById("loadGastosBtn");
  let gastosChart = null;

  const cargarGastos = async () => {
    try {
      const data = await apiFetch("/auth/gastos-categoria");
      const categorias = (data.categorias || []).filter(c => c.monto > 0);
      const ctx = document.getElementById("gastosChart")?.getContext("2d");
      if (!ctx) return;
      if (gastosChart) gastosChart.destroy();
      gastosChart = new Chart(ctx, {
        type: "doughnut",
        data: {
          labels: categorias.map(c => c.nombre),
          datasets: [{
            data: categorias.map(c => c.monto),
            backgroundColor: ["#10B981","#3B82F6","#F59E0B","#EF4444","#8B5CF6","#EC4899"],
            borderWidth: 2,
            borderColor: "transparent"
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: "bottom", labels: { padding: 16, font: { size: 13 } } },
            tooltip: { callbacks: { label: ctx => `${ctx.label}: $${ctx.raw.toLocaleString()}` } }
          }
        }
      });
    } catch { /* sin datos, no mostrar error */ }
  };
  if (session) cargarGastos();

  if (loadGastosBtn) {
    loadGastosBtn.addEventListener("click", () => {
      btnLoad(loadGastosBtn, true);
      cargarGastos().finally(() => btnLoad(loadGastosBtn, false));
    });
  }

  // ========== LÓGICA DE NAVEGACIÓN DE OPERACIONES ==========
  
  const formsContainer = document.getElementById("operationFormsContainer");
  const transferArea = document.getElementById("transferArea");
  const depositArea = document.getElementById("depositArea");

  const toggleOperation = (type) => {
    if (!formsContainer) return;
    const isTransfer = type === 'transfer';
    const targetArea = isTransfer ? transferArea : depositArea;
    const otherArea  = isTransfer ? depositArea  : transferArea;
    if (!targetArea) return;

    if (targetArea.classList.contains("hidden")) {
      formsContainer.classList.remove("hidden");
      targetArea.classList.remove("hidden");
      otherArea?.classList.add("hidden");
      targetArea.scrollIntoView({ behavior: 'smooth' });
    } else {
      formsContainer.classList.add("hidden");
      targetArea.classList.add("hidden");
    }
  };

  const openTransferModal = () => {
    document.getElementById('transferModal')?.classList.remove('hidden');
    document.getElementById('transferStep1')?.classList.remove('hidden');
    document.getElementById('transferStep2')?.classList.add('hidden');
    const cbuInput = document.getElementById('cbuDestino');
    if (cbuInput) { cbuInput.value = ''; setTimeout(() => cbuInput.focus(), 100); }
    const ri = document.getElementById('receptorInfo');
    if (ri) ri.textContent = '';
    destinatarioValidado = null;
    cbuDestinoVerificado = '';
    renderContacts();
  };

  const closeTransferModal = () => {
    document.getElementById('transferModal')?.classList.add('hidden');
  };

  document.getElementById("btn-transfer-shortcut")?.addEventListener("click", openTransferModal);
  document.getElementById("closeTransferModal")?.addEventListener("click", closeTransferModal);
  document.getElementById("closeTransferModal2")?.addEventListener("click", closeTransferModal);

  // Cerrar al click en el backdrop
  document.getElementById("transferModal")?.addEventListener("click", (e) => {
    if (e.target === document.getElementById("transferModal")) closeTransferModal();
  });
  document.getElementById("btn-deposit-shortcut")?.addEventListener("click", () => toggleOperation('deposit'));
  // Tabs ARS / USD
  document.getElementById("tabARS")?.addEventListener("click", mostrarHeroARS);
  document.getElementById("tabUSD")?.addEventListener("click", mostrarHeroUSD);

  // Toggle actividad colapsable
  document.getElementById("actividadToggle")?.addEventListener("click", () => {
    const btn  = document.getElementById("actividadToggle");
    const body = document.getElementById("actividadBody");
    const expanded = btn.getAttribute("aria-expanded") === "true";
    btn.setAttribute("aria-expanded", !expanded);
    body.classList.toggle("hidden", expanded);
    if (!expanded && loadMovimientosBtn) loadMovimientosBtn.click();
  });

  // Ocultar/mostrar saldo USD
  document.getElementById("toggleBalanceUSD")?.addEventListener("click", () => {
    const el   = document.getElementById('usdDisplayBalance');
    const icon = document.getElementById('balanceIconUSD');
    const equiv = document.getElementById('usdEquivalente');
    if (!el) return;
    const oculto = el.textContent === '**********';
    if (oculto) {
      const saldo = Number(el.dataset.value || 0);
      el.textContent = saldo.toLocaleString('es-AR', { minimumFractionDigits: 2 });
      if (equiv) equiv.style.visibility = 'visible';
      if (icon)  icon.className = 'fas fa-eye';
    } else {
      el.dataset.value = el.dataset.value || el.textContent.replace(/\./g,'').replace(',','.');
      el.textContent = '**********';
      if (equiv) equiv.style.visibility = 'hidden';
      if (icon)  icon.className = 'fas fa-eye-slash';
    }
  });
  document.getElementById('usdAbrirConfirm')?.addEventListener('click', _confirmarAbrirUSD);
  document.getElementById('usdAbrirClose')?.addEventListener('click',   () => document.getElementById('usdAbrirModal')?.classList.add('hidden'));
  document.getElementById('usdAbrirCancel')?.addEventListener('click',  () => document.getElementById('usdAbrirModal')?.classList.add('hidden'));
  document.getElementById('usdAbrirModal')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('usdAbrirModal')) document.getElementById('usdAbrirModal').classList.add('hidden');
  });

  // ── Modal cambio alias USD ──
  const _usdAliasModal  = document.getElementById('usdAliasModal');
  const _usdAliasInput  = document.getElementById('usdAliasInput');
  const _usdAliasConfirm = document.getElementById('usdAliasConfirm');
  const _usdAliasError  = document.getElementById('usdAliasError');
  const _closeUsdAlias  = () => { _usdAliasModal?.classList.add('hidden'); if (_usdAliasInput) _usdAliasInput.value = ''; if (_usdAliasError) _usdAliasError.style.display = 'none'; if (_usdAliasConfirm) _usdAliasConfirm.disabled = true; };

  document.getElementById('btnEditAliasUSD')?.addEventListener('click', () => {
    _usdAliasModal?.classList.remove('hidden');
    setTimeout(() => _usdAliasInput?.focus(), 50);
  });
  document.getElementById('usdAliasClose')?.addEventListener('click', _closeUsdAlias);
  _usdAliasModal?.addEventListener('click', (e) => { if (e.target === _usdAliasModal) _closeUsdAlias(); });

  _usdAliasInput?.addEventListener('input', () => {
    const v = _usdAliasInput.value.trim();
    if (_usdAliasConfirm) _usdAliasConfirm.disabled = v.length < 3;
    if (_usdAliasError) _usdAliasError.style.display = 'none';
  });

  _usdAliasConfirm?.addEventListener('click', async () => {
    const alias = _usdAliasInput?.value.trim();
    if (!alias) return;
    btnLoad(_usdAliasConfirm, true);
    if (_usdAliasError) _usdAliasError.style.display = 'none';
    try {
      await apiFetch('/cuentas/alias-usd', { method: 'PUT', body: JSON.stringify({ alias }) });
      _closeUsdAlias();
      showToast('Alias USD actualizado', 3000, 'success');
      await loadSaldo();
    } catch (e) {
      if (_usdAliasError) { _usdAliasError.textContent = e.message || 'Error al cambiar alias'; _usdAliasError.style.display = ''; }
    } finally {
      btnLoad(_usdAliasConfirm, false);
    }
  });

  document.getElementById("usdConvertClose")?.addEventListener("click", () =>
    document.getElementById('usdConvertModal')?.classList.add('hidden'));
  document.getElementById("usdConvertModal")?.addEventListener("click", (e) => {
    if (e.target === document.getElementById("usdConvertModal"))
      document.getElementById("usdConvertModal").classList.add('hidden');
  });
  document.getElementById("usdTransferClose")?.addEventListener("click", () =>
    document.getElementById('usdTransferModal')?.classList.add('hidden'));
  document.getElementById("usdTransferModal")?.addEventListener("click", (e) => {
    if (e.target === document.getElementById("usdTransferModal"))
      document.getElementById("usdTransferModal").classList.add('hidden');
  });

  // Volver al paso 1 desde paso 2
  document.getElementById("backToStep1Btn")?.addEventListener("click", () => {
    destinatarioValidado = null;
    cbuDestinoVerificado = '';
    document.getElementById('transferStep1')?.classList.remove('hidden');
    document.getElementById('transferStep2')?.classList.add('hidden');
    renderContacts();
  });

  // Toggle Saldo
  const toggleBtn = document.getElementById("toggleBalance");
  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      saldoOculto = !saldoOculto;
      actualizarDisplaySaldo();
    });
  }

  // Asistente IA — Gemini
  const aiToggle  = document.getElementById("aiToggle");
  const aiWindow  = document.getElementById("aiChatWindow");
  const aiClose   = document.getElementById("aiClose");
  const aiSend    = document.getElementById("aiSend");
  const aiQuery   = document.getElementById("aiQuery");
  const aiMessages = document.getElementById("aiMessages");
  const chatHistory = [];

  if (aiToggle) aiToggle.addEventListener("click", () => aiWindow.classList.toggle("hidden"));
  if (aiClose)  aiClose.addEventListener("click",  () => aiWindow.classList.add("hidden"));

  const aiAppendMsg = (text, role) => {
    const div = document.createElement("div");
    div.className = `msg ${role}`;
    div.textContent = text;
    aiMessages.appendChild(div);
    aiMessages.scrollTop = aiMessages.scrollHeight;
  };

  const aiSetLoading = (on) => {
    if (!aiSend) return;
    aiSend.disabled = on;
    aiSend.innerHTML = on
      ? '<i class="fas fa-spinner fa-spin"></i>'
      : '<i class="fas fa-paper-plane"></i>';
  };

  const enviarMensaje = async () => {
    const text = aiQuery.value.trim();
    if (!text) return;
    aiQuery.value = "";
    aiAppendMsg(text, "user");
    chatHistory.push({ role: "user", text });
    aiSetLoading(true);
    try {
      const data = await apiFetch("/chat", {
        method: "POST",
        body: JSON.stringify({ message: text, history: chatHistory.slice(0, -1) })
      });
      aiAppendMsg(data.reply, "bot");
      chatHistory.push({ role: "model", text: data.reply });
    } catch (err) {
      aiAppendMsg("No pude conectarme con el asistente. Intentá de nuevo.", "bot");
    } finally {
      aiSetLoading(false);
    }
  };

  if (aiSend) aiSend.addEventListener("click", enviarMensaje);
  if (aiQuery) aiQuery.addEventListener("keydown", e => { if (e.key === "Enter") enviarMensaje(); });
  
  // ========== LÓGICA DE QR (PAGAR Y COBRAR) ==========

  // 1. GENERAR QR PARA COBRAR
  const btnQrCharge = document.getElementById("btn-qr-charge");
  const qrGeneratorModal = document.getElementById("qrGeneratorModal");
  const qrContainer = document.getElementById("qrcode-container");

  if (btnQrCharge) {
    btnQrCharge.addEventListener("click", () => {
      if (!cuentaActiva) return void showToast('Cargando datos de cuenta...', 3000, 'info');
      
      qrContainer.innerHTML = ""; // Limpiar anterior
      qrGeneratorModal.classList.remove("hidden");
      document.getElementById("qrAccountDetail").textContent = `${cuentaActiva.alias} | ${cuentaActiva.cbu}`;

      // Datos que irán dentro del QR
      const qrData = JSON.stringify({
        cbu: cuentaActiva.cbu,
        alias: cuentaActiva.alias,
        banco: "Nodo",
        v: "1.0"
      });

      new QRCode(qrContainer, {
        text: qrData,
        width: 256,
        height: 256,
        colorDark: "#0F172A",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H
      });
    });
  }

  // 2. LEER QR PARA PAGAR
  const btnQrPay = document.getElementById("btn-qr-pay");
  const qrScannerModal = document.getElementById("qrScannerModal");

  window.stopScanner = async () => {
    if (html5QrCode) {
      await html5QrCode.stop();
      qrScannerModal.classList.add("hidden");
    }
  };

  if (btnQrPay) {
    btnQrPay.addEventListener("click", async () => {
      if (html5QrCode) {
        try { await html5QrCode.stop(); } catch {}
        html5QrCode = null;
      }
      qrScannerModal.classList.remove("hidden");
      html5QrCode = new Html5Qrcode("reader");
      
      const config = { fps: 10, qrbox: { width: 250, height: 250 } };

      html5QrCode.start({ facingMode: "environment" }, config, (decodedText) => {
        try {
          const data = JSON.parse(decodedText);
          if (data.cbu || data.alias) {
            stopScanner();
            openTransferModal();
            const inputDestino = document.getElementById("cbuDestino");
            inputDestino.value = data.alias || data.cbu;
            inputDestino.dispatchEvent(new Event('input'));
            showToast(`QR detectado: ${data.alias || data.cbu}`, 3000, 'success');
          }
        } catch (e) {
          showToast('QR no reconocido como formato Nodo', 3500, 'error');
          stopScanner();
          openTransferModal();
          document.getElementById("cbuDestino").value = decodedText;
          document.getElementById("cbuDestino").dispatchEvent(new Event('input'));
        }
      });
    });
  }

  // Carga inicial de datos
  loadMercado();
  setInterval(loadMercado, 5 * 60 * 1000); // refresca cada 5 minutos

  if (session) {
    loadBanks();
    loadSaldo().finally(() => {
      const loader = document.getElementById('pageLoader');
      if (loader) {
        loader.classList.add('fade-out');
        setTimeout(() => { loader.style.display = 'none'; }, 380);
      }
    });
    if (loadMovimientosBtn) loadMovimientosBtn.click();

    // Polling automático cada 15 minutos (ventana 30 min para no perder transferencias)
    setInterval(async () => {
      try {
        const data = await apiFetch('/transferencias/sincronizar');
        if (data.transferenciasRecibidas > 0) {
          await loadSaldo();
          if (loadMovimientosBtn) loadMovimientosBtn.click();
          const n = data.transferenciasRecibidas;
          showToast(`${n} transferencia${n > 1 ? 's' : ''} recibida${n > 1 ? 's' : ''}`);
        }
      } catch {}
    }, 15 * 60 * 1000);
  }

  // Avatar de perfil — clave por usuario para que no se comparta entre cuentas
  const avatarInput = document.getElementById("avatarInput");
  const avatarImg = document.getElementById("avatarImg");
  const avatarIcon = document.getElementById("avatarIcon");

  const avatarKey = session?.user?.id ? `userAvatar_${session.user.id}` : null;
  const savedAvatar = avatarKey ? localStorage.getItem(avatarKey) : null;
  if (savedAvatar && avatarImg) {
    avatarImg.src = savedAvatar;
    avatarImg.classList.remove("hidden");
    if (avatarIcon) avatarIcon.classList.add("hidden");
  }

  if (avatarInput) {
    avatarInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target.result;
        if (avatarKey) localStorage.setItem(avatarKey, dataUrl);
        if (avatarImg) {
          avatarImg.src = dataUrl;
          avatarImg.classList.remove("hidden");
        }
        if (avatarIcon) avatarIcon.classList.add("hidden");
      };
      reader.readAsDataURL(file);
    });
  }

  // ─── PRÉSTAMOS ────────────────────────────────────────────
  const PRESTAMO_TNA  = 0.95;
  const PRESTAMO_IVA  = 0.21;
  const P_MONTO_MIN   = 10000;
  const P_MONTO_MAX   = 5000000;
  const P_INCOME_CAP  = 0.30; // cuota no debe superar 30% del ingreso estimado

  // ── Cálculo financiero ──
  function _pmt(monto, cuotas) {
    const r = PRESTAMO_TNA / 12;
    return monto * (r * Math.pow(1 + r, cuotas)) / (Math.pow(1 + r, cuotas) - 1);
  }
  function _calcPrestamo(monto, cuotas) {
    const cuota         = _pmt(monto, cuotas);
    const totalIntereses = cuota * cuotas - monto;
    const iva           = totalIntereses * PRESTAMO_IVA;
    const totalPagar    = monto + totalIntereses + iva;
    const tea           = Math.pow(1 + PRESTAMO_TNA / 12, 12) - 1;
    const cft           = Math.pow(totalPagar / monto, 12 / cuotas) - 1;
    return { cuota, totalIntereses, iva, totalPagar, tea, cft };
  }
  function _tablaAmortizacion(monto, cuotas) {
    const r = PRESTAMO_TNA / 12;
    const cuota = _pmt(monto, cuotas);
    let saldo = monto;
    const rows = [];
    for (let i = 1; i <= cuotas; i++) {
      const interes = saldo * r;
      const capital = cuota - interes;
      saldo = Math.max(0, saldo - capital);
      rows.push({ n: i, capital, interes, cuota, saldo });
    }
    return rows;
  }
  function _fmtARS(n) { return '$' + Math.round(n).toLocaleString('es-AR'); }
  function _fmtPct(n) { return (n * 100).toFixed(2).replace('.', ',') + ' %'; }

  // ── Estado del simulador ──
  let _prestamoMonto  = 100000;
  let _prestamoCuotas = 6;
  let _limitePreaprobado = P_MONTO_MAX; // se actualiza con el saldo

  // ── DOM refs ──
  const prestamoSlider      = document.getElementById('prestamoSlider');
  const prestamoMontoInput  = document.getElementById('prestamoMontoInput');
  const prestamoCuotaHero   = document.getElementById('prestamoCuotaHero');
  const pTEA                = document.getElementById('pTEA');
  const pIntereses          = document.getElementById('pIntereses');
  const pIVA                = document.getElementById('pIVA');
  const pTotal              = document.getElementById('pTotal');
  const pCFT                = document.getElementById('pCFT');
  const prestamoTablaTbody  = document.getElementById('prestamoTablaTbody');
  const prestamoTablaBtn    = document.getElementById('prestamoTablaBtn');
  const prestamoTablaWrap   = document.getElementById('prestamoTablaWrap');
  const prestamoSolicitarBtn = document.getElementById('prestamoSolicitarBtn');
  const prestamoPills       = document.getElementById('prestamoPills');
  const prestamoModal       = document.getElementById('prestamoModal');
  const prestamoModalClose  = document.getElementById('prestamoModalClose');
  const prestamoModalCancelar = document.getElementById('prestamoModalCancelar');
  const prestamoModalConfirmar = document.getElementById('prestamoModalConfirmar');
  const prestamoModalDetalles  = document.getElementById('prestamoModalDetalles');
  const prestamoTyC         = document.getElementById('prestamoTyC');
  const pWarnLimite         = document.getElementById('pWarnLimite');
  const pWarnIngresos       = document.getElementById('pWarnIngresos');
  const pLimiteInfo         = document.getElementById('pLimiteInfo');
  const pLimiteMax          = document.getElementById('pLimiteMax');
  const prestamoInputWrap   = document.getElementById('prestamoInputWrap');
  const pMontoError         = document.getElementById('pMontoError');
  const pMontoErrorTxt      = document.getElementById('pMontoErrorTxt');
  const pTNA                = document.getElementById('pTNA');
  const moraBanner          = document.getElementById('moraBanner');
  const moraBannerMsg       = document.getElementById('moraBannerMsg');
  const ptabBadge           = document.getElementById('ptabBadge');
  const misPrestamosContent = document.getElementById('misPrestamosContent');

  // ── Slider track fill ──
  function _fillSlider(slider) {
    const pct = (slider.value - slider.min) / (slider.max - slider.min) * 100;
    slider.style.background = `linear-gradient(to right, var(--green) ${pct}%, var(--border) ${pct}%)`;
  }

  // ── Validaciones de negocio ──
  function _validarPrestamo(monto, cuota, saldoARS) {
    const ingresoEst     = Math.max(saldoARS * 2, 50000);
    const superaLimite   = monto > _limitePreaprobado;
    const superaIngresos = cuota > ingresoEst * P_INCOME_CAP;

    // Error inline bajo el input (columna izquierda)
    if (prestamoInputWrap) prestamoInputWrap.classList.toggle('input-error', superaLimite);
    if (pMontoError) {
      pMontoError.classList.toggle('hidden', !superaLimite);
      if (superaLimite && pMontoErrorTxt) pMontoErrorTxt.textContent = `El monto supera tu límite pre-aprobado (${_fmtARS(_limitePreaprobado)})`;
    }

    // Aviso en la columna derecha
    if (pWarnLimite) {
      pWarnLimite.classList.toggle('hidden', !superaLimite);
      if (superaLimite) pWarnLimite.innerHTML = `<i class="fas fa-ban"></i> Monto superior a tu límite pre-aprobado (${_fmtARS(_limitePreaprobado)})`;
    }
    if (pWarnIngresos) {
      pWarnIngresos.classList.toggle('hidden', !(!superaLimite && superaIngresos));
      if (!superaLimite && superaIngresos) {
        const plazosSugeridos = [12, 24, 36].filter(p => p > _prestamoCuotas);
        const sug = plazosSugeridos.length ? ` Considerá extender el plazo a ${plazosSugeridos[0]} cuotas.` : '';
        pWarnIngresos.innerHTML = `<i class="fas fa-info-circle"></i> La cuota supera el 30 % del ingreso estimado.${sug}`;
      }
    }
    if (prestamoSolicitarBtn) prestamoSolicitarBtn.disabled = superaLimite;
    return !superaLimite;
  }

  // ── Actualizar simulador ──
  function _actualizarSimulador() {
    if (!prestamoSlider) return;

    if (_prestamoMonto <= 0) {
      if (prestamoCuotaHero) prestamoCuotaHero.textContent = '—';
      if (pTEA)       pTEA.textContent       = '—';
      if (pIntereses) pIntereses.textContent = '—';
      if (pIVA)       pIVA.textContent       = '—';
      if (pTotal)     pTotal.textContent     = '—';
      if (pCFT)       pCFT.textContent       = '—';
      if (pWarnLimite)    pWarnLimite.classList.add('hidden');
      if (pWarnIngresos)  pWarnIngresos.classList.add('hidden');
      if (pMontoError)    pMontoError.classList.add('hidden');
      if (prestamoInputWrap) prestamoInputWrap.classList.remove('input-error');
      if (prestamoSolicitarBtn) prestamoSolicitarBtn.disabled = true;
      if (prestamoTablaBtn) prestamoTablaBtn.disabled = true;
      if (pTNA) pTNA.classList.add('muted');
      return;
    }

    if (prestamoTablaBtn) prestamoTablaBtn.disabled = false;
    if (pTNA) pTNA.classList.remove('muted');

    const { cuota, totalIntereses, iva, totalPagar, tea, cft } = _calcPrestamo(_prestamoMonto, _prestamoCuotas);
    if (prestamoCuotaHero) prestamoCuotaHero.textContent = _fmtARS(cuota);
    if (pTEA)       pTEA.textContent       = _fmtPct(tea);
    if (pIntereses) pIntereses.textContent = _fmtARS(totalIntereses);
    if (pIVA)       pIVA.textContent       = _fmtARS(iva);
    if (pTotal)     pTotal.textContent     = _fmtARS(totalPagar);
    if (pCFT)       pCFT.textContent       = _fmtPct(cft);
    if (prestamoTablaWrap && !prestamoTablaWrap.classList.contains('hidden')) _renderTabla();

    _validarPrestamo(_prestamoMonto, cuota, saldoActual || 0);
  }

  function _renderTabla() {
    if (!prestamoTablaTbody) return;
    prestamoTablaTbody.innerHTML = _tablaAmortizacion(_prestamoMonto, _prestamoCuotas).map(r => `
      <tr>
        <td>${r.n}</td>
        <td>${_fmtARS(r.capital)}</td>
        <td>${_fmtARS(r.interes)}</td>
        <td>${_fmtARS(r.cuota)}</td>
        <td>${_fmtARS(r.saldo)}</td>
      </tr>`).join('');
  }

  // ── Límite pre-aprobado (basado en saldo ARS) ──
  function _actualizarLimite(saldoARS) {
    _limitePreaprobado = Math.min(P_MONTO_MAX, Math.max(100000, saldoARS * 5));
    if (prestamoSlider) prestamoSlider.max = _limitePreaprobado;
    if (pLimiteMax) pLimiteMax.textContent = _fmtARS(_limitePreaprobado);
    if (pLimiteInfo) pLimiteInfo.textContent = `Límite: ${_fmtARS(_limitePreaprobado)}`;
    _actualizarSimulador();
  }

  // ── Helpers de formato ──
  const _parseMonto = (str) => parseInt(str.replace(/\D/g, ''), 10) || 0;
  const _fmtInput   = (n)   => n > 0 ? n.toLocaleString('es-AR') : '';

  // Formatea el input en-vivo preservando la posición del cursor
  const _formatearInput = (input, valorRaw) => {
    const cursorAntes = input.selectionStart;
    const oldVal      = input.value;
    // Cuántos dígitos hay antes del cursor en el valor antiguo
    const digitosAntes = (oldVal.slice(0, cursorAntes).match(/\d/g) || []).length;

    const formatted = _fmtInput(valorRaw);
    input.value = formatted;

    // Reposicionar cursor: avanzar hasta haber visto los mismos dígitos
    let visto = 0, newPos = formatted.length;
    for (let i = 0; i < formatted.length; i++) {
      if (/\d/.test(formatted[i])) visto++;
      if (visto === digitosAntes) { newPos = i + 1; break; }
    }
    input.setSelectionRange(newPos, newPos);
  };

  // ── Slider → input ──
  if (prestamoSlider) {
    prestamoSlider.addEventListener('input', () => {
      _prestamoMonto = Number(prestamoSlider.value);
      if (prestamoMontoInput) prestamoMontoInput.value = _fmtInput(_prestamoMonto);
      _fillSlider(prestamoSlider);
      _actualizarSimulador();
    });
    _fillSlider(prestamoSlider);
  }

  // ── Input → slider (bidireccional con formateo en tiempo real) ──
  if (prestamoMontoInput) {
    // Bloquear teclas no numéricas antes de que lleguen al input
    prestamoMontoInput.addEventListener('keydown', (e) => {
      const pass = ['Backspace','Delete','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','Tab','Enter'];
      if (pass.includes(e.key)) return;
      if ((e.ctrlKey || e.metaKey) && 'acvxz'.includes(e.key.toLowerCase())) return;
      if (!/^\d$/.test(e.key)) e.preventDefault();
    });

    prestamoMontoInput.addEventListener('input', () => {
      const raw = _parseMonto(prestamoMontoInput.value);
      _formatearInput(prestamoMontoInput, raw);
      // Sin clampar al límite mientras se escribe — permite mostrar el error rojo
      _prestamoMonto = raw > 0 ? raw : 0;
      if (prestamoSlider) {
        prestamoSlider.value = Math.min(_prestamoMonto > 0 ? _prestamoMonto : P_MONTO_MIN, _limitePreaprobado);
        _fillSlider(prestamoSlider);
      }
      _actualizarSimulador();
    });

    // Al salir: clamp al límite y limpiar error de borde
    prestamoMontoInput.addEventListener('blur', () => {
      if (_prestamoMonto > _limitePreaprobado) _prestamoMonto = _limitePreaprobado;
      else if (_prestamoMonto > 0) _prestamoMonto = Math.max(P_MONTO_MIN, _prestamoMonto);
      prestamoMontoInput.value = _fmtInput(_prestamoMonto);
      if (prestamoInputWrap) prestamoInputWrap.classList.remove('input-error');
      if (pMontoError) pMontoError.classList.add('hidden');
      if (prestamoSlider) { prestamoSlider.value = _prestamoMonto > 0 ? _prestamoMonto : P_MONTO_MIN; _fillSlider(prestamoSlider); }
      _actualizarSimulador();
    });

    prestamoMontoInput.addEventListener('focus', () => prestamoMontoInput.select());

    // Estado inicial
    prestamoMontoInput.value = _fmtInput(_prestamoMonto);
  }

  // ── Pills ──
  if (prestamoPills) {
    prestamoPills.addEventListener('click', (e) => {
      const btn = e.target.closest('.prestamo-pill');
      if (!btn) return;
      prestamoPills.querySelectorAll('.prestamo-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      _prestamoCuotas = Number(btn.dataset.cuotas);
      _actualizarSimulador();
    });
  }

  // ── Tabla accordion ──
  if (prestamoTablaBtn) {
    prestamoTablaBtn.addEventListener('click', () => {
      const open = prestamoTablaBtn.getAttribute('aria-expanded') === 'true';
      prestamoTablaBtn.setAttribute('aria-expanded', String(!open));
      prestamoTablaWrap.classList.toggle('hidden', open);
      if (!open) _renderTabla();
    });
  }

  // ── Tabs del card ──
  document.querySelectorAll('.ptab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.ptab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.ptab-panel').forEach(p => p.classList.add('hidden'));
      tab.classList.add('active');
      const panel = document.getElementById(tab.dataset.panel);
      if (panel) panel.classList.remove('hidden');
    });
  });

  // ── Botón solicitar → abrir modal ──
  if (prestamoSolicitarBtn) {
    prestamoSolicitarBtn.addEventListener('click', () => {
      const { cuota, totalIntereses, iva, totalPagar, tea, cft } = _calcPrestamo(_prestamoMonto, _prestamoCuotas);
      if (prestamoModalDetalles) {
        prestamoModalDetalles.innerHTML = `
          <div class="prestamo-confirm-row highlight"><span>Monto a recibir</span><span>${_fmtARS(_prestamoMonto)}</span></div>
          <div class="prestamo-confirm-row"><span>Plazo</span><span>${_prestamoCuotas} cuotas</span></div>
          <div class="prestamo-confirm-row"><span>Cuota mensual</span><span>${_fmtARS(cuota)}</span></div>
          <div class="prestamo-confirm-row"><span>TNA</span><span>${_fmtPct(PRESTAMO_TNA)}</span></div>
          <div class="prestamo-confirm-row"><span>TEA</span><span>${_fmtPct(tea)}</span></div>
          <div class="prestamo-confirm-row"><span>Total intereses</span><span>${_fmtARS(totalIntereses)}</span></div>
          <div class="prestamo-confirm-row"><span>IVA s/ intereses</span><span>${_fmtARS(iva)}</span></div>
          <div class="prestamo-confirm-row"><span>CFT estimado</span><span>${_fmtPct(cft)}</span></div>
          <div class="prestamo-confirm-row highlight"><span>Total a pagar</span><span>${_fmtARS(totalPagar)}</span></div>`;
      }
      if (prestamoTyC) prestamoTyC.checked = false;
      if (prestamoModalConfirmar) prestamoModalConfirmar.disabled = true;
      prestamoModal.classList.remove('hidden');
    });
  }

  // T&C habilita el botón confirmar
  if (prestamoTyC) {
    prestamoTyC.addEventListener('change', () => {
      if (prestamoModalConfirmar) prestamoModalConfirmar.disabled = !prestamoTyC.checked;
    });
  }

  const _cerrarPrestamoModal = () => prestamoModal && prestamoModal.classList.add('hidden');
  if (prestamoModalClose)   prestamoModalClose.addEventListener('click', _cerrarPrestamoModal);
  if (prestamoModalCancelar) prestamoModalCancelar.addEventListener('click', _cerrarPrestamoModal);
  if (prestamoModal) prestamoModal.addEventListener('click', e => { if (e.target === prestamoModal) _cerrarPrestamoModal(); });

  if (prestamoModalConfirmar) {
    prestamoModalConfirmar.addEventListener('click', async () => {
      prestamoModalConfirmar.disabled = true;
      prestamoModalConfirmar.textContent = 'Procesando…';
      try {
        const data = await apiFetch('/prestamos/solicitar', {
          method: 'POST',
          body: JSON.stringify({ monto: _prestamoMonto, cuotas: _prestamoCuotas }),
        });
        _cerrarPrestamoModal();
        await loadSaldo();
        showToast(`${_fmtARS(_prestamoMonto)} acreditados en tu cuenta.`, 3500, 'success');
        _cargarPrestamos(); // refresh panel Mis Préstamos
        // Cambiar a tab Mis Préstamos automáticamente
        document.getElementById('ptabMisPresta')?.click();
      } catch (err) {
        showToast(err.message || 'Error al solicitar el préstamo', 4500, 'error');
        prestamoModalConfirmar.disabled = false;
      } finally {
        prestamoModalConfirmar.textContent = 'Confirmar y acreditar';
      }
    });
  }

  // ── Bloquear operaciones por mora ──
  const BTNS_BLOQUEADOS_POR_MORA = ['btn-transfer-shortcut', 'btnComprarUSD', 'btnVenderUSD', 'btnTransferirUSD'];
  function _aplicarBloqueoPorMora(enMora, p) {
    if (!moraBanner) return;
    moraBanner.classList.toggle('hidden', !enMora);
    if (enMora && moraBannerMsg && p) {
      const venc = new Date(p.fecha_proximo_vencimiento).toLocaleDateString('es-AR');
      moraBannerMsg.textContent = `Tenés una cuota vencida desde el ${venc}. Regularizá tu deuda para operar normalmente.`;
    }
    BTNS_BLOQUEADOS_POR_MORA.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      if (enMora) {
        el.setAttribute('data-mora-disabled', '1');
        el.disabled = true;
        el.title = 'Operación bloqueada por cuota vencida';
        el.style.opacity = '0.45';
      } else if (el.getAttribute('data-mora-disabled')) {
        el.removeAttribute('data-mora-disabled');
        el.disabled = false;
        el.title = '';
        el.style.opacity = '';
      }
    });
  }

  // ── Renderizar panel Mis Préstamos ──
  function _renderMisPrestamos(lista) {
    if (!misPrestamosContent) return;
    const activos   = lista.filter(p => p.estado === 'activo');
    const saldados  = lista.filter(p => p.estado === 'saldado');
    const cancelados = lista.filter(p => p.estado === 'cancelado');

    if (!lista.length) {
      misPrestamosContent.innerHTML = `
        <div class="mis-prestamos-empty">
          <i class="fas fa-file-invoice-dollar"></i>
          No tenés préstamos registrados. Usá el simulador para solicitarlo.
        </div>`;
      return;
    }

    misPrestamosContent.innerHTML = '';

    activos.forEach(p => {
      const enMora    = p.en_mora;
      const progPct   = p.cuotas > 0 ? (p.cuotas_pagadas / p.cuotas * 100).toFixed(1) : 0;
      const vencDate  = p.fecha_proximo_vencimiento ? new Date(p.fecha_proximo_vencimiento) : null;
      const hoy       = new Date(); hoy.setHours(0,0,0,0);
      const diasVenc  = vencDate ? Math.round((vencDate - hoy) / 86400000) : null;
      let clsVenc = '', textoVenc = '—';
      if (vencDate) {
        textoVenc = vencDate.toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' });
        if (diasVenc < 0)     clsVenc = 'vencida';
        else if (diasVenc <= 7) clsVenc = 'urgente';
      }

      const wrapper = document.createElement('div');
      wrapper.className = 'prestamo-card-activo';
      wrapper.dataset.id = p.id;
      wrapper.innerHTML = `
        <div class="prestamo-card-header">
          <div>
            <span class="prestamo-card-titulo">Préstamo NODO</span>
            <span class="prestamo-card-monto">${_fmtARS(p.monto)}</span>
          </div>
          <span class="prestamo-card-estado ${enMora ? 'mora' : 'activo'}">${enMora ? '⚠ En mora' : 'Activo'}</span>
        </div>
        <div class="prestamo-card-body">
          <div class="prestamo-progress-label">
            <span>Cuotas pagadas</span>
            <strong>${p.cuotas_pagadas} de ${p.cuotas}</strong>
          </div>
          <div class="prestamo-progress-track">
            <div class="prestamo-progress-fill" style="width:${progPct}%"></div>
          </div>
          ${vencDate ? `
          <div class="prestamo-venc-row">
            <span class="prestamo-venc-label">${diasVenc < 0 ? 'Cuota vencida el' : 'Próxima cuota el'}</span>
            <span class="prestamo-venc-fecha ${clsVenc}"><i class="far fa-calendar-alt"></i> ${textoVenc}</span>
          </div>` : ''}
          <div class="prestamo-resumen" style="margin-top:0;padding:14px 16px;">
            <div class="prestamo-rows" style="margin-bottom:0;">
              <div class="prestamo-row"><span>Cuota mensual</span><span>${_fmtARS(p.cuota_mensual)}</span></div>
              <div class="prestamo-row"><span>TNA</span><span>${(Number(p.tna)*100).toFixed(0)} %</span></div>
              <div class="prestamo-row"><span>Saldo de cuotas</span><span>${p.cuotas - p.cuotas_pagadas} restantes</span></div>
            </div>
          </div>
          <div class="prestamo-acciones" style="margin-top:14px;">
            <button class="btn-primary pagar-cuota-btn" data-id="${p.id}">
              <i class="fas fa-credit-card"></i> Pagar cuota ${_fmtARS(p.cuota_mensual)}
            </button>
            <button class="btn-danger cancelar-prestamo-btn" data-id="${p.id}">
              <i class="fas fa-times"></i> Cancelar
            </button>
          </div>
          <button class="prestamo-accordion-btn tabla-btn" data-id="${p.id}" aria-expanded="false" style="margin-top:10px;">
            <i class="fas fa-table"></i>
            <span>Tabla de amortización</span>
            <i class="fas fa-chevron-down prestamo-acc-icon"></i>
          </button>
          <div class="prestamo-tabla-wrap hidden tabla-wrap" data-id="${p.id}">
            <div class="prestamo-tabla-scroll">
              <table class="prestamo-tabla">
                <thead><tr><th>#</th><th>Capital</th><th>Interés</th><th>Cuota</th><th>Saldo</th></tr></thead>
                <tbody class="tabla-tbody" data-id="${p.id}"></tbody>
              </table>
            </div>
          </div>
        </div>`;
      misPrestamosContent.appendChild(wrapper);
    });

    // Préstamos históricos (saldados/cancelados)
    if (saldados.length || cancelados.length) {
      const hist = document.createElement('div');
      hist.style.cssText = 'margin-top:20px;';
      hist.innerHTML = `<p class="prestamo-label" style="margin-bottom:10px;">Histórico</p>` +
        [...saldados, ...cancelados].map(p => `
          <div class="prestamo-card-activo" style="margin-bottom:8px;opacity:.7;">
            <div class="prestamo-card-header">
              <div>
                <span class="prestamo-card-titulo">Préstamo NODO</span>
                <span class="prestamo-card-monto" style="font-size:1.1rem;">${_fmtARS(p.monto)}</span>
              </div>
              <span class="prestamo-card-estado ${p.estado}">${p.estado === 'saldado' ? '✓ Saldado' : 'Cancelado'}</span>
            </div>
          </div>`).join('');
      misPrestamosContent.appendChild(hist);
    }

    // ── Event handlers ──
    misPrestamosContent.querySelectorAll('.pagar-cuota-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        btn.disabled = true; btn.textContent = 'Procesando…';
        try {
          const r = await apiFetch(`/prestamos/${id}/pagar-cuota`, { method: 'POST' });
          showToast(r.message, 3500, 'success');
          await loadSaldo();
          _cargarPrestamos();
        } catch (err) {
          showToast(err.message || 'Error al pagar la cuota', 4000, 'error');
          btn.disabled = false;
          btn.innerHTML = `<i class="fas fa-credit-card"></i> Pagar cuota`;
        }
      });
    });

    misPrestamosContent.querySelectorAll('.cancelar-prestamo-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('¿Cancelar el préstamo? Esta acción no se puede deshacer.')) return;
        btn.disabled = true; btn.textContent = 'Cancelando…';
        try {
          await apiFetch(`/prestamos/${btn.dataset.id}/cancelar`, { method: 'PUT' });
          showToast('Préstamo cancelado.', 3000, 'success');
          _cargarPrestamos();
        } catch (err) {
          showToast(err.message || 'Error al cancelar', 4000, 'error');
          btn.disabled = false; btn.innerHTML = '<i class="fas fa-times"></i> Cancelar';
        }
      });
    });

    misPrestamosContent.querySelectorAll('.tabla-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const wrap = misPrestamosContent.querySelector(`.tabla-wrap[data-id="${id}"]`);
        const tbody = misPrestamosContent.querySelector(`.tabla-tbody[data-id="${id}"]`);
        const open = btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', String(!open));
        wrap.classList.toggle('hidden', open);
        if (!open && tbody) {
          const p = lista.find(x => String(x.id) === id);
          if (p) tbody.innerHTML = _tablaAmortizacion(Number(p.monto), p.cuotas).map(r => `
            <tr>
              <td>${r.n}</td>
              <td>${_fmtARS(r.capital)}</td>
              <td>${_fmtARS(r.interes)}</td>
              <td>${_fmtARS(r.cuota)}</td>
              <td>${_fmtARS(r.saldo)}</td>
            </tr>`).join('');
        }
      });
    });
  }

  // ── Cargar préstamos ──
  async function _cargarPrestamos() {
    try {
      const lista = await apiFetch('/prestamos');
      const enMora = lista.find(p => p.en_mora);
      _aplicarBloqueoPorMora(!!enMora, enMora);

      const activos = lista.filter(p => p.estado === 'activo');
      if (ptabBadge) {
        ptabBadge.textContent = activos.length || '';
        ptabBadge.classList.toggle('hidden', !activos.length);
      }
      _renderMisPrestamos(lista);

      _actualizarLimite(saldoActual || 0);
    } catch {}
  }

  // Inicializar
  _actualizarSimulador();
  if (session) _cargarPrestamos();
  // ─── FIN PRÉSTAMOS ────────────────────────────────────────

  // ══════════════ NAVEGACIÓN SIDEBAR ══════════════
  const _navItems    = document.querySelectorAll('.sidebar-nav-item');
  const _navSections = document.querySelectorAll('.content-section');

  _navItems.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = 'section-' + btn.dataset.section;

      _navItems.forEach(b => { b.classList.remove('active'); b.setAttribute('aria-selected', 'false'); });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');

      _navSections.forEach(s => s.classList.remove('active'));
      document.getElementById(targetId)?.classList.add('active');

      // Scroll al inicio del content-area en móvil
      document.querySelector('.content-area')?.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });

  // Si el moraBanner tiene enlace a préstamos, cambiar a esa sección al hacer click
  document.querySelector('.mora-banner-cta')?.addEventListener('click', (e) => {
    e.preventDefault();
    document.querySelector('[data-section="prestamos"]')?.click();
  });
});

