// â”€â”€ Mercado (cotizaciones integradas en la tarjeta USD) â”€â”€
const fmt = (n) => n != null ? `$${Number(n).toLocaleString('es-AR')}` : 'â€”';

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

// â”€â”€ Toggle hero ARS/USD â”€â”€
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

// â”€â”€ Modal compra/venta USD â”€â”€
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
      showToast(e.message || 'Error en la conversiÃ³n', 4000, 'error');
    } finally {
      btnLoad(confirm, false);
    }
  };
};

// â”€â”€ Modal transferir USD (2 pasos) â”€â”€
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

  // â”€â”€ Paso 1: buscar destinatario â”€â”€
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
        // CBU â†’ BC primero, fallback local; alias â†’ BC primero, fallback local
        const esCBU = /^\d{22}$/.test(valor);
        let data;
        if (esCBU) {
          try {
            data = await apiFetch(`/transferencias/buscar/${encodeURIComponent(valor)}`);
          } catch (_) {
            // BC no encontrÃ³ por CBU (cuentas USD no estÃ¡n en /persons) â€” buscar en DB local
            const local = await apiFetch(`/cuentas/buscar-usd/${encodeURIComponent(valor)}`);
            if (local.found) {
              data = local;
            } else {
              // CBU externo vÃ¡lido â€” BC acepta la transacciÃ³n aunque no devuelva el nombre
              data = { cbu: valor, nombre: 'Cuenta', apellido: 'externa', alias: valor };
            }
          }
        } else {
          try {
            data = await apiFetch(`/transferencias/alias/${encodeURIComponent(valor)}`);
          } catch (_) {
            // BC no lo encontrÃ³ â€” buscar alias en DB local (cuentas USD de este banco)
            const local = await apiFetch(`/cuentas/buscar-usd/${encodeURIComponent(valor)}`);
            if (!local.found) throw new Error('No se encontrÃ³ una cuenta USD con ese alias o CBU');
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
            ? 'No se encontrÃ³ una cuenta con ese alias o CBU'
            : (e.message || 'No encontrado');
          searchErr.style.display = '';
        }
      }
    }, 500);
  };

  if (nextBtn) nextBtn.onclick = () => { if (_destinatarioUSD) goStep2(_destinatarioUSD); };

  // â”€â”€ Paso 2: monto â”€â”€
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
