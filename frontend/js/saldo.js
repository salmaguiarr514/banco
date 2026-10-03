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
      // Notificar al m�dulo de pr�stamos para que recalcule el l�mite con el saldo real
      if (typeof _actualizarLimitePrestamos === "function") _actualizarLimitePrestamos(saldoActual);

      const cbuVal   = getCuentaCbu(cuentaActiva);
      const aliasVal = cuentaActiva.alias || '';

      const displayCbuEl   = document.getElementById('displayCbu');
      const displayAliasEl = document.getElementById('displayAlias');
      if (displayCbuEl)   { displayCbuEl.textContent   = cbuVal   || '—'; displayCbuEl.dataset.value   = cbuVal;   }
      if (displayAliasEl) { displayAliasEl.textContent = aliasVal || '—'; displayAliasEl.dataset.value = aliasVal; }

      // Refrescar alias en el dropdown de perfil
      const aliasValEl = document.getElementById('udropAliasVal');
      if (aliasValEl) aliasValEl.textContent = aliasVal || '—';

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
    // botones compra/venta — onclick evita listeners duplicados al llamar loadSaldo() varias veces
    const btnComprar     = document.getElementById('btnComprarUSD');
    const btnVender      = document.getElementById('btnVenderUSD');
    const btnTransferUSD = document.getElementById('btnTransferirUSD');
    if (btnComprar)     btnComprar.onclick     = () => abrirConvertModal('ARS','USD');
    if (btnVender)      btnVender.onclick      = () => abrirConvertModal('USD','ARS');
    if (btnTransferUSD) btnTransferUSD.onclick = abrirTransferirUSD;
  } else {
    sinEl.classList.remove('hidden');
    conEl.classList.add('hidden');
    const btnAbrir = document.getElementById('btnAbrirUSD');
    if (btnAbrir) btnAbrir.onclick = handleAbrirUSD;
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

