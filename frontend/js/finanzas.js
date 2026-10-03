document.addEventListener("DOMContentLoaded", async () => {
  const { data: { session } } = await _supabase.auth.getSession();

  // ── Gastos por categoría ──
  const loadGastosBtn = document.getElementById("loadGastosBtn");
  let gastosChart = null;

  const cargarGastos = async () => {
    try {
      const data = await apiFetch("/auth/gastos-categoria");
      const categorias = (data.categorias || []).filter(c => c.monto > 0);
      const canvas = document.getElementById("gastosChart");
      if (!canvas) return;
      const wrap = canvas.parentElement;

      if (categorias.length === 0) {
        if (gastosChart) { gastosChart.destroy(); gastosChart = null; }
        canvas.style.display = "none";
        let emp = wrap.querySelector(".gastos-empty");
        if (!emp) {
          emp = document.createElement("div");
          emp.className = "gastos-empty";
          emp.innerHTML = `<i class="fas fa-chart-pie"></i><p>Aún no tenés gastos registrados este mes</p>`;
          wrap.appendChild(emp);
        }
        emp.style.display = "flex";
        return;
      }

      // Hay datos: ocultar empty state y mostrar chart
      const emp = wrap.querySelector(".gastos-empty");
      if (emp) emp.style.display = "none";
      canvas.style.display = "";

      const ctx = canvas.getContext("2d");
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
    } catch {}
  };
  if (session) cargarGastos();

  loadGastosBtn?.addEventListener("click", () => {
    loadGastosBtn.classList.add("is-spinning");
    loadGastosBtn.addEventListener("animationend", () => loadGastosBtn.classList.remove("is-spinning"), { once: true });
    btnLoad(loadGastosBtn, true);
    cargarGastos().finally(() => btnLoad(loadGastosBtn, false));
  });

  // ── Tabs ARS / USD ──
  document.getElementById("tabARS")?.addEventListener("click", mostrarHeroARS);
  document.getElementById("tabUSD")?.addEventListener("click", mostrarHeroUSD);

  // ── Toggle actividad colapsable ──
  document.getElementById("actividadToggle")?.addEventListener("click", () => {
    const btn  = document.getElementById("actividadToggle");
    const body = document.getElementById("actividadBody");
    const expanded = btn.getAttribute("aria-expanded") === "true";
    btn.setAttribute("aria-expanded", String(!expanded));
    body.classList.toggle("hidden", expanded);
    if (!expanded && loadMovimientosBtn) loadMovimientosBtn.click();
  });

  // ── Ocultar/mostrar saldo USD ──
  document.getElementById("toggleBalanceUSD")?.addEventListener("click", () => {
    const el    = document.getElementById("usdDisplayBalance");
    const icon  = document.getElementById("balanceIconUSD");
    const equiv = document.getElementById("usdEquivalente");
    if (!el) return;
    const oculto = el.textContent === "**********";
    if (oculto) {
      const saldo = Number(el.dataset.value || 0);
      el.textContent = saldo.toLocaleString("es-AR", { minimumFractionDigits: 2 });
      if (equiv) equiv.style.visibility = "visible";
      if (icon)  icon.className = "fas fa-eye";
    } else {
      el.dataset.value = el.dataset.value || el.textContent.replace(/\./g, "").replace(",", ".");
      el.textContent = "**********";
      if (equiv) equiv.style.visibility = "hidden";
      if (icon)  icon.className = "fas fa-eye-slash";
    }
  });

  // ── Modal abrir USD ──
  document.getElementById("usdAbrirConfirm")?.addEventListener("click", _confirmarAbrirUSD);
  document.getElementById("usdAbrirClose")?.addEventListener("click",  () => document.getElementById("usdAbrirModal")?.classList.add("hidden"));
  document.getElementById("usdAbrirCancel")?.addEventListener("click", () => document.getElementById("usdAbrirModal")?.classList.add("hidden"));
  document.getElementById("usdAbrirModal")?.addEventListener("click", e => {
    if (e.target === document.getElementById("usdAbrirModal")) document.getElementById("usdAbrirModal").classList.add("hidden");
  });

  // ── Modal cambio alias USD ──
  const _usdAliasModal   = document.getElementById("usdAliasModal");
  const _usdAliasInput   = document.getElementById("usdAliasInput");
  const _usdAliasConfirm = document.getElementById("usdAliasConfirm");
  const _usdAliasError   = document.getElementById("usdAliasError");
  const _closeUsdAlias   = () => {
    _usdAliasModal?.classList.add("hidden");
    if (_usdAliasInput)   _usdAliasInput.value = "";
    if (_usdAliasError)   _usdAliasError.style.display = "none";
    if (_usdAliasConfirm) _usdAliasConfirm.disabled = true;
  };

  document.getElementById("btnEditAliasUSD")?.addEventListener("click", () => {
    _usdAliasModal?.classList.remove("hidden");
    setTimeout(() => _usdAliasInput?.focus(), 50);
  });
  document.getElementById("usdAliasClose")?.addEventListener("click", _closeUsdAlias);
  _usdAliasModal?.addEventListener("click", e => { if (e.target === _usdAliasModal) _closeUsdAlias(); });

  _usdAliasInput?.addEventListener("input", () => {
    const v = _usdAliasInput.value.trim();
    if (_usdAliasConfirm) _usdAliasConfirm.disabled = v.length < 3;
    if (_usdAliasError)   _usdAliasError.style.display = "none";
  });

  _usdAliasConfirm?.addEventListener("click", async () => {
    const alias = _usdAliasInput?.value.trim();
    if (!alias) return;
    btnLoad(_usdAliasConfirm, true);
    if (_usdAliasError) _usdAliasError.style.display = "none";
    try {
      await apiFetch("/cuentas/alias-usd", { method: "PUT", body: JSON.stringify({ alias }) });
      _closeUsdAlias();
      showToast("Alias USD actualizado", 3000, "success");
      await loadSaldo();
    } catch (e) {
      showToast(e.message || "Error al cambiar alias", 4000, "error");
    } finally {
      btnLoad(_usdAliasConfirm, false);
    }
  });

  // ── Cerrar modales USD convert / transfer ──
  document.getElementById("usdConvertClose")?.addEventListener("click", () => document.getElementById("usdConvertModal")?.classList.add("hidden"));
  document.getElementById("usdConvertModal")?.addEventListener("click", e => {
    if (e.target === document.getElementById("usdConvertModal")) document.getElementById("usdConvertModal").classList.add("hidden");
  });
  document.getElementById("usdTransferClose")?.addEventListener("click", () => document.getElementById("usdTransferModal")?.classList.add("hidden"));
  document.getElementById("usdTransferModal")?.addEventListener("click", e => {
    if (e.target === document.getElementById("usdTransferModal")) document.getElementById("usdTransferModal").classList.add("hidden");
  });
});
