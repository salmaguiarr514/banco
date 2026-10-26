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

    // Polling: refrescar movimientos cada 45 s (solo BD local, sin Banco Central)
    setInterval(() => {
      if (loadMovimientosBtn) loadMovimientosBtn.click();
    }, 45 * 1000);

    // Polling de sincronización con Banco Central cada 5 min
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
    }, 5 * 60 * 1000);
  }

  // ── Avatar ──
  const avatarInput = document.getElementById("avatarInput");
  const avatarImg   = document.getElementById("avatarImg");
  const avatarIcon  = document.getElementById("avatarIcon");
  const avatarKey   = session?.user?.id ? `userAvatar_${session.user.id}` : null;

  const applyAvatar = (dataUrl) => {
    [avatarImg, document.getElementById("avatarImgDrop")].forEach(img => {
      if (!img) return;
      img.src = dataUrl;
      img.classList.remove("hidden");
    });
    avatarIcon?.classList.add("hidden");
    document.getElementById("avatarInitialsDrop")?.classList.add("hidden");
  };

  // Foto del celular (varios MB) → recorte cuadrado 256px JPEG para que entre en localStorage
  const resizeAvatar = (file) => new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const side = Math.min(img.naturalWidth, img.naturalHeight);
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 256;
      canvas.getContext("2d").drawImage(
        img,
        (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side,
        0, 0, 256, 256
      );
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Imagen inválida")); };
    img.src = url;
  });

  const savedAvatar = avatarKey ? localStorage.getItem(avatarKey) : null;
  if (savedAvatar) applyAvatar(savedAvatar);

  avatarInput?.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    try {
      const dataUrl = await resizeAvatar(file);
      applyAvatar(dataUrl);
      if (avatarKey) localStorage.setItem(avatarKey, dataUrl);
      if (typeof showToast === "function") showToast("Foto de perfil actualizada", 2500, "success");
    } catch {
      if (typeof showToast === "function") showToast("No se pudo cargar la imagen", 3500, "error");
    }
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

  // ── User dropdown: toggle por click (necesario en mobile donde no hay hover) ──
  const _userMenu    = document.querySelector(".user-menu");
  const _userTrigger = document.querySelector(".user-trigger");
  if (_userMenu && _userTrigger) {
    _userTrigger.addEventListener("click", (e) => {
      // No propagar si tocaron directamente la cámara (por si acaso en desktop)
      if (e.target.closest(".avatar-edit-btn")) return;
      _userMenu.classList.toggle("open");
    });
    // Cerrar al hacer click fuera
    document.addEventListener("click", (e) => {
      if (!_userMenu.contains(e.target)) _userMenu.classList.remove("open");
    });
  }
});
