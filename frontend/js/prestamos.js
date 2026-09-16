document.addEventListener("DOMContentLoaded", async () => {
  const { data: { session } } = await _supabase.auth.getSession();

  const PRESTAMO_TNA = 0.95;
  const PRESTAMO_IVA = 0.21;
  const P_MONTO_MIN  = 10000;
  const P_MONTO_MAX  = 5000000;
  const P_INCOME_CAP = 0.30;

  function _pmt(monto, cuotas) {
    const r = PRESTAMO_TNA / 12;
    return monto * (r * Math.pow(1 + r, cuotas)) / (Math.pow(1 + r, cuotas) - 1);
  }
  function _irr(cfs) {
    let x = 0.08;
    for (let iter = 0; iter < 200; iter++) {
      let npv = 0, dnpv = 0;
      for (let k = 0; k < cfs.length; k++) {
        const d = Math.pow(1 + x, k);
        npv  += cfs[k] / d;
        dnpv -= k * cfs[k] / (d * (1 + x));
      }
      if (Math.abs(dnpv) < 1e-14) break;
      const dx = npv / dnpv;
      x -= dx;
      if (Math.abs(dx) < 1e-12) break;
    }
    return x;
  }
  function _calcPrestamo(monto, cuotas) {
    const r    = PRESTAMO_TNA / 12;
    const cuota = _pmt(monto, cuotas);
    const cfs  = [-monto];
    let saldo  = monto;
    let totalIntereses = 0, totalIVA = 0;
    for (let i = 1; i <= cuotas; i++) {
      const interes = saldo * r;
      const capital = cuota - interes;
      const iva_k   = interes * PRESTAMO_IVA;
      cfs.push(cuota + iva_k);
      totalIntereses += interes;
      totalIVA       += iva_k;
      saldo = Math.max(0, saldo - capital);
    }
    const totalPagar = monto + totalIntereses + totalIVA;
    const tea = Math.pow(1 + r, 12) - 1;
    const cft = Math.pow(1 + _irr(cfs), 12) - 1;
    return { cuota, totalIntereses, iva: totalIVA, totalPagar, tea, cft };
  }
  function _tablaAmortizacion(monto, cuotas) {
    const r = PRESTAMO_TNA / 12;
    const cuota = _pmt(monto, cuotas);
    let saldo = monto;
    const rows = [];
    for (let i = 1; i <= cuotas; i++) {
      const interes    = saldo * r;
      const capital    = cuota - interes;
      const iva        = interes * PRESTAMO_IVA;
      const cuotaConIVA = cuota + iva;
      saldo = Math.max(0, saldo - capital);
      rows.push({ n: i, capital, interes, iva, cuotaConIVA, saldo });
    }
    return rows;
  }
  function _fmtARS(n) { return "$" + Math.round(n).toLocaleString("es-AR"); }
  function _fmtPct(n) { return (n * 100).toFixed(2).replace(".", ",") + " %"; }

  let _prestamoMonto  = 100000;
  let _prestamoCuotas = 6;
  let _limitePreaprobado = P_MONTO_MAX;

  const prestamoSlider       = document.getElementById("prestamoSlider");
  const prestamoMontoInput   = document.getElementById("prestamoMontoInput");
  const prestamoCuotaHero    = document.getElementById("prestamoCuotaHero");
  const pTEA                 = document.getElementById("pTEA");
  const pIntereses           = document.getElementById("pIntereses");
  const pIVA                 = document.getElementById("pIVA");
  const pTotal               = document.getElementById("pTotal");
  const pCFT                 = document.getElementById("pCFT");
  const prestamoTablaTbody   = document.getElementById("prestamoTablaTbody");
  const prestamoTablaBtn     = document.getElementById("prestamoTablaBtn");
  const prestamoTablaWrap    = document.getElementById("prestamoTablaWrap");
  const prestamoSolicitarBtn = document.getElementById("prestamoSolicitarBtn");
  const prestamoPills        = document.getElementById("prestamoPills");
  const prestamoModal        = document.getElementById("prestamoModal");
  const prestamoModalClose   = document.getElementById("prestamoModalClose");
  const prestamoModalCancelar   = document.getElementById("prestamoModalCancelar");
  const prestamoModalConfirmar  = document.getElementById("prestamoModalConfirmar");
  const prestamoModalDetalles   = document.getElementById("prestamoModalDetalles");
  const prestamoTyC          = document.getElementById("prestamoTyC");
  const pWarnLimite          = document.getElementById("pWarnLimite");
  const pWarnIngresos        = document.getElementById("pWarnIngresos");
  const pLimiteInfo          = document.getElementById("pLimiteInfo");
  const pLimiteMax           = document.getElementById("pLimiteMax");
  const prestamoInputWrap    = document.getElementById("prestamoInputWrap");
  const pMontoError          = document.getElementById("pMontoError");
  const pMontoErrorTxt       = document.getElementById("pMontoErrorTxt");
  const pTNA                 = document.getElementById("pTNA");
  const moraBanner           = document.getElementById("moraBanner");
  const moraBannerMsg        = document.getElementById("moraBannerMsg");
  const ptabBadge            = document.getElementById("ptabBadge");
  const misPrestamosContent  = document.getElementById("misPrestamosContent");

  function _fillSlider(slider) {
    const pct = (slider.value - slider.min) / (slider.max - slider.min) * 100;
    slider.style.background = `linear-gradient(to right, var(--green) ${pct}%, var(--border) ${pct}%)`;
  }

  function _validarPrestamo(monto, cuota, saldoARS) {
    const ingresoEst     = Math.max(saldoARS * 2, 50000);
    const superaLimite   = monto > _limitePreaprobado;
    const superaIngresos = cuota > ingresoEst * P_INCOME_CAP;
    if (prestamoInputWrap) prestamoInputWrap.classList.toggle("input-error", superaLimite);
    if (pMontoError) {
      pMontoError.classList.toggle("hidden", !superaLimite);
      if (superaLimite && pMontoErrorTxt) pMontoErrorTxt.textContent = `El monto supera tu límite pre-aprobado (${_fmtARS(_limitePreaprobado)})`;
    }
    if (pWarnLimite) {
      pWarnLimite.classList.toggle("hidden", !superaLimite);
      if (superaLimite) pWarnLimite.innerHTML = `<i class="fas fa-ban"></i> Monto superior a tu límite pre-aprobado (${_fmtARS(_limitePreaprobado)})`;
    }
    if (pWarnIngresos) {
      pWarnIngresos.classList.toggle("hidden", !(!superaLimite && superaIngresos));
      if (!superaLimite && superaIngresos) {
        const plazosSugeridos = [12, 24, 36].filter(p => p > _prestamoCuotas);
        const sug = plazosSugeridos.length ? ` Considerá extender el plazo a ${plazosSugeridos[0]} cuotas.` : "";
        pWarnIngresos.innerHTML = `<i class="fas fa-info-circle"></i> La cuota supera el 30 % del ingreso estimado.${sug}`;
      }
    }
    if (prestamoSolicitarBtn) prestamoSolicitarBtn.disabled = superaLimite;
    return !superaLimite;
  }

  function _actualizarSimulador() {
    if (!prestamoSlider) return;
    if (_prestamoMonto <= 0) {
      if (prestamoCuotaHero) prestamoCuotaHero.textContent = "—";
      if (pTEA)       pTEA.textContent       = "—";
      if (pIntereses) pIntereses.textContent = "—";
      if (pIVA)       pIVA.textContent       = "—";
      if (pTotal)     pTotal.textContent     = "—";
      if (pCFT)       pCFT.textContent       = "—";
      pWarnLimite?.classList.add("hidden");
      pWarnIngresos?.classList.add("hidden");
      pMontoError?.classList.add("hidden");
      prestamoInputWrap?.classList.remove("input-error");
      if (prestamoSolicitarBtn) prestamoSolicitarBtn.disabled = true;
      if (prestamoTablaBtn)     prestamoTablaBtn.disabled     = true;
      pTNA?.classList.add("muted");
      return;
    }
    if (prestamoTablaBtn) prestamoTablaBtn.disabled = false;
    pTNA?.classList.remove("muted");
    const { cuota, totalIntereses, iva, totalPagar, tea, cft } = _calcPrestamo(_prestamoMonto, _prestamoCuotas);
    if (prestamoCuotaHero) prestamoCuotaHero.textContent = _fmtARS(cuota);
    if (pTEA)       pTEA.textContent       = _fmtPct(tea);
    if (pIntereses) pIntereses.textContent = _fmtARS(totalIntereses);
    if (pIVA)       pIVA.textContent       = _fmtARS(iva);
    if (pTotal)     pTotal.textContent     = _fmtARS(totalPagar);
    if (pCFT)       pCFT.textContent       = _fmtPct(cft);
    if (prestamoTablaWrap && !prestamoTablaWrap.classList.contains("hidden")) _renderTabla();
    _validarPrestamo(_prestamoMonto, cuota, saldoActual || 0);
  }

  function _renderTabla() {
    if (!prestamoTablaTbody) return;
    prestamoTablaTbody.innerHTML = _tablaAmortizacion(_prestamoMonto, _prestamoCuotas).map(r => `
      <tr>
        <td>${r.n}</td><td>${_fmtARS(r.capital)}</td><td>${_fmtARS(r.interes)}</td>
        <td>${_fmtARS(r.iva)}</td><td>${_fmtARS(r.cuotaConIVA)}</td><td>${_fmtARS(r.saldo)}</td>
      </tr>`).join("");
  }

  function _actualizarLimite(saldoARS) {
    // Solo actualizar si el saldo ya se cargó (evita pisar $5M por defecto con $100k en race condition)
    if (saldoARS > 0) {
      _limitePreaprobado = Math.min(P_MONTO_MAX, Math.max(100000, saldoARS * 5));
      if (prestamoSlider) prestamoSlider.max = _limitePreaprobado;
      if (pLimiteMax)  pLimiteMax.textContent  = _fmtARS(_limitePreaprobado);
      if (pLimiteInfo) pLimiteInfo.textContent = `Límite: ${_fmtARS(_limitePreaprobado)}`;
    }
    _actualizarSimulador();
  }
  // Hook global para que saldo.js pueda recalcular el límite después de loadSaldo
  window._actualizarLimitePrestamos = (saldoARS) => _actualizarLimite(saldoARS);

  const _parseMonto   = (str) => parseInt(str.replace(/\D/g, ""), 10) || 0;
  const _fmtInput     = (n)   => n > 0 ? n.toLocaleString("es-AR") : "";

  const _formatearInput = (input, valorRaw) => {
    const cursorAntes  = input.selectionStart;
    const oldVal       = input.value;
    const digitosAntes = (oldVal.slice(0, cursorAntes).match(/\d/g) || []).length;
    const formatted    = _fmtInput(valorRaw);
    input.value = formatted;
    let visto = 0, newPos = formatted.length;
    for (let i = 0; i < formatted.length; i++) {
      if (/\d/.test(formatted[i])) visto++;
      if (visto === digitosAntes) { newPos = i + 1; break; }
    }
    input.setSelectionRange(newPos, newPos);
  };

  // ── Slider ──
  if (prestamoSlider) {
    prestamoSlider.addEventListener("input", () => {
      _prestamoMonto = Number(prestamoSlider.value);
      if (prestamoMontoInput) prestamoMontoInput.value = _fmtInput(_prestamoMonto);
      _fillSlider(prestamoSlider);
      _actualizarSimulador();
    });
    _fillSlider(prestamoSlider);
  }

  // ── Input monto ──
  if (prestamoMontoInput) {
    prestamoMontoInput.addEventListener("keydown", (e) => {
      const pass = ["Backspace","Delete","ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Home","End","Tab","Enter"];
      if (pass.includes(e.key)) return;
      if ((e.ctrlKey || e.metaKey) && "acvxz".includes(e.key.toLowerCase())) return;
      if (!/^\d$/.test(e.key)) e.preventDefault();
    });
    prestamoMontoInput.addEventListener("input", () => {
      const raw = _parseMonto(prestamoMontoInput.value);
      _formatearInput(prestamoMontoInput, raw);
      _prestamoMonto = raw > 0 ? raw : 0;
      if (prestamoSlider) {
        prestamoSlider.value = Math.min(_prestamoMonto > 0 ? _prestamoMonto : P_MONTO_MIN, _limitePreaprobado);
        _fillSlider(prestamoSlider);
      }
      _actualizarSimulador();
    });
    prestamoMontoInput.addEventListener("blur", () => {
      if (_prestamoMonto > _limitePreaprobado) _prestamoMonto = _limitePreaprobado;
      else if (_prestamoMonto > 0) _prestamoMonto = Math.max(P_MONTO_MIN, _prestamoMonto);
      prestamoMontoInput.value = _fmtInput(_prestamoMonto);
      prestamoInputWrap?.classList.remove("input-error");
      pMontoError?.classList.add("hidden");
      if (prestamoSlider) { prestamoSlider.value = _prestamoMonto > 0 ? _prestamoMonto : P_MONTO_MIN; _fillSlider(prestamoSlider); }
      _actualizarSimulador();
    });
    prestamoMontoInput.addEventListener("focus", () => prestamoMontoInput.select());
    prestamoMontoInput.value = _fmtInput(_prestamoMonto);
  }

  // ── Pills de cuotas ──
  prestamoPills?.addEventListener("click", (e) => {
    const btn = e.target.closest(".prestamo-pill");
    if (!btn) return;
    prestamoPills.querySelectorAll(".prestamo-pill").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    _prestamoCuotas = Number(btn.dataset.cuotas);
    _actualizarSimulador();
  });

  // ── Tabla accordion ──
  prestamoTablaBtn?.addEventListener("click", () => {
    const open = prestamoTablaBtn.getAttribute("aria-expanded") === "true";
    prestamoTablaBtn.setAttribute("aria-expanded", String(!open));
    prestamoTablaWrap.classList.toggle("hidden", open);
    if (!open) _renderTabla();
  });

  // ── Tabs ──
  document.querySelectorAll(".ptab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".ptab").forEach(t => t.classList.remove("active"));
      document.querySelectorAll(".ptab-panel").forEach(p => p.classList.add("hidden"));
      tab.classList.add("active");
      document.getElementById(tab.dataset.panel)?.classList.remove("hidden");
    });
  });

  // ── Solicitar préstamo → modal ──
  prestamoSolicitarBtn?.addEventListener("click", () => {
    const { cuota, totalIntereses, iva, totalPagar, tea, cft } = _calcPrestamo(_prestamoMonto, _prestamoCuotas);
    if (prestamoModalDetalles) {
      prestamoModalDetalles.innerHTML = `
        <div class="pcd-monto-hero">
          <span class="pcd-monto-label">Recibís en tu cuenta</span>
          <span class="pcd-monto-valor">${_fmtARS(_prestamoMonto)}</span>
          <span class="pcd-monto-sub">Acreditación inmediata · ${_prestamoCuotas} cuotas</span>
        </div>
        <div class="pcd-rows">
          <div class="pcd-row"><span>Cuota mensual</span><span>${_fmtARS(cuota)}</span></div>
          <div class="pcd-row"><span>TNA</span><span>${_fmtPct(PRESTAMO_TNA)}</span></div>
          <div class="pcd-row"><span>TEA</span><span>${_fmtPct(tea)}</span></div>
          <div class="pcd-row"><span>Total intereses</span><span>${_fmtARS(totalIntereses)}</span></div>
          <div class="pcd-row"><span>IVA (21 %)</span><span>${_fmtARS(iva)}</span></div>
          <div class="pcd-row"><span>CFT estimado</span><span class="pcd-cft">${_fmtPct(cft)}</span></div>
        </div>
        <div class="pcd-total">
          <span class="pcd-total-label">Total a devolver</span>
          <span class="pcd-total-valor">${_fmtARS(totalPagar)}</span>
        </div>`;
    }
    if (prestamoTyC)         prestamoTyC.checked         = false;
    if (prestamoModalConfirmar) prestamoModalConfirmar.disabled = true;
    prestamoModal.classList.remove("hidden");
  });

  prestamoTyC?.addEventListener("change", () => {
    if (prestamoModalConfirmar) prestamoModalConfirmar.disabled = !prestamoTyC.checked;
  });

  const _cerrarPrestamoModal = () => prestamoModal?.classList.add("hidden");
  prestamoModalClose?.addEventListener("click",    _cerrarPrestamoModal);
  prestamoModalCancelar?.addEventListener("click", _cerrarPrestamoModal);
  prestamoModal?.addEventListener("click", e => { if (e.target === prestamoModal) _cerrarPrestamoModal(); });

  // ── Link Términos y Condiciones → modal TyC ──
  prestamoModal?.addEventListener("click", e => {
    if (e.target.classList.contains("link-green") || e.target.closest(".link-green")) {
      e.preventDefault();
      document.getElementById("tycModal")?.classList.remove("hidden");
    }
  });
  const _cerrarTycModal = () => document.getElementById("tycModal")?.classList.add("hidden");
  document.getElementById("tycModalClose")?.addEventListener("click",  _cerrarTycModal);
  document.getElementById("tycModalClose2")?.addEventListener("click", _cerrarTycModal);
  document.getElementById("tycModal")?.addEventListener("click", e => {
    if (e.target === document.getElementById("tycModal")) _cerrarTycModal();
  });

  prestamoModalConfirmar?.addEventListener("click", async () => {
    prestamoModalConfirmar.disabled   = true;
    prestamoModalConfirmar.textContent = "Procesando…";
    try {
      await apiFetch("/prestamos/solicitar", {
        method: "POST",
        body: JSON.stringify({ monto: _prestamoMonto, cuotas: _prestamoCuotas }),
      });
      _cerrarPrestamoModal();
      await loadSaldo();
      showToast(`${_fmtARS(_prestamoMonto)} acreditados en tu cuenta.`, 3500, "success");
      _cargarPrestamos();
      document.getElementById("ptabMisPresta")?.click();
    } catch (err) {
      showToast(err.message || "Error al solicitar el préstamo", 4500, "error");
      prestamoModalConfirmar.disabled = false;
    } finally {
      prestamoModalConfirmar.textContent = "Confirmar y acreditar";
    }
  });

  // ── Bloquear por mora ──
  const BTNS_BLOQUEADOS_POR_MORA = ["btn-transfer-shortcut","btnComprarUSD","btnVenderUSD","btnTransferirUSD"];
  function _aplicarBloqueoPorMora(enMora, p) {
    if (!moraBanner) return;
    moraBanner.classList.toggle("hidden", !enMora);
    if (enMora && moraBannerMsg && p) {
      const venc = new Date(p.fecha_proximo_vencimiento).toLocaleDateString("es-AR");
      moraBannerMsg.textContent = `Tenés una cuota vencida desde el ${venc}. Regularizá tu deuda para operar normalmente.`;
    }
    BTNS_BLOQUEADOS_POR_MORA.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      if (enMora) {
        el.setAttribute("data-mora-disabled", "1");
        el.disabled = true;
        el.title = "Operación bloqueada por cuota vencida";
        el.style.opacity = "0.45";
      } else if (el.getAttribute("data-mora-disabled")) {
        el.removeAttribute("data-mora-disabled");
        el.disabled = false;
        el.title = "";
        el.style.opacity = "";
      }
    });
  }

  // ── Renderizar Mis Préstamos ──
  function _renderMisPrestamos(lista) {
    if (!misPrestamosContent) return;
    const activos    = lista.filter(p => p.estado === "activo");
    const saldados   = lista.filter(p => p.estado === "saldado");
    const cancelados = lista.filter(p => p.estado === "cancelado");

    if (!lista.length) {
      misPrestamosContent.innerHTML = `
        <div class="mis-prestamos-empty">
          <i class="fas fa-file-invoice-dollar"></i>
          No tenés préstamos registrados. Usá el simulador para solicitarlo.
        </div>`;
      return;
    }
    misPrestamosContent.innerHTML = "";

    activos.forEach(p => {
      const enMora   = p.en_mora;
      const progPct  = p.cuotas > 0 ? (p.cuotas_pagadas / p.cuotas * 100).toFixed(1) : 0;
      const vencDate = p.fecha_proximo_vencimiento ? new Date(p.fecha_proximo_vencimiento) : null;
      const hoy      = new Date(); hoy.setHours(0, 0, 0, 0);
      const diasVenc = vencDate ? Math.round((vencDate - hoy) / 86400000) : null;
      let clsVenc = "", textoVenc = "—";
      if (vencDate) {
        textoVenc = vencDate.toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" });
        if (diasVenc < 0)      clsVenc = "vencida";
        else if (diasVenc <= 7) clsVenc = "urgente";
      }
      const wrapper = document.createElement("div");
      wrapper.className = "prestamo-card-activo";
      wrapper.dataset.id = p.id;
      wrapper.innerHTML = `
        <div class="prestamo-card-header">
          <div>
            <span class="prestamo-card-titulo">Préstamo NODO</span>
            <span class="prestamo-card-monto">${_fmtARS(p.monto)}</span>
          </div>
          <span class="prestamo-card-estado ${enMora ? "mora" : "activo"}">${enMora ? "⚠ En mora" : "Activo"}</span>
        </div>
        <div class="prestamo-card-body">
          <div class="prestamo-progress-label">
            <span>Cuotas pagadas</span><strong>${p.cuotas_pagadas} de ${p.cuotas}</strong>
          </div>
          <div class="prestamo-progress-track">
            <div class="prestamo-progress-fill" style="width:${progPct}%"></div>
          </div>
          ${vencDate ? `
          <div class="prestamo-venc-row">
            <span class="prestamo-venc-label">${diasVenc < 0 ? "Cuota vencida el" : "Próxima cuota el"}</span>
            <span class="prestamo-venc-fecha ${clsVenc}"><i class="far fa-calendar-alt"></i> ${textoVenc}</span>
          </div>` : ""}
          <div class="prestamo-resumen" style="margin-top:0;padding:14px 16px;">
            <div class="prestamo-rows" style="margin-bottom:0;">
              <div class="prestamo-row"><span>Cuota mensual</span><span>${_fmtARS(p.cuota_mensual)}</span></div>
              <div class="prestamo-row"><span>TNA</span><span>${(Number(p.tna) * 100).toFixed(0)} %</span></div>
              <div class="prestamo-row"><span>Saldo de cuotas</span><span>${p.cuotas - p.cuotas_pagadas} restantes</span></div>
            </div>
          </div>
          <div class="prestamo-autodebit-badge">
            <i class="fas fa-bolt"></i> Débito automático activado desde tu cuenta en pesos
          </div>
          <div class="prestamo-acciones" style="margin-top:0;">
            <button class="btn-primary${diasVenc !== null && diasVenc <= 0 ? ' pagar-cuota-urgente' : ''} pagar-cuota-btn" data-id="${p.id}" style="flex:1">
              <i class="fas fa-${diasVenc !== null && diasVenc <= 0 ? 'exclamation-circle' : 'clock'}"></i> ${diasVenc !== null && diasVenc <= 0 ? `Pagar cuota vencida (${_fmtARS(p.cuota_mensual)})` : `Adelantar pago de cuota (${_fmtARS(p.cuota_mensual)})`}
            </button>
            <button class="btn-secondary descargar-resumen-btn" data-id="${p.id}" title="Descargar resumen">
              <i class="fas fa-download"></i> Resumen
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
                <thead><tr><th>#</th><th>Capital</th><th>Interés</th><th>IVA</th><th>Cuota c/IVA</th><th>Saldo</th></tr></thead>
                <tbody class="tabla-tbody" data-id="${p.id}"></tbody>
              </table>
            </div>
          </div>
        </div>`;
      misPrestamosContent.appendChild(wrapper);
    });

    if (saldados.length || cancelados.length) {
      const hist = document.createElement("div");
      hist.style.cssText = "margin-top:20px;";
      hist.innerHTML = `<p class="prestamo-label" style="margin-bottom:10px;">Histórico</p>` +
        [...saldados, ...cancelados].map(p => `
          <div class="prestamo-card-activo" style="margin-bottom:8px;opacity:.7;">
            <div class="prestamo-card-header">
              <div>
                <span class="prestamo-card-titulo">Préstamo NODO</span>
                <span class="prestamo-card-monto" style="font-size:1.1rem;">${_fmtARS(p.monto)}</span>
              </div>
              <span class="prestamo-card-estado ${p.estado}">${p.estado === "saldado" ? "✓ Saldado" : "Cancelado"}</span>
            </div>
          </div>`).join("");
      misPrestamosContent.appendChild(hist);
    }

    misPrestamosContent.querySelectorAll(".pagar-cuota-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        btn.disabled = true; btn.textContent = "Procesando…";
        try {
          const r = await apiFetch(`/prestamos/${id}/pagar-cuota`, { method: "POST" });
          showToast(r.message, 3500, "success");
          await loadSaldo();
          _cargarPrestamos();
        } catch (err) {
          showToast(err.message || "Error al pagar la cuota", 4000, "error");
          btn.disabled = false;
          btn.innerHTML = `<i class="fas fa-credit-card"></i> Pagar cuota`;
        }
      });
    });

    misPrestamosContent.querySelectorAll(".descargar-resumen-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        const p  = lista.find(x => String(x.id) === id);
        if (!p) return;
        const lineas = [
          `Préstamo NODO — Resumen`,
          `ID: ${p.id}`,
          `Monto: ${_fmtARS(p.monto)}`,
          `Cuotas: ${p.cuotas} (${p.cuotas_pagadas} pagadas)`,
          `Cuota mensual: ${_fmtARS(p.cuota_mensual)}`,
          `TNA: ${(Number(p.tna) * 100).toFixed(0)} %`,
          `Estado: ${p.estado}`,
          p.fecha_proximo_vencimiento ? `Próxima cuota: ${new Date(p.fecha_proximo_vencimiento).toLocaleDateString("es-AR")}` : "",
        ].filter(Boolean).join("\n");
        const blob = new Blob([lineas], { type: "text/plain;charset=utf-8" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `prestamo-${id}.txt`;
        a.click();
        URL.revokeObjectURL(a.href);
      });
    });

    misPrestamosContent.querySelectorAll(".tabla-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const id   = btn.dataset.id;
        const wrap  = misPrestamosContent.querySelector(`.tabla-wrap[data-id="${id}"]`);
        const tbody = misPrestamosContent.querySelector(`.tabla-tbody[data-id="${id}"]`);
        const open  = btn.getAttribute("aria-expanded") === "true";
        btn.setAttribute("aria-expanded", String(!open));
        wrap.classList.toggle("hidden", open);
        if (!open && tbody) {
          const p = lista.find(x => String(x.id) === id);
          if (p) tbody.innerHTML = _tablaAmortizacion(Number(p.monto), p.cuotas).map(r => `
            <tr>
              <td>${r.n}</td><td>${_fmtARS(r.capital)}</td><td>${_fmtARS(r.interes)}</td>
              <td>${_fmtARS(r.iva)}</td><td>${_fmtARS(r.cuotaConIVA)}</td><td>${_fmtARS(r.saldo)}</td>
            </tr>`).join("");
        }
      });
    });
  }

  async function _cargarPrestamos() {
    try {
      await apiFetch("/prestamos/auto-debit", { method: "POST" }).catch(() => {});
      const lista   = await apiFetch("/prestamos");
      const enMora  = lista.find(p => p.en_mora);
      _aplicarBloqueoPorMora(!!enMora, enMora);
      const activos = lista.filter(p => p.estado === "activo");
      if (ptabBadge) {
        ptabBadge.textContent = activos.length || "";
        ptabBadge.classList.toggle("hidden", !activos.length);
      }
      _renderMisPrestamos(lista);
      _actualizarLimite(saldoActual || 0);
    } catch {}
  }

  _actualizarSimulador();
  if (session) _cargarPrestamos();
});
