// ── Indicador de perfil (módulo scope — usada también en perfil.js) ──
const actualizarIndicadorPerfil = () => {
  const u = JSON.parse(localStorage.getItem("user") || "{}");

  // Calcular completitud
  const campos = ["nombre", "apellido", "telefono", "direccion", "email"];
  const rellenos = campos.filter(c => u[c] && String(u[c]).trim()).length;
  const pct = Math.round((rellenos / campos.length) * 100);

  // Iniciales en el dropdown
  const initials = [u.nombre, u.apellido].filter(Boolean).map(s => s[0].toUpperCase()).join("") || "?";
  const initialsEl = document.getElementById("avatarInitialsDrop");
  if (initialsEl) initialsEl.textContent = initials;

  // Saludo: primer nombre
  const firstNameEl = document.getElementById("udropFirstName");
  if (firstNameEl && u.nombre) firstNameEl.textContent = u.nombre;

  // Nombre completo, email y alias en la sección de info
  const fullNameEl = document.getElementById("udropFullName");
  if (fullNameEl) fullNameEl.textContent = `${u.nombre || ""} ${u.apellido || ""}`.trim() || "—";
  const emailEl = document.getElementById("udropEmail");
  if (emailEl) emailEl.textContent = u.email || "—";

  // Alias: intentar desde displayAlias (cargado por saldo.js)
  const aliasDisplay = document.getElementById("displayAlias");
  const aliasVal = aliasDisplay?.dataset.value || aliasDisplay?.textContent || "";
  const aliasValEl = document.getElementById("udropAliasVal");
  if (aliasValEl) aliasValEl.textContent = aliasVal || "—";

  // Compatibilidad: udropName (hidden)
  const nameEl = document.getElementById("udropName");
  if (nameEl && u.nombre) nameEl.textContent = `${u.nombre} ${u.apellido || ""}`.trim();

  // Barra de progreso
  const pctEl  = document.getElementById("udropPct");
  const fillEl = document.getElementById("udropFill");
  if (pctEl)  pctEl.textContent  = `${pct}%`;
  if (fillEl) fillEl.style.width = `${pct}%`;

  // Foto de avatar en dropdown (si existe)
  const imgDrop = document.getElementById("avatarImgDrop");
  const imgMain = document.getElementById("avatarImg");
  if (imgDrop && imgMain && !imgMain.classList.contains("hidden")) {
    imgDrop.src = imgMain.src;
    imgDrop.classList.remove("hidden");
    if (initialsEl) initialsEl.classList.add("hidden");
  }

  // Notificación si perfil incompleto
  const incompleto = !u.telefono || !u.direccion;
  document.getElementById("loadPerfilBtn")?.classList.toggle("has-notification", incompleto);
  const avatarWrapper = document.querySelector(".avatar-wrapper");
  if (avatarWrapper) {
    let dot = avatarWrapper.querySelector(".avatar-notify-dot");
    if (incompleto && !dot) {
      dot = document.createElement("span");
      dot.className = "avatar-notify-dot";
      avatarWrapper.appendChild(dot);
    } else if (!incompleto && dot) {
      dot.remove();
    }
  }
};

