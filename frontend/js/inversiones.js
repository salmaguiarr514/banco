document.addEventListener("DOMContentLoaded", async () => {
  const { data: { session } } = await _supabase.auth.getSession();
  if (!session) return;

  // ── Estado ──
  let tasas    = { pf: 0.75, caucion: 0.65, prestamo: 0.95, cclVenta: 1500, cclCompra: 1500 };
  let pfDias   = null;
  let cauDias  = null;

  const _fmt = (n, dec = 2) => Number(n).toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
  const _fmtARS = (n) => `$${_fmt(n, 0)}`;
  const interes = (monto, tna, dias) => monto * (tna / 365) * dias;
  const diasTranscurridos = (fechaInicio) =>
    Math.max(0, Math.floor((Date.now() - new Date(fechaInicio)) / 86400000));

  // ── Cargar tasas de mercado ──
  const loadTasas = async () => {
    try {
      tasas = await apiFetch("/inversiones/tasas");
      const pct = (v) => `${(v * 100).toFixed(1)}%`;
      const el = (id) => document.getElementById(id);
      if (el("pfTNABadge"))     el("pfTNABadge").innerHTML     = `${pct(tasas.pf)} TNA <span class="inv-info-icon" data-tip="Tasa Nominal Anual. Ganancia expresada en porcentaje anual. Para 30 días: capital × (TNA÷365) × 30.">i</span>`;
      if (el("caucionTNABadge")) el("caucionTNABadge").innerHTML = `${pct(tasas.caucion)} TNA <span class="inv-info-icon" data-tip="Derivada de la BADLAR del mercado. El rendimiento se calcula según los días transcurridos al vencimiento.">i</span>`;
      if (el("invCCLPill"))     el("invCCLPill").innerHTML       = `<i class="fas fa-dollar-sign"></i> CCL: $${_fmt(tasas.cclVenta, 0)} <span class="inv-info-icon" data-tip="Dólar Contado Con Liquidación: tipo de cambio bursátil. Los CEDEARs se valúan en pesos usando este valor como referencia.">i</span>`;
      if (el("invPFTasaPill"))  el("invPFTasaPill").innerHTML    = `<i class="fas fa-percent"></i> PF: ${pct(tasas.pf)} TNA`;
      actualizarPreviewPF();
      actualizarPreviewCaucion();
    } catch {}
  };

  // ── Tabs ──
  document.querySelectorAll(".inv-seg-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".inv-seg-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".inv-tab-panel").forEach(p => p.hidden = true);
      btn.classList.add("active");
      const panel = document.getElementById(`inv-tab-${btn.dataset.invTab}`);
      if (panel) panel.hidden = false;
      if (btn.dataset.invTab === "cedears") loadCedears();
    });
  });

  // ── Plazo Fijo ──
  document.querySelectorAll(".inv-dias-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".inv-dias-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      pfDias = Number(btn.dataset.dias);
      actualizarPreviewPF();
    });
  });

  const pfMontoInput = document.getElementById("pfMonto");
  pfMontoInput?.addEventListener("input", () => {
    const digits = pfMontoInput.value.replace(/\D/g, "");
    pfMontoInput.value = digits ? Number(digits).toLocaleString("es-AR") : "";
    actualizarPreviewPF();
  });

  const actualizarPreviewPF = () => {
    const monto = Number((pfMontoInput?.value || "").replace(/\./g, "").replace(/,/g, ".")) || 0;
    const preview = document.getElementById("pfPreview");
    if (!preview) return;
    if (!monto || !pfDias) { preview.hidden = true; return; }
    const rend  = interes(monto, tasas.pf, pfDias);
    const total = monto + rend;
    const acred = new Date(); acred.setDate(acred.getDate() + pfDias);
    const acredStr = acred.toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" });
    const el = document.getElementById.bind(document);
    if (el("pfRendimiento"))  el("pfRendimiento").textContent  = `+${_fmtARS(rend)}`;
    if (el("pfTotal"))        el("pfTotal").textContent        = _fmtARS(total);
    if (el("pfFechaAcred"))   el("pfFechaAcred").textContent   = `Acredita el ${acredStr}`;
    preview.hidden = false;
  };

  document.getElementById("pfForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!pfDias) { showToast("Elegí un plazo (30, 60 o 90 días)", 3000, "error"); return; }
    const monto = Number((pfMontoInput?.value || "").replace(/\./g, "").replace(/,/g, "."));
    if (!monto || monto <= 0) { showToast("Ingresá un monto válido", 3000, "error"); return; }
    const form = document.getElementById("pfForm");
    formLoad(form, true);
    try {
      const resp = await apiFetch("/inversiones/plazo-fijo", {
        method: "POST", body: JSON.stringify({ monto, dias: pfDias, tna: tasas.pf }),
      });
      showToast(`Plazo Fijo ${pfDias} días constituido — ${_fmtARS(monto)}`, 4000, "success");
      pfMontoInput.value = "";
      pfDias = null;
      document.querySelectorAll(".inv-dias-btn").forEach(b => b.classList.remove("active"));
      document.getElementById("pfPreview").hidden = true;
      if (resp?.nuevoSaldo !== undefined) {
        const ant = saldoActual; saldoActual = resp.nuevoSaldo;
        if (!saldoOculto) animarSaldo(ant, resp.nuevoSaldo); else actualizarDisplaySaldo();
      }
      await cargarPFs();
      await actualizarPatrimonio();
      await loadSaldo?.();
      if (loadMovimientosBtn) loadMovimientosBtn.click();
    } catch (err) {
      showToast(err.message || "Error al constituir el Plazo Fijo", 3500, "error");
    } finally { formLoad(document.getElementById("pfForm"), false); }
  });

  const cargarPFs = async () => {
    const list = document.getElementById("pfList");
    if (!list) return;
    try {
      const pfs = await apiFetch("/inversiones/plazo-fijo");
      if (!pfs.length) { list.innerHTML = `<li class="inv-empty-state"><i class="fas fa-piggy-bank inv-empty-icon"></i><p class="inv-empty-title">Aún no tenés plazos fijos</p><p class="inv-empty-sub">Constituí tu primer plazo fijo para empezar a hacer rendir tu dinero día a día.</p></li>`; return; }
      list.innerHTML = pfs.map(pf => {
        const dias = Number(pf.dias);
        const monto = Number(pf.monto);
        const tna   = Number(pf.tna);
        const dT    = diasTranscurridos(pf.fecha_inicio);
        const rend  = interes(monto, tna, dT);
        const total = monto + rend;
        const [vy, vm, vd] = (pf.fecha_vencimiento || "").slice(0, 10).split("-");
        const venc = new Date(+vy, +vm - 1, +vd).toLocaleDateString("es-AR");
        return `
          <li class="inv-inversion-item">
            <div class="inv-inversion-left">
              <span class="inv-inversion-tipo">Plazo Fijo · ${dias} días</span>
              <span class="inv-inversion-detalle">${(tna * 100).toFixed(1)}% TNA · Vence ${venc}</span>
            </div>
            <div class="inv-inversion-right">
              <span class="inv-inversion-monto">${_fmtARS(total)}</span>
              <span class="inv-inversion-rend">+${_fmtARS(rend)} acumulado</span>
              <button class="inv-detalle-btn" data-id="${pf.id}" data-tipo="pf" data-venc="${venc}">Ver detalle</button>
            </div>
          </li>`;
      }).join("");
      list.querySelectorAll(".inv-rescatar-btn[data-tipo='pf']").forEach(btn => {
        const pfData = pfs.find(p => String(p.id) === btn.dataset.id);
        btn.addEventListener("click", () => abrirPFDetail(pfData));
      });
    } catch { list.innerHTML = `<li class="inv-empty">Error al cargar</li>`; }
  };

  // ── Cauciones ──
  document.querySelectorAll(".inv-dias-btn-c").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".inv-dias-btn-c").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      cauDias = Number(btn.dataset.dias);
      actualizarPreviewCaucion();
    });
  });

  const cauMontoInput = document.getElementById("caucionMonto");
  cauMontoInput?.addEventListener("input", () => {
    const digits = cauMontoInput.value.replace(/\D/g, "");
    cauMontoInput.value = digits ? Number(digits).toLocaleString("es-AR") : "";
    actualizarPreviewCaucion();
  });

  const actualizarPreviewCaucion = () => {
    const monto = Number((cauMontoInput?.value || "").replace(/\./g, "").replace(/,/g, ".")) || 0;
    const preview = document.getElementById("caucionPreview");
    if (!preview) return;
    if (!monto || !cauDias) { preview.hidden = true; return; }
    const rend  = interes(monto, tasas.caucion, cauDias);
    const total = monto + rend;
    const acred = new Date(); acred.setDate(acred.getDate() + cauDias);
    const acredStr = acred.toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" });
    const el = document.getElementById.bind(document);
    if (el("caucionRendimiento"))  el("caucionRendimiento").textContent  = `+${_fmtARS(rend)}`;
    if (el("caucionTotal"))        el("caucionTotal").textContent        = _fmtARS(total);
    if (el("caucionFechaAcred"))   el("caucionFechaAcred").textContent   = `Acredita el ${acredStr}`;
    preview.hidden = false;
  };

  document.getElementById("caucionForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!cauDias) { showToast("Elegí un plazo (1, 7 o 14 días)", 3000, "error"); return; }
    const monto = Number((cauMontoInput?.value || "").replace(/\./g, "").replace(/,/g, "."));
    if (!monto || monto <= 0) { showToast("Ingresá un monto válido", 3000, "error"); return; }
    const form = document.getElementById("caucionForm");
    formLoad(form, true);
    try {
      const resp = await apiFetch("/inversiones/cauciones", {
        method: "POST", body: JSON.stringify({ monto, dias: cauDias, tna: tasas.caucion }),
      });
      showToast(`Caución ${cauDias} día${cauDias > 1 ? 's' : ''} colocada — ${_fmtARS(monto)}`, 4000, "success");
      cauMontoInput.value = "";
      cauDias = null;
      document.querySelectorAll(".inv-dias-btn-c").forEach(b => b.classList.remove("active"));
      document.getElementById("caucionPreview").hidden = true;
      if (resp?.nuevoSaldo !== undefined) {
        const ant = saldoActual; saldoActual = resp.nuevoSaldo;
        if (!saldoOculto) animarSaldo(ant, resp.nuevoSaldo); else actualizarDisplaySaldo();
      }
      await cargarCauciones();
      await actualizarPatrimonio();
      await loadSaldo?.();
      if (loadMovimientosBtn) loadMovimientosBtn.click();
    } catch (err) {
      showToast(err.message || "Error al colocar la caución", 3500, "error");
    } finally { formLoad(document.getElementById("caucionForm"), false); }
  });

  const cargarCauciones = async () => {
    const list = document.getElementById("caucionesList");
    if (!list) return;
    try {
      const cauciones = await apiFetch("/inversiones/cauciones");
      if (!cauciones.length) { list.innerHTML = `<li class="inv-empty-state"><i class="fas fa-chart-line inv-empty-icon"></i><p class="inv-empty-title">Sin cauciones activas</p><p class="inv-empty-sub">Colocá una caución y recibí rendimientos en 1, 7 o 14 días.</p></li>`; return; }
      list.innerHTML = cauciones.map(c => {
        const monto = Number(c.monto);
        const tna   = Number(c.tna);
        const dT    = diasTranscurridos(c.fecha_inicio);
        const rend  = interes(monto, tna, dT);
        const [cy, cm, cd] = (c.fecha_vencimiento || "").slice(0, 10).split("-");
        const venc = new Date(+cy, +cm - 1, +cd).toLocaleDateString("es-AR");
        return `
          <li class="inv-inversion-item">
            <div class="inv-inversion-left">
              <span class="inv-inversion-tipo">Caución · ${c.dias} día${c.dias > 1 ? 's' : ''}</span>
              <span class="inv-inversion-detalle">${(tna * 100).toFixed(1)}% TNA · Vence ${venc}</span>
            </div>
            <div class="inv-inversion-right">
              <span class="inv-inversion-monto">${_fmtARS(monto + rend)}</span>
              <span class="inv-inversion-rend">+${_fmtARS(rend)} acumulado</span>
              <button class="inv-rescatar-btn" data-id="${c.id}" data-tipo="cau">Rescatar</button>
            </div>
          </li>`;
      }).join("");
      list.querySelectorAll(".inv-rescatar-btn[data-tipo='cau']").forEach(btn => {
        btn.addEventListener("click", () => rescatar("cau", btn.dataset.id, btn));
      });
    } catch { list.innerHTML = `<li class="inv-empty">Error al cargar</li>`; }
  };

  // ── Modal Detalle Plazo Fijo ──
  const pfDetailModal = document.getElementById("pfDetailModal");
  const pfDetailBody  = document.getElementById("pfDetailBody");
  document.getElementById("closePFDetail")?.addEventListener("click", () => pfDetailModal?.classList.add("hidden"));
  pfDetailModal?.addEventListener("click", e => { if (e.target === pfDetailModal) pfDetailModal.classList.add("hidden"); });

  const abrirPFDetail = (pf) => {
    if (!pf || !pfDetailBody) return;
    const monto   = Number(pf.monto);
    const tna     = Number(pf.tna);
    const dias    = Number(pf.dias);
    const dT      = diasTranscurridos(pf.fecha_inicio);
    const rend    = interes(monto, tna, dias); // ganancia estimada al vencimiento
    const total   = monto + rend;

    const fmtFecha = (str) => {
      if (!str) return "—";
      const [y, m, d] = str.slice(0, 10).split("-");
      return new Date(+y, +m - 1, +d).toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" });
    };

    pfDetailBody.innerHTML = `
      <div class="pf-detail-hero">
        <span class="pf-detail-hero-label">Monto Total Estimado al vencimiento</span>
        <span class="pf-detail-hero-monto">${_fmtARS(total)}</span>
      </div>
      <div class="pf-detail-grid">
        <div class="pf-detail-row"><span class="pf-detail-label">Monto depositado</span><span class="pf-detail-value">${_fmtARS(monto)}</span></div>
        <div class="pf-detail-row"><span class="pf-detail-label">Tasa Nominal Anual (TNA)</span><span class="pf-detail-value">${(tna * 100).toFixed(1)}%</span></div>
        <div class="pf-detail-row"><span class="pf-detail-label">Plazo seleccionado</span><span class="pf-detail-value">${dias} días</span></div>
        <div class="pf-detail-row"><span class="pf-detail-label">Ganancia estimada</span><span class="pf-detail-value amount-positive">+${_fmtARS(rend)}</span></div>
        <div class="pf-detail-row"><span class="pf-detail-label">Fecha de constitución</span><span class="pf-detail-value">${fmtFecha(pf.fecha_inicio)}</span></div>
        <div class="pf-detail-row pf-detail-row--last"><span class="pf-detail-label">Fecha de vencimiento</span><span class="pf-detail-value">${fmtFecha(pf.fecha_vencimiento)}</span></div>
      </div>
      <div class="pf-detail-alert">
        <i class="fas fa-info-circle pf-detail-alert-icon"></i>
        Esta inversión finaliza automáticamente en la fecha de vencimiento y los fondos se acreditarán en tu cuenta. No permite rescate anticipado.
      </div>`;
    pfDetailModal?.classList.remove("hidden");
  };

  // ── Rescate genérico ──
  const rescatar = async (tipo, id, btn) => {
    btn.disabled = true;
    btn.textContent = "…";
    const endpoint = tipo === "pf" ? `/inversiones/plazo-fijo/${id}` : `/inversiones/cauciones/${id}`;
    const label    = tipo === "pf" ? "Plazo Fijo" : "Caución";
    try {
      const resp = await apiFetch(endpoint, { method: "DELETE" });
      const rendFmt = resp.rendimiento ? ` (+${_fmtARS(resp.rendimiento)} intereses)` : "";
      showToast(`${label} rescatado: ${_fmtARS(resp.montoTotal)}${rendFmt}`, 5000, "success");
      if (resp.nuevoSaldo !== undefined) {
        const ant = saldoActual; saldoActual = resp.nuevoSaldo;
        if (!saldoOculto) animarSaldo(ant, resp.nuevoSaldo); else actualizarDisplaySaldo();
      }
      if (tipo === "pf") await cargarPFs(); else await cargarCauciones();
      actualizarPatrimonio();
      await loadSaldo?.();
      if (loadMovimientosBtn) loadMovimientosBtn.click();
    } catch (err) {
      showToast(err.message || `Error al rescatar ${label}`, 3500, "error");
      btn.disabled = false;
      btn.textContent = "Rescatar";
    }
  };

  // ── CEDEARs ──
  let cedearsCargados = false;
  const loadCedears = async () => {
    if (cedearsCargados) return;
    const list = document.getElementById("cedearsList");
    if (!list) return;
    list.innerHTML = `<li class="inv-empty"><i class="fas fa-spinner fa-spin"></i> Cargando…</li>`;
    try {
      const { cedears } = await apiFetch("/inversiones/cedears");
      cedearsCargados = true;
      list.innerHTML = cedears.map(c => `
        <li class="cedear-item">
          <span class="cedear-ticker">${c.ticker}</span>
          <span class="cedear-nombre">${c.nombre}</span>
          <div class="cedear-precios">
            <span class="cedear-ars">${_fmtARS(c.precioARS)}</span>
            <span class="cedear-usd">U$S ${c.precioUSD.toFixed(2)}</span>
          </div>
          <span class="cedear-var ${c.variacion >= 0 ? 'amount-positive' : 'cedear-neg'}">
            ${c.variacion >= 0 ? '+' : ''}${c.variacion.toFixed(2)}%
          </span>
        </li>`).join("");
    } catch {
      list.innerHTML = `<li class="inv-empty">No se pudieron cargar los CEDEARs</li>`;
    }
  };

  // ── Patrimonio total ──
  const actualizarPatrimonio = async () => {
    try {
      const [pfs, cauciones] = await Promise.all([
        apiFetch("/inversiones/plazo-fijo"),
        apiFetch("/inversiones/cauciones"),
      ]);
      let total = 0;
      pfs.forEach(pf => {
        const dT = diasTranscurridos(pf.fecha_inicio);
        total += Number(pf.monto) + interes(Number(pf.monto), Number(pf.tna), dT);
      });
      cauciones.forEach(c => {
        const dT = diasTranscurridos(c.fecha_inicio);
        total += Number(c.monto) + interes(Number(c.monto), Number(c.tna), dT);
      });
      const el = document.getElementById("invPatrimonioTotal");
      if (el) el.textContent = total > 0 ? _fmtARS(total) : "$0,00";
    } catch {}
  };

  // ── Chips de monto rápido ──
  const _setChipMonto = (inputId, amount) => {
    const input = document.getElementById(inputId);
    if (!input) return;
    let val;
    if (amount === "all") {
      val = Math.floor(saldoActual);
    } else {
      const current = Number((input.value || "").replace(/\./g, "").replace(/,/g, ".")) || 0;
      val = current + Number(amount);
    }
    input.value = val > 0 ? val.toLocaleString("es-AR") : "";
    input.dispatchEvent(new Event("input"));
  };
  document.querySelectorAll(".inv-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      _setChipMonto(chip.dataset.target, chip.dataset.amount);
    });
  });

  // ── Init ──
  await loadTasas();
  await Promise.all([cargarPFs(), cargarCauciones()]);
  await actualizarPatrimonio();

  // Refresh al entrar a la sección
  document.querySelector('[data-section="inversiones"]')?.addEventListener("click", async () => {
    cedearsCargados = false;
    await loadTasas();
    await Promise.all([cargarPFs(), cargarCauciones()]);
    await actualizarPatrimonio();
    const cedPanel = document.getElementById("inv-tab-cedears");
    if (cedPanel && !cedPanel.hidden) loadCedears();
  });

  // ── Tour guiado (motor compartido NodoTour) ──
  const TOUR_KEY  = 'nodo_inv_tour_v1';
  const INV_STEPS = [
    { sel: '.inv-header-card', title: 'Patrimonio Invertido', text: 'Acá ves el total de tus inversiones activas. Las pastillas muestran el dólar CCL y la tasa de Plazo Fijo del mercado, actualizados automáticamente.' },
    { sel: '.inv-segmented',   title: 'Tres instrumentos',    text: 'Navegá entre las pestañas para operar cada instrumento. Solo se muestra el seleccionado para mantener la interfaz limpia y enfocada.' },
    { sel: '#pfForm',          title: '¿Qué instrumento elegir?', html: '<b>Plazo Fijo:</b> tasa garantizada a 30, 60 o 90 días.<br><br><b>Cauciones:</b> préstamos bursátiles de 1–14 días, ideal para liquidez rápida.<br><br><b>CEDEARs:</b> Apple, Nvidia y más, en pesos atados al dólar CCL.' },
  ];
  const _markInvSeen = async () => {
    localStorage.setItem(TOUR_KEY, '1');
    try { await _supabase.auth.updateUser({ data: { [TOUR_KEY]: '1' } }); } catch {}
  };
  const _invSeen = async () => {
    if (localStorage.getItem(TOUR_KEY)) return true;
    try {
      const { data: { user } } = await _supabase.auth.getUser();
      return user?.user_metadata?.[TOUR_KEY] === '1';
    } catch { return false; }
  };
  const _launchInvTour = () => NodoTour.start(INV_STEPS, { onEnd: _markInvSeen });
  document.getElementById('invHelpBtn')?.addEventListener('click', _launchInvTour);
  _invSeen().then(seen => { if (!seen) setTimeout(_launchInvTour, 900); });
});
