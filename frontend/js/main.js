document.addEventListener("DOMContentLoaded", async () => {
  // ── Verificación de seguridad ──
  const isAuthPage = window.location.href.includes("login.html") ||
    window.location.href.includes("index.html") ||
    window.location.pathname === "/";

  const { data: { session } } = await _supabase.auth.getSession();

  if (!session && !isAuthPage && window.location.href.includes("dashboard.html")) {
    window.location.href = "login.html";
    return;
  }

  // ── Page loader ──
  const pageLoaderEl = document.getElementById("pageLoader");
  if (pageLoaderEl && (!session || isAuthPage)) {
    pageLoaderEl.style.display = "none";
  }

  // ── Splash de bienvenida ──
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

  // ── Mercado (solo en dashboard, con polling) ──
  if (typeof loadMercado === "function") {
    loadMercado();
    setInterval(loadMercado, 5 * 60 * 1000);
  }

  // ── Carga inicial (solo en dashboard con sesión) ──
  if (session && !isAuthPage) {
    if (typeof loadBanks  === "function") loadBanks();
    if (typeof loadSaldo  === "function") loadSaldo().finally(() => {
      const loader = document.getElementById("pageLoader");
      if (loader) {
        loader.classList.add("fade-out");
        setTimeout(() => { loader.style.display = "none"; }, 380);
      }
    });
    if (loadMovimientosBtn) loadMovimientosBtn.click();

    // Polling automático cada 15 min para no perder transferencias
    setInterval(async () => {
      try {
        const data = await apiFetch("/transferencias/sincronizar");
        if (data.transferenciasRecibidas > 0) {
          await loadSaldo();
          if (loadMovimientosBtn) loadMovimientosBtn.click();
          const n = data.transferenciasRecibidas;
          showToast(`${n} transferencia${n > 1 ? "s" : ""} recibida${n > 1 ? "s" : ""}`);
        }
      } catch {}
    }, 15 * 60 * 1000);
  }

  // ── Avatar ──
  const avatarInput = document.getElementById("avatarInput");
  const avatarImg   = document.getElementById("avatarImg");
  const avatarIcon  = document.getElementById("avatarIcon");
  const avatarKey   = session?.user?.id ? `userAvatar_${session.user.id}` : null;
  const savedAvatar = avatarKey ? localStorage.getItem(avatarKey) : null;
  if (savedAvatar && avatarImg) {
    avatarImg.src = savedAvatar;
    avatarImg.classList.remove("hidden");
    if (avatarIcon) avatarIcon.classList.add("hidden");
  }
  avatarInput?.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target.result;
      if (avatarKey) localStorage.setItem(avatarKey, dataUrl);
      if (avatarImg) { avatarImg.src = dataUrl; avatarImg.classList.remove("hidden"); }
      if (avatarIcon) avatarIcon.classList.add("hidden");
    };
    reader.readAsDataURL(file);
  });

  // ── Navegación sidebar ──
  const _navItems    = document.querySelectorAll(".sidebar-nav-item");
  const _navSections = document.querySelectorAll(".content-section");

  _navItems.forEach(btn => {
    btn.addEventListener("click", () => {
      const targetId = "section-" + btn.dataset.section;
      _navItems.forEach(b => { b.classList.remove("active"); b.setAttribute("aria-selected", "false"); });
      btn.classList.add("active");
      btn.setAttribute("aria-selected", "true");
      _navSections.forEach(s => s.classList.remove("active"));
      document.getElementById(targetId)?.classList.add("active");
      document.querySelector(".content-area")?.scrollTo({ top: 0, behavior: "smooth" });
    });
  });

  // ── Mora banner → ir a préstamos ──
  document.querySelector(".mora-banner-cta")?.addEventListener("click", (e) => {
    e.preventDefault();
    document.querySelector("[data-section=\"prestamos\"]")?.click();
  });
});
