document.addEventListener("DOMContentLoaded", async () => {
  const { data: { session } } = await _supabase.auth.getSession();

  // Toggle panel datos
  const toggleCardDataBtn = document.getElementById("toggleCardDataBtn");
  const cardDataPanel     = document.getElementById("cardDataPanel");
  if (toggleCardDataBtn && cardDataPanel) {
    toggleCardDataBtn.addEventListener("click", () => {
      const isOpen = !cardDataPanel.classList.contains("hidden");
      cardDataPanel.classList.toggle("hidden");
      toggleCardDataBtn.classList.toggle("unlocked", !isOpen);
      const icon  = toggleCardDataBtn.querySelector("i");
      const label = toggleCardDataBtn.querySelector("span");
      icon.className    = isOpen ? "fas fa-lock" : "fas fa-lock-open";
      label.textContent = isOpen ? "Ver datos" : "Ocultar";
      if (isOpen) {
        const cvvEl  = document.getElementById("cardDataCvv");
        const panEl  = document.getElementById("cardDataPan");
        const revCvv = document.getElementById("revealCvvBtn");
        const revPan = document.getElementById("revealPanBtn");
        if (cvvEl) cvvEl.textContent = "•••";
        if (panEl && tarjetaActiva) { panEl.textContent = tarjetaActiva.pan_masked; panEl.dataset.value = tarjetaActiva.pan_masked?.replace(/\s/g, "") || ""; }
        if (revCvv) revCvv.innerHTML = '<i class="fas fa-eye"></i>';
        if (revPan) revPan.innerHTML = '<i class="fas fa-eye"></i>';
      }
    });
  }

  // Cargar tarjeta inicial
  if (session) cargarTarjeta();

  // Emitir tarjeta
  document.getElementById("emitirTarjetaBtn")?.addEventListener("click", async () => {
    const btn = document.getElementById("emitirTarjetaBtn");
    btn.disabled = true; btn.textContent = "Emitiendo...";
    try {
      const data = await apiFetch("/cards", { method: "POST" });
      const cvvEmitido = data.cvv;
      await cargarTarjeta();
      showToast(cvvEmitido ? `Tarjeta emitida · CVV: ${cvvEmitido}` : "Tarjeta emitida correctamente", 8000, "success");
    } catch (err) {
      showToast(err.message || "Error al emitir tarjeta", 3500, "error");
    } finally {
      const b = document.getElementById("emitirTarjetaBtn");
      if (b) { b.disabled = false; b.innerHTML = '<i class="fas fa-plus" style="margin-right:6px;"></i>Emitir tarjeta virtual'; }
    }
  });

  // Bloquear / activar
  document.getElementById("toggleCardStatusBtn")?.addEventListener("click", async () => {
    if (!tarjetaActiva) return;
    const newStatus = tarjetaActiva.status === "active" ? "blocked" : "active";
    try {
      await apiFetch(`/cards/${tarjetaActiva.id}/status`, { method: "PATCH", body: JSON.stringify({ status: newStatus }) });
      tarjetaActiva.status = newStatus;
      renderTarjeta();
      showToast(newStatus === "blocked" ? "Tarjeta bloqueada" : "Tarjeta activada", 3000, newStatus === "blocked" ? "error" : "success");
    } catch (err) {
      showToast(err.message || "Error al cambiar estado", 3500, "error");
    }
  });

  // Revelar PAN
  document.getElementById("revealPanBtn")?.addEventListener("click", () => {
    const panEl = document.getElementById("cardDataPan");
    const btn   = document.getElementById("revealPanBtn");
    if (!panEl || !tarjetaActiva) return;
    if (!tarjetaActiva.pan) { showToast("Esta tarjeta es antigua. Cancelala y emití una nueva.", 4000, "error"); return; }
    const visible  = panEl.textContent !== tarjetaActiva.pan_masked;
    const fullPan  = tarjetaActiva.pan.replace(/(\d{4})(?=\d)/g, "$1 ");
    panEl.textContent   = visible ? tarjetaActiva.pan_masked : fullPan;
    panEl.dataset.value = visible ? tarjetaActiva.pan_masked.replace(/\s/g, "") : tarjetaActiva.pan;
    btn.innerHTML       = visible ? '<i class="fas fa-eye"></i>' : '<i class="fas fa-eye-slash"></i>';
    btn.title           = visible ? "Mostrar número" : "Ocultar número";
  });

  // Revelar CVV
  document.getElementById("revealCvvBtn")?.addEventListener("click", () => {
    const cvvEl = document.getElementById("cardDataCvv");
    const btn   = document.getElementById("revealCvvBtn");
    if (!cvvEl || !tarjetaActiva) return;
    if (!tarjetaActiva.cvv) { showToast("Esta tarjeta es antigua. Cancelala y emití una nueva.", 4000, "error"); return; }
    const visible    = cvvEl.textContent !== "•••";
    cvvEl.textContent = visible ? "•••" : tarjetaActiva.cvv;
    btn.innerHTML     = visible ? '<i class="fas fa-eye"></i>' : '<i class="fas fa-eye-slash"></i>';
    btn.title         = visible ? "Mostrar CVV" : "Ocultar CVV";
  });

  // Cancelar tarjeta
  const cancelConfirmEl = document.getElementById("cancelCardConfirm");
  document.getElementById("cancelarTarjetaBtn")?.addEventListener("click", () => cancelConfirmEl?.classList.remove("hidden"));
  document.getElementById("cancelCardConfirmNo")?.addEventListener("click", () => cancelConfirmEl?.classList.add("hidden"));
  document.getElementById("cancelCardConfirmYes")?.addEventListener("click", async () => {
    if (!tarjetaActiva) return;
    const btn = document.getElementById("cancelCardConfirmYes");
    btn.disabled = true; btn.textContent = "Cancelando...";
    try {
      await apiFetch(`/cards/${tarjetaActiva.id}`, { method: "DELETE" });
      tarjetaActiva = null;
      cancelConfirmEl?.classList.add("hidden");
      renderTarjeta();
      showToast("Tarjeta cancelada. Podés emitir una nueva cuando quieras.", 4000, "success");
    } catch (err) {
      showToast(err.message || "Error al cancelar la tarjeta", 3500, "error");
      btn.disabled = false; btn.textContent = "Sí, cancelar";
    }
  });

  // Modal pagar con tarjeta
  document.getElementById("pagarTarjetaBtn")?.addEventListener("click", () => {
    const modal = document.getElementById("cardPayModal");
    if (!modal) return;
    modal.querySelectorAll("[data-pay-tab]").forEach(b => b.classList.toggle("active", b.dataset.payTab === "merchant"));
    document.getElementById("payMerchantSection")?.classList.remove("hidden");
    document.getElementById("payPersonSection")?.classList.add("hidden");
    const preview = document.getElementById("payAliasPreview");
    if (preview) preview.textContent = "";
    payCardCBUVerificado = "";
    modal.classList.remove("hidden");
  });
  document.getElementById("closeCardPayModal")?.addEventListener("click", () => {
    document.getElementById("cardPayModal")?.classList.add("hidden");
    payCardCBUVerificado = "";
  });

  // Tabs dentro del modal pago
  document.getElementById("cardPayModal")?.querySelectorAll("[data-pay-tab]").forEach(btn => {
    btn.addEventListener("click", () => {
      document.getElementById("cardPayModal").querySelectorAll("[data-pay-tab]").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const tab = btn.dataset.payTab;
      document.getElementById("payMerchantSection")?.classList.toggle("hidden", tab !== "merchant");
      document.getElementById("payPersonSection")?.classList.toggle("hidden", tab !== "person");
      payCardCBUVerificado = "";
      const preview = document.getElementById("payAliasPreview");
      if (preview) preview.textContent = "";
    });
  });

  // Buscar alias/CBU para pago con tarjeta
  document.getElementById("payAlias")?.addEventListener("input", debounce(async () => {
    const valor   = document.getElementById("payAlias").value.trim();
    const preview = document.getElementById("payAliasPreview");
    if (!preview) return;
    payCardCBUVerificado = "";
    if (!valor) { preview.textContent = ""; return; }
    preview.textContent = "Verificando...";
    preview.style.color = "#666";
    try {
      const isCBU = valor.length === 22 && /^\d+$/.test(valor);
      let persona;
      if (isCBU) persona = await apiFetch(`/transferencias/buscar/${valor}`);
      else if (valor.length >= 4) persona = await apiFetch(`/transferencias/alias/${encodeURIComponent(valor)}`);
      else { preview.textContent = ""; return; }
      if (persona?.nombre) {
        preview.textContent = `${persona.nombre} ${persona.apellido}`;
        preview.style.color = "#059669";
        payCardCBUVerificado = persona.cbu;
      } else {
        preview.textContent = "Destinatario no encontrado";
        preview.style.color = "#d32f2f";
      }
    } catch {
      preview.textContent = "Destinatario no encontrado";
      preview.style.color = "#d32f2f";
    }
  }, 500));

  // Formato monto en pago con tarjeta
  const payAmountInput = document.getElementById("payAmount");
  if (payAmountInput) {
    payAmountInput.addEventListener("input", () => {
      const digits = payAmountInput.value.replace(/\D/g, "");
      payAmountInput.value = digits ? Number(digits).toLocaleString("es-AR") : "";
    });
  }

  // Confirmar pago con tarjeta
  document.getElementById("cardPayForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!tarjetaActiva) return;
    const activeTab  = document.getElementById("cardPayModal")?.querySelector("[data-pay-tab].active")?.dataset.payTab || "merchant";
    const amountStr  = document.getElementById("payAmount").value.replace(/\./g, "").replace(/,/g, ".");
    const amount     = Number(amountStr);
    if (!amount) { showToast("Ingresá un monto válido", 3000, "error"); return; }
    let merchantName, merchantCategory, cbuDestino;
    if (activeTab === "person") {
      if (!payCardCBUVerificado) { showToast("Buscá un destinatario válido antes de confirmar", 3000, "error"); return; }
      const aliasVal   = document.getElementById("payAlias").value.trim();
      const preview    = document.getElementById("payAliasPreview");
      merchantName     = preview?.textContent || aliasVal;
      merchantCategory = "transferencia";
      cbuDestino       = payCardCBUVerificado;
    } else {
      merchantName     = document.getElementById("payMerchant").value.trim();
      merchantCategory = document.getElementById("payCategory").value;
      if (!merchantName) { showToast("Ingresá el nombre del comercio", 3000, "error"); return; }
    }
    const btn = e.target.querySelector("button[type=\"submit\"]");
    if (btn) { btn.disabled = true; btn.textContent = "Procesando..."; }
    try {
      const payload = { cardId: tarjetaActiva.id, merchantName, merchantCategory, amount };
      if (cbuDestino) payload.cbuDestino = cbuDestino;
      const res = await apiFetch("/cards/visa/authorize", { method: "POST", body: JSON.stringify(payload) });
      document.getElementById("cardPayModal").classList.add("hidden");
      e.target.reset();
      payCardCBUVerificado = "";
      const preview = document.getElementById("payAliasPreview");
      if (preview) preview.textContent = "";
      showToast(`Pago aprobado · Auth: ${res.authorizationCode} · Nuevo saldo: $${Number(res.newBalance).toLocaleString("es-AR")}`, 5000, "success");
      await loadSaldo();
      await cargarHistorialTarjeta(tarjetaActiva.id);
    } catch (err) {
      showToast(err.message || "Pago rechazado", 4000, "error");
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = "Confirmar pago"; }
    }
  });
});
