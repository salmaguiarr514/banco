document.addEventListener("DOMContentLoaded", async () => {
  const { data: { session } } = await _supabase.auth.getSession();

  const reservaForm        = document.getElementById("reservaForm");
  const reservasList       = document.getElementById("reservasList");
  const showReservaFormBtn = document.getElementById("showReservaFormBtn");
  const cancelReservaBtn   = document.getElementById("cancelReservaBtn");
  const reservaDetailModal = document.getElementById("reservaDetailModal");
  const closeReservaDetail = document.getElementById("closeReservaDetail");

  closeReservaDetail?.addEventListener("click", () => reservaDetailModal?.classList.add("hidden"));
  reservaDetailModal?.addEventListener("click", e => { if (e.target === reservaDetailModal) reservaDetailModal.classList.add("hidden"); });

  // ── Lógica financiera con interés simple diario (Base 365) ──
  const TASA_RESERVA   = 0.18;
  const _r             = TASA_RESERVA / 365; // tasa diaria
  const _diasCompletos = (res) => Math.max(0, Math.floor((new Date() - new Date(res.fecha_creacion)) / 86400000));
  const _fmt2          = (n) => n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Rendimiento diario constante: monto × (TNA/365)
  const _gananciaEnDia = (monto, _dia) => monto * _r;

  const _interesAcum = (res) => {
    const monto = Number(res.monto);
    const dias  = _diasCompletos(res);
    return monto * _r * dias;
  };

  const _valorActual = (res) => {
    const monto = Number(res.monto);
    const dias  = _diasCompletos(res);
    return monto + monto * _r * dias;
  };

  const _calcProyeccion = (res) => {
    const hoy       = new Date();
    const venc      = new Date(res.fecha_vencimiento);
    const monto     = Number(res.monto);
    const diasRest  = Math.max(0, Math.round((venc - hoy) / 86400000));
    const diasAcum  = _diasCompletos(res);
    // Días totales desde creación hasta vencimiento (al menos los ya transcurridos)
    const diasTotal = Math.max(Math.round((venc - new Date(res.fecha_creacion)) / 86400000), diasAcum);
    const interesAc = monto * _r * diasAcum;
    const valorAct  = monto + interesAc;
    // Rendimiento diario: constante todos los días
    const gananciaHoy = monto * _r;
    // Total proyectado al vencimiento con interés simple
    const total     = monto + monto * _r * diasTotal;
    return {
      diasRest,
      gananciaDiaria: gananciaHoy,
      interesAcum: interesAc,
      valorActual: valorAct,
      total,
      finalizado: diasRest === 0,
    };
  };

  const _historialDiario = (res, maxDias = 30) => {
    const diasAcum = _diasCompletos(res);
    const dias     = Math.min(diasAcum, maxDias);
    const monto    = Number(res.monto);
    const hoy      = new Date();
    return Array.from({ length: dias }, (_, i) => {
      // Día desde inicio: hoy = diasAcum, ayer = diasAcum-1, etc.
      const diaDesdeInicio = diasAcum - i;
      const fecha = new Date(hoy);
      fecha.setDate(fecha.getDate() - i);
      return {
        label:   i === 0 ? `Hoy, ${fecha.toLocaleDateString("es-AR", { day: "numeric", month: "short" })}`
               : i === 1 ? `Ayer, ${fecha.toLocaleDateString("es-AR", { day: "numeric", month: "short" })}`
               : fecha.toLocaleDateString("es-AR", { day: "2-digit", month: "short" }),
        ganancia: _gananciaEnDia(monto, diaDesdeInicio),
      };
    });
  };

  // ── Modal de detalle ──
  const abrirReservaDetail = (res) => {
    const { diasRest, gananciaDiaria, interesAcum, valorActual, total, finalizado } = _calcProyeccion(res);
    const monto    = Number(res.monto);
    const historial = _historialDiario(res, 30);
    const body      = document.getElementById("reservaDetailBody");
    if (body) {
      body.innerHTML = `
        <div class="reserva-tna-badge"><i class="fas fa-chart-line"></i> Rindiendo al ${(TASA_RESERVA * 100).toFixed(0)}% TNA</div>
        <div class="reserva-detail-hero">
          <span class="reserva-detail-hero-label">${finalizado ? "Valor final" : "Valor actual"}</span>
          <span class="reserva-detail-hero-monto">$${_fmt2(valorActual)}</span>
          <span class="reserva-detail-hero-ganancia">+$${_fmt2(interesAcum)} ganados desde el inicio</span>
        </div>
        <div class="reserva-detail-grid">
          <div class="reserva-detail-row"><span class="reserva-detail-label">Monto depositado</span><span class="reserva-detail-value">$${_fmt2(monto)}</span></div>
          <div class="reserva-detail-row"><span class="reserva-detail-label">Rendimiento de hoy</span><span class="reserva-detail-value amount-positive">+$${_fmt2(gananciaDiaria)}</span></div>
          <div class="reserva-detail-row"><span class="reserva-detail-label">Días acreditados</span><span class="reserva-detail-value">${_diasCompletos(res)}</span></div>
          ${finalizado
            ? `<div class="reserva-detail-row"><span class="reserva-detail-label" style="color:var(--green);font-weight:700;">Reserva finalizada</span><span class="reserva-detail-value" style="color:var(--green);">✓</span></div>`
            : `<div class="reserva-detail-row"><span class="reserva-detail-label">Días al vencimiento</span><span class="reserva-detail-value">${diasRest} días</span></div>
               <div class="reserva-detail-row reserva-detail-total"><span class="reserva-detail-label">Total estimado al vencimiento</span><span class="reserva-detail-value">$${_fmt2(total)}</span></div>`
          }
          <p class="reserva-detail-date"><i class="far fa-calendar-alt"></i> ${finalizado ? "Venció el" : "Vence el"} ${new Date(res.fecha_vencimiento).toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" })}</p>
        </div>
        <div class="reserva-modal-acciones">
          <button class="btn-secondary reserva-accion-btn" id="reservaIngresarBtn"><i class="fas fa-plus-circle"></i> Ingresar más</button>
          <button class="btn-danger reserva-accion-btn" id="reservaRescatarBtn"><i class="fas fa-hand-holding-usd"></i> Retirar reserva</button>
        </div>
        ${historial.length > 0 ? `
        <div class="reserva-historial-wrap">
          <button class="reserva-historial-toggle" id="rvHistorialBtn" aria-expanded="false">
            <i class="fas fa-history"></i>
            <span>Historial de rendimientos (${historial.length} días)</span>
            <i class="fas fa-chevron-down reserva-historial-chevron"></i>
          </button>
          <ul class="reserva-historial-list" id="rvHistorialList">
            ${historial.map(e => `<li class="reserva-historial-item"><span class="reserva-historial-fecha">${e.label}</span><span class="reserva-historial-ganancia amount-positive">+$${_fmt2(e.ganancia)}</span></li>`).join("")}
          </ul>
        </div>` : ""}`;

      document.getElementById("rvHistorialBtn")?.addEventListener("click", () => {
        const list = document.getElementById("rvHistorialList");
        const btn  = document.getElementById("rvHistorialBtn");
        const open = btn.getAttribute("aria-expanded") === "true";
        btn.setAttribute("aria-expanded", String(!open));
        btn.querySelector(".reserva-historial-chevron")?.classList.toggle("rotated", !open);
        list?.classList.toggle("open", !open);
      });

      document.getElementById("reservaIngresarBtn")?.addEventListener("click", () => {
        showToast("Función de ingreso adicional próximamente.", 2500, "info");
      });

      document.getElementById("reservaRescatarBtn")?.addEventListener("click", async () => {
        const rescatarBtn = document.getElementById("reservaRescatarBtn");
        rescatarBtn.disabled = true;
        rescatarBtn.textContent = "Retirando…";
        try {
          const resp = await apiFetch(`/reservas/${res.id}`, { method: "DELETE" });
          reservaDetailModal?.classList.add("hidden");
          const nuevoSaldoFmt = resp?.nuevoSaldo !== undefined && !saldoOculto
            ? ` · Saldo disponible: $${Number(resp.nuevoSaldo).toLocaleString("es-AR", { minimumFractionDigits: 2 })}`
            : "";
          showToast(`Reserva "${res.nombre}" rescatada con éxito${nuevoSaldoFmt}`, 4000, "success");
          if (resp?.nuevoSaldo !== undefined) {
            const anterior = saldoActual;
            saldoActual = resp.nuevoSaldo;
            if (!saldoOculto) animarSaldo(anterior, resp.nuevoSaldo);
            else actualizarDisplaySaldo();
          }
          await cargarReservas();
          await loadSaldo?.();
          if (loadMovimientosBtn) loadMovimientosBtn.click();
        } catch (err) {
          showToast(err.message || "Error al rescatar la reserva", 3500, "error");
          rescatarBtn.disabled = false;
          rescatarBtn.innerHTML = '<i class="fas fa-hand-holding-usd"></i> Retirar reserva';
        }
      });
    }
    document.getElementById("reservaDetailNombre").textContent = res.nombre;
    reservaDetailModal?.classList.remove("hidden");
  };

  // ── Lista ──
  const renderReservas = (reservas) => {
    if (!reservasList) return;
    if (reservas.length === 0) {
      reservasList.innerHTML = '<li class="muted" style="text-align:center;padding:15px;">No tenés reservas activas</li>';
      return;
    }
    reservasList.innerHTML = reservas.map(res => {
      const diasAcum       = _diasCompletos(res);
      const monto          = Number(res.monto);
      const valorActual    = monto + monto * _r * diasAcum;
      const gananciaDiaria = monto * _r;
      return `
        <li class="reserva-item" data-id="${res.id}">
          <div class="reserva-item-top">
            <div class="reserva-item-info">
              <span class="reserva-item-nombre">${res.nombre}</span>
              <span class="reserva-tna-pill"><i class="fas fa-circle-check"></i> ${(TASA_RESERVA * 100).toFixed(0)}% TNA</span>
            </div>
            <div class="reserva-item-montos">
              <span class="reserva-item-monto">$${_fmt2(valorActual)}</span>
              ${diasAcum > 0 ? `<span class="reserva-item-ganancia">+$${_fmt2(gananciaDiaria)} hoy</span>` : '<span class="reserva-item-ganancia">Acredita mañana</span>'}
            </div>
          </div>
          <div class="reserva-item-bottom">
            <span class="reserva-item-fecha"><i class="far fa-calendar-alt"></i> Vence ${new Date(res.fecha_vencimiento).toLocaleDateString("es-AR")}</span>
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
    try { renderReservas(await apiFetch("/reservas")); }
    catch { renderReservas([]); }
  };
  if (session) cargarReservas();

  // Botones días
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

  const nuevaReservaModal = document.getElementById("nuevaReservaModal");
  showReservaFormBtn?.addEventListener("click", () => nuevaReservaModal?.classList.remove("hidden"));
  cancelReservaBtn?.addEventListener("click",   () => nuevaReservaModal?.classList.add("hidden"));
  nuevaReservaModal?.addEventListener("click", e => { if (e.target === nuevaReservaModal) nuevaReservaModal.classList.add("hidden"); });

  const reservaMontoInput = document.getElementById("reservaMonto");
  reservaMontoInput?.addEventListener("input", () => {
    const digits = reservaMontoInput.value.replace(/\D/g, "");
    reservaMontoInput.value = digits ? Number(digits).toLocaleString("es-AR") : "";
  });

  if (reservaForm) {
    reservaForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fechaVal = document.getElementById("reservaFecha").value;
      if (!fechaVal) { showToast("Elegí un plazo (30, 60 o 90 días)", 3000, "error"); return; }
      const body = {
        nombre: document.getElementById("reservaNombre").value,
        fecha_vencimiento: fechaVal,
        monto: Number(reservaMontoInput.value.replace(/\./g, "").replace(/,/g, ".")),
      };
      formLoad(reservaForm, true);
      try {
        const resp = await apiFetch("/reservas", { method: "POST", body: JSON.stringify(body) });
        const nuevoSaldoFmt = resp?.nuevoSaldo !== undefined && !saldoOculto
          ? ` · Saldo disponible: $${Number(resp.nuevoSaldo).toLocaleString("es-AR", { minimumFractionDigits: 2 })}`
          : "";
        showToast(`Reserva "${body.nombre}" creada${nuevoSaldoFmt}`, 4000, "success");
        reservaForm.reset();
        document.querySelectorAll(".reserva-dia-btn").forEach(b => b.classList.remove("active"));
        nuevaReservaModal?.classList.add("hidden");
        if (resp?.nuevoSaldo !== undefined) {
          const anterior = saldoActual;
          saldoActual = resp.nuevoSaldo;
          if (!saldoOculto) animarSaldo(anterior, resp.nuevoSaldo);
          else actualizarDisplaySaldo();
        }
        await cargarReservas();
        await loadSaldo?.();
        if (loadMovimientosBtn) loadMovimientosBtn.click();
      } catch (err) {
        showToast(err.message || "Error al crear la reserva", 3500, "error");
      } finally {
        formLoad(reservaForm, false);
      }
    });
  }
});
