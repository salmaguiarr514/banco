// ── Módulo scope: funciones accesibles desde otros módulos (ej. qr.js) ──
const openTransferModal = () => {
  document.getElementById("transferModal")?.classList.remove("hidden");
  document.getElementById("transferStep1")?.classList.remove("hidden");
  document.getElementById("transferStep2")?.classList.add("hidden");
  const cbuInput = document.getElementById("cbuDestino");
  if (cbuInput) { cbuInput.value = ""; setTimeout(() => cbuInput.focus(), 100); }
  const ri = document.getElementById("receptorInfo");
  if (ri) ri.textContent = "";
  destinatarioValidado = null;
  cbuDestinoVerificado = "";
  renderContacts();
};

const closeTransferModal = () => {
  document.getElementById("transferModal")?.classList.add("hidden");
};

const toggleOperation = (type) => {
  const formsContainer = document.getElementById("operationFormsContainer");
  const transferArea   = document.getElementById("transferArea");
  const depositArea    = document.getElementById("depositArea");
  if (!formsContainer) return;
  const isTransfer  = type === "transfer";
  const targetArea  = isTransfer ? transferArea : depositArea;
  const otherArea   = isTransfer ? depositArea  : transferArea;
  if (!targetArea) return;
  if (targetArea.classList.contains("hidden")) {
    formsContainer.classList.remove("hidden");
    targetArea.classList.remove("hidden");
    otherArea?.classList.add("hidden");
    targetArea.scrollIntoView({ behavior: "smooth" });
  } else {
    formsContainer.classList.add("hidden");
    targetArea.classList.add("hidden");
  }
};

