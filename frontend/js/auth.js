// ── Indicador de perfil incompleto (módulo scope — usada también en perfil.js) ──
const actualizarIndicadorPerfil = () => {
  const u = JSON.parse(localStorage.getItem("user") || "{}");
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
  const dropdown = document.querySelector(".user-dropdown");
  if (dropdown) {
    let banner = dropdown.querySelector(".perfil-banner");
    if (incompleto && !banner) {
      banner = document.createElement("div");
      banner.className = "perfil-banner";
      banner.innerHTML = `<i class="fas fa-circle-info"></i><span>Completá tu perfil agregando teléfono y dirección para tener tu cuenta al día.</span>`;
      dropdown.insertAdjacentElement("afterbegin", banner);
    } else if (!incompleto && banner) {
      banner.remove();
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
        showToast(error.message || "Credenciales incorrectas", 4000, "error");
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
  if (loadMovimientosBtn) {
    loadMovimientosBtn.addEventListener("click", async () => {
      btnLoad(loadMovimientosBtn, true);
      try {
        movimientosList.innerHTML = '<div class="loader">Cargando movimientos...</div>';
        const movimientos = await apiFetch("/movimientos");
        renderHeroMovimientos(movimientos);
        if (movimientosList) {
          if (movimientos.length === 0) {
            movimientosList.innerHTML = '<li class="muted" style="text-align:center;padding:20px;">No hay movimientos recientes</li>';
            return;
          }
          movimientosList.innerHTML = movimientos.map(mov => {
            const isIngreso = mov.tipo === "credito" || mov.tipo === "deposito" || mov.tipo === "transferencia_recibida";
            const icon   = isIngreso ? "fa-plus" : "fa-minus";
            const iconBg = isIngreso ? "amount-positive" : "muted";
            const bankBadge = mov.banco_nombre ? `<span class="mov-bank-badge">${mov.banco_nombre}</span>` : "";
            return `
              <li class="movement-item">
                <div class="mov-info">
                  <div class="mov-icon ${iconBg}"><i class="fas ${icon}"></i></div>
                  <div class="mov-text">
                    <b>${mov.descripcion || "Operación Nodo"}</b>
                    <span>${new Date(mov.fecha_movimiento).toLocaleDateString()}${bankBadge}</span>
                  </div>
                </div>
                <div class="mov-amount ${isIngreso ? "amount-positive" : ""}">${isIngreso ? "+" : ""}$${Math.abs(mov.monto).toLocaleString()}</div>
              </li>`;
          }).join("");
        }
        if (typeof setOutput === "function") setOutput(movimientos);
      } catch (error) {
        if (typeof setOutput === "function") setOutput(error.message);
      } finally {
        btnLoad(loadMovimientosBtn, false);
      }
    });
  }

  // Logout
  if (logoutBtn) logoutBtn.addEventListener("click", cerrarSesion);

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