document.addEventListener("DOMContentLoaded", async () => {
  // Tabs login / registro
  if (tabs?.length && loginForm && registerForm) {
    tabs.forEach(tab => {
      tab.addEventListener("click", () => {
        tabs.forEach(item => item.classList.remove("active"));
        tab.classList.add("active");
        const target = tab.dataset.target;
        loginForm.classList.toggle("hidden", target !== "login");
        registerForm.classList.toggle("hidden", target !== "register");
      });
    });
  }

  // Login form
  if (loginForm) {
    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      formLoad(loginForm, true);
      try {
        const data = await apiFetch("/auth/login", {
          method: "POST",
          body: JSON.stringify({
            email: document.getElementById("loginEmail").value,
            password: document.getElementById("loginPassword").value,
          }),
        });
        localStorage.setItem("user", JSON.stringify(data.user));
        if (data.session) await _supabase.auth.setSession(data.session);
        if (typeof setOutput === "function") setOutput(data);
        sessionStorage.setItem("justLoggedIn", "1");
        window.location.href = "dashboard.html";
      } catch (error) {
        const isInvalidCreds = /invalid login credentials|credenciales inv[aá]lidas|email no confirmado/i.test(error.message || "");
        const msg = isInvalidCreds ? "Contraseña o correo inválidos" : (error.message || "Credenciales incorrectas");
        showToast(msg, 4000, "error");
        formLoad(loginForm, false);
      }
    });
  }

  // Register form
  if (registerForm) {
    registerForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      formLoad(registerForm, true);
      try {
        const data = await apiFetch("/auth/register", {
          method: "POST",
          body: JSON.stringify({
            nombre: document.getElementById("registerNombre").value,
            apellido: document.getElementById("registerApellido").value,
            dni: document.getElementById("registerDni").value,
            email: document.getElementById("registerEmail").value,
            password: document.getElementById("registerPassword").value,
          }),
        });
        localStorage.setItem("user", JSON.stringify(data.user));
        if (data.session) await _supabase.auth.setSession(data.session);
        sessionStorage.setItem("justLoggedIn", "1");
        window.location.href = "dashboard.html";
      } catch (error) {
        showToast(error.message || "Error en el registro", 4000, "error");
        formLoad(registerForm, false);
      }
    });
  }

  // Cargar movimientos
  // Íconos semánticos por tipo de movimiento
  const _movIconMap = (mov) => {
    const tipo = (mov.tipo || "").toLowerCase();
    const desc = (mov.descripcion || "").toLowerCase();
    if (/recarga/.test(desc))                                            return { icon: "fa-mobile-alt",    bg: "mov-bg-indigo" };
    if (/reserva/.test(desc))                                            return { icon: "fa-suitcase",       bg: "mov-bg-amber"  };
    if (/transferencia_recibida/.test(tipo) || /recibida/.test(desc))    return { icon: "fa-arrow-down",    bg: "mov-bg-green"  };
    if (/transferencia/.test(tipo) || /transferencia|enviada/.test(desc)) return { icon: "fa-paper-plane",  bg: "mov-bg-blue"   };
    if (/conversion_entrada/.test(tipo) || /conversion/.test(desc))      return { icon: "fa-exchange-alt",  bg: "mov-bg-teal"   };
    if (/deposito|credito/.test(tipo))                                   return { icon: "fa-circle-plus",   bg: "mov-bg-green"  };
    if (/compra|pago/.test(desc))                                        return { icon: "fa-credit-card",   bg: "mov-bg-rose"   };
    return { icon: "fa-minus", bg: "mov-bg-slate" };
  };

  const _renderMovRow = (mov, idx = 0) => {
    const isIngreso = mov.tipo === "credito" || mov.tipo === "deposito"
                   || mov.tipo === "transferencia_recibida" || mov.tipo === "conversion_entrada";
    const { icon, bg } = _movIconMap(mov);
    const monto  = Math.abs(mov.monto);
    const fecha  = new Date(mov.fecha_movimiento).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "2-digit" });
    const hora   = new Date(mov.fecha_movimiento).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
    const desc   = (mov.descripcion || "Operación Nodo").replace(/^(Depósito|Deposito) ficticio$/i, "Depósito");
    const bankBadge = mov.banco_nombre ? `<span class="mov-bank-badge">${mov.banco_nombre}</span>` : "";
    const filtroClass = isIngreso ? "mov-ingreso" : "mov-egreso";
    const delay = (idx * 0.07).toFixed(2);
    return `
      <li class="movement-item ${filtroClass} mov-animate" style="animation-delay:${delay}s" data-desc="${desc.toLowerCase()}" data-monto="${monto}">
        <div class="mov-info">
          <div class="mov-icon-wrap ${bg}"><i class="fas ${icon}"></i></div>
          <div class="mov-text">
            <span class="mov-desc">${desc}${bankBadge}</span>
            <span class="mov-date">${fecha} · ${hora}</span>
          </div>
        </div>
        <span class="mov-amount-v2 ${isIngreso ? "mov-amount-pos" : "mov-amount-neg"}">
          ${isIngreso ? "+" : "-"}${mov.moneda === 'USD' ? 'U$D' : '$'}${monto.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
        </span>
      </li>`;
  };

  let _movimientosCached = [];

  const _applyFilters = () => {
    const query  = (document.getElementById("actividadSearch")?.value || "").toLowerCase();
    const active = document.querySelector(".actividad-filter.active")?.dataset.filter || "todos";
    document.querySelectorAll("#movimientosList .movement-item").forEach(li => {
      const desc   = li.dataset.desc || "";
      const monto  = li.dataset.monto || "";
      const matchQ = !query || desc.includes(query) || monto.includes(query);
      const matchF = active === "todos"
        || (active === "ingresos" && li.classList.contains("mov-ingreso"))
        || (active === "egresos"  && li.classList.contains("mov-egreso"));
      li.style.display = matchQ && matchF ? "" : "none";
    });
  };

  document.getElementById("actividadSearch")?.addEventListener("input", _applyFilters);
  document.querySelectorAll(".actividad-filter").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".actividad-filter").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      _applyFilters();
    });
  });

  if (loadMovimientosBtn) {
    loadMovimientosBtn.addEventListener("click", async () => {
      const icon = loadMovimientosBtn.querySelector("i");
      icon?.classList.add("spinning");
      try {
        if (movimientosList) movimientosList.innerHTML = '<li class="mov-loading"><i class="fas fa-circle-notch fa-spin"></i> Cargando…</li>';
        const movimientos = await apiFetch("/movimientos");
        _movimientosCached = movimientos;
        renderHeroMovimientos(movimientos);
        if (movimientosList) {
          if (movimientos.length === 0) {
            movimientosList.innerHTML = '<li class="mov-empty">No hay movimientos recientes</li>';
            return;
          }
          movimientosList.innerHTML = movimientos.map((m, i) => _renderMovRow(m, i)).join("");
          _applyFilters();
        }
        if (typeof setOutput === "function") setOutput(movimientos);
      } catch (error) {
        if (typeof setOutput === "function") setOutput(error.message);
      } finally {
        setTimeout(() => icon?.classList.remove("spinning"), 600);
      }
    });
  }

  // Logout
  if (logoutBtn) logoutBtn.addEventListener("click", cerrarSesion);

  // Dropdown: Completar perfil
  document.getElementById("udropCompletarBtn")?.addEventListener("click", () => {
    document.getElementById("editPerfilBtn")?.click();
  });

  // Dropdown: Copiar alias
  document.getElementById("udropCopyAlias")?.addEventListener("click", () => {
    const alias = document.getElementById("udropAliasVal")?.textContent || "";
    if (alias && alias !== "—") {
      navigator.clipboard.writeText(alias)
        .then(() => showToast("Alias copiado", 2000, "success"))
        .catch(() => showToast("No se pudo copiar", 2500, "error"));
    }
  });

  // Dropdown: Cambiar alias (botón oculto de compatibilidad)
  document.getElementById("editAliasDrop")?.addEventListener("click", () => {
    document.getElementById("editAliasBtn")?.click();
  });

  // Dropdown: Editar alias inline (ícono de lápiz en fila de alias)
  document.getElementById("udropEditAliasInline")?.addEventListener("click", () => {
    document.getElementById("editAliasBtn")?.click();
  });

  // Theme toggle
  document.querySelectorAll(".btn-theme-toggle").forEach(btn => btn.addEventListener("click", toggleTheme));

  // Restore user session
  const savedUser = localStorage.getItem("user");
  if (savedUser) {
    const user = JSON.parse(savedUser);
    const userNameEl = document.getElementById("userName");
    if (userNameEl) userNameEl.textContent = `${user.nombre} ${user.apellido}`;
    const nombreCompleto = `${user.nombre} ${user.apellido || ""}`.toUpperCase().trim();
    const userCardName = document.getElementById("userCardName");
    if (userCardName) userCardName.textContent = nombreCompleto;
    const cardDataTitular = document.getElementById("cardDataTitular");
    if (cardDataTitular) cardDataTitular.textContent = nombreCompleto;
    actualizarIndicadorPerfil();
  }
});