document.addEventListener("DOMContentLoaded", async () => {
  // Verificación CBU en tiempo real
  const cbuDestinoInput = document.getElementById("cbuDestino");
  const receptorInfo    = document.getElementById("receptorInfo");

  if (cbuDestinoInput && receptorInfo) {
    cbuDestinoInput.addEventListener("input", debounce(async () => {
      const valor = cbuDestinoInput.value.trim();
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
        } catch {
          receptorInfo.textContent = "CBU no encontrado";
          receptorInfo.style.color = "#d32f2f";
        }
      } else if (valor.length >= 4 && !/^\d+$/.test(valor)) {
        cbuDestinoVerificado = "";
        destinatarioValidado = null;
        try {
          const persona = await apiFetch(`/transferencias/alias/${encodeURIComponent(valor.trim())}`);
          receptorInfo.textContent = `${persona.nombre} ${persona.apellido}`;
          receptorInfo.style.color = "#059669";
          cbuDestinoVerificado = persona.cbu;
          destinatarioValidado = persona;
          setTimeout(() => selectRecipient(persona), 500);
        } catch (error) {
          const msg = error.message?.includes("404") || error.message?.toLowerCase().includes("no encontrado")
            ? "Alias no encontrado" : error.message || "Error al buscar alias";
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

  // Transfer form submit
  if (transferForm) {
    transferForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!cuentaActiva) {
        showToast("No se pudo identificar tu cuenta. Recargá la página.", 4000, "error");
        return;
      }
      const monto = Number(document.getElementById("monto").value);
      if (isNaN(monto) || monto <= 0) { showToast("Ingresá un monto válido mayor a cero.", 3500, "error"); return; }
      if (monto > saldoActual) { showToast("Saldo insuficiente para realizar esta transferencia.", 4000, "error"); return; }
      const cbuDest = cbuDestinoVerificado || document.getElementById("cbuDestino").value;
      const receptorNombre = destinatarioValidado ? `${destinatarioValidado.nombre} ${destinatarioValidado.apellido}` : cbuDest;
      const receptorDni    = destinatarioValidado?.dni || "No disponible";
      const receptorBanco  = destinatarioValidado?.bankName || "Entidad Externa";
      try {
        formLoad(transferForm, true);
        const data = await apiFetch("/transferencias", {
          method: "POST",
          body: JSON.stringify({
            cuentaOrigenId: cuentaActiva.id,
            cbuDestino: cbuDest,
            monto,
            concepto: document.getElementById("concepto").value,
          }),
        });
        const user  = JSON.parse(localStorage.getItem("user") || "{}");
        const ahora = new Date();
        document.getElementById("receiptAmount").textContent = `$ ${monto.toLocaleString("es-AR")}`;
        document.getElementById("receiptDateTime").textContent = ahora.toLocaleDateString("es-AR", { weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });
        document.getElementById("receiptFromInfo").innerHTML = `<b>${user.nombre} ${user.apellido}</b><br>DNI: ${user.dni || "No disponible"}<br>Banco: Nodo<br>CBU: ${cuentaActiva.cbu}`;
        document.getElementById("receiptToInfo").innerHTML   = `<b>${receptorNombre}</b><br>DNI: ${receptorDni}<br>Banco: ${receptorBanco}<br>CBU: ${cbuDest}`;
        document.getElementById("receiptModal").classList.remove("hidden");
        if (destinatarioValidado) addReciente(destinatarioValidado);
        cbuDestinoVerificado = "";
        destinatarioValidado = null;
        transferForm.reset();
        if (receptorInfo) receptorInfo.textContent = "";
        closeTransferModal();
        loadSaldo();
        if (loadMovimientosBtn) loadMovimientosBtn.click();
        if (typeof setOutput === "function") setOutput(data);
      } catch (error) {
        showToast(error.message || "No se pudo realizar la transferencia", 4500, "error");
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
      if (!cuentaActiva) return void showToast("No se pudo identificar tu cuenta.", 4000, "error");
      const monto = Number(document.getElementById("depositMonto").value);
      if (isNaN(monto) || monto <= 0) return void showToast("Ingresá un monto válido mayor a cero.", 3500, "error");
      formLoad(depositForm, true);
      try {
        const data = await apiFetch("/cuentas/depositar", {
          method: "POST",
          body: JSON.stringify({ cuenta_id: cuentaActiva.id, monto }),
        });
        if (typeof setOutput === "function") setOutput(data);
        loadSaldo();
        depositForm.reset();
        document.getElementById("depositArea")?.classList.add("hidden");
        document.getElementById("operationFormsContainer")?.classList.add("hidden");
        showToast(`Depósito de $${monto.toLocaleString("es-AR")} acreditado`, 4000, "success");
      } catch (error) {
        showToast(error.message || "Error al realizar el depósito", 4000, "error");
      } finally {
        formLoad(depositForm, false);
      }
    });
  }

  // Sincronizar
  const syncBtn = document.getElementById("syncBtn");
  if (syncBtn) {
    syncBtn.addEventListener("click", async () => {
      try {
        syncBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sincronizando...';
        const data = await apiFetch("/transferencias/sincronizar");
        await loadSaldo();
        if (loadMovimientosBtn) loadMovimientosBtn.click();
        const n = data.transferenciasRecibidas;
        if (n > 0) showToast(`${n} transferencia${n > 1 ? "s" : ""} recibida${n > 1 ? "s" : ""}`, 5000, "success");
        else showToast("Sin transferencias nuevas", 3000, "info");
      } catch {
        showToast("Error al sincronizar", 4000, "error");
      } finally {
        syncBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Sincronizar';
      }
    });
  }

  // Atajos y modal transfer
  document.getElementById("btn-transfer-shortcut")?.addEventListener("click", openTransferModal);
  document.getElementById("btn-deposit-shortcut")?.addEventListener("click", () => toggleOperation("deposit"));
  document.getElementById("closeTransferModal")?.addEventListener("click", closeTransferModal);
  document.getElementById("closeTransferModal2")?.addEventListener("click", closeTransferModal);
  document.getElementById("transferModal")?.addEventListener("click", e => {
    if (e.target === document.getElementById("transferModal")) closeTransferModal();
  });

  // Volver al paso 1
  document.getElementById("backToStep1Btn")?.addEventListener("click", () => {
    destinatarioValidado = null;
    cbuDestinoVerificado = "";
    document.getElementById("transferStep1")?.classList.remove("hidden");
    document.getElementById("transferStep2")?.classList.add("hidden");
    renderContacts();
  });

  // Toggle saldo ARS
  document.getElementById("toggleBalance")?.addEventListener("click", () => {
    saldoOculto = !saldoOculto;
    actualizarDisplaySaldo();
  });
});
