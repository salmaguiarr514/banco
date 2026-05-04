const API_URL = "http://localhost:3000/api";

const output = document.getElementById("output");
const welcome = document.getElementById("welcome");
const saldoList = document.getElementById("saldoList");
const movimientosList = document.getElementById("movimientosList");
const logoutBtn = document.getElementById("logoutBtn");

const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const transferForm = document.getElementById("transferForm");

const loadSaldoBtn = document.getElementById("loadSaldoBtn");
const loadMovimientosBtn = document.getElementById("loadMovimientosBtn");

// Global para manejo de saldo oculto
let saldoActual = 0;
let saldoOculto = true;

const tabs = document.querySelectorAll(".tab");

// Función para verificar si un elemento existe
const getElement = (id) => document.getElementById(id);

const setOutput = (data) => {
  if (output) {
    output.textContent = typeof data === "string" ? data : JSON.stringify(data, null, 2);
  } else if (typeof data === "string" || data.message) {
    console.error("Error de API:", data);
  }
};

const getToken = () => localStorage.getItem("token");

const getCuentaLabel = (cuenta) => cuenta.nombre_cuenta || `Cuenta ${cuenta.id || cuenta.numero_cuenta || ""}`.trim();

const getCuentaCbu = (cuenta) => cuenta.cbu || cuenta.CBU || "No disponible";

const renderCuentaSaldo = (cuenta) =>
  `<li>${getCuentaLabel(cuenta)} | CBU: ${getCuentaCbu(cuenta)} | Saldo: ${cuenta.saldo} ${cuenta.moneda}</li>`;

const actualizarDisplaySaldo = () => {
  const display = document.getElementById("displayBalance");
  const icon = document.getElementById("balanceIcon");
  if (display) {
    display.textContent = saldoOculto ? "**********" : saldoActual.toLocaleString('es-AR', { minimumFractionDigits: 2 });
  }
  if (icon) {
    icon.className = saldoOculto ? "fas fa-eye" : "fas fa-eye-slash";
  }
};

const loadSaldo = async () => {
  try {
    const cuentas = await apiFetch("/cuentas/saldo");
    if (saldoList) saldoList.innerHTML = cuentas.map(renderCuentaSaldo).join("");
    if (setOutput) setOutput(cuentas);
    
    if (cuentas.length > 0) {
      saldoActual = cuentas[0].saldo;
      actualizarDisplaySaldo();
    }
  } catch (error) {
    if (setOutput) setOutput(error.message);
  }
};

const apiFetch = async (endpoint, options = {}) => {
  const token = getToken();
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    // Si la respuesta es 401, el token no es válido o expiró
    if (response.status === 401) {
      cerrarSesion();
    }

    const detailParts = [data.message, data.error];

    if (data.details?.error) {
      detailParts.push(data.details.error);
    }

    throw new Error(detailParts.filter(Boolean).join(" | ") || "Error en la solicitud");
  }

  return data;
};

const cerrarSesion = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  
  if (welcome) welcome.textContent = "Sin sesion iniciada";
  if (saldoList) saldoList.innerHTML = "";
  if (movimientosList) movimientosList.innerHTML = "";
  if (setOutput) setOutput("Sesion cerrada");
  
  // Redirigir al login
  window.location.href = "login.html";
};

// Inicializar solo si los elementos existen
document.addEventListener("DOMContentLoaded", () => {
  // Verificación de seguridad inmediata
  const isAuthPage = window.location.href.includes("login.html") || window.location.href.includes("index.html") || window.location.pathname === "/";
  const token = getToken();

  if (!token && !isAuthPage && window.location.href.includes("dashboard.html")) {
    window.location.href = "login.html";
    return;
  }

  // Tabs
  if (tabs.length && loginForm && registerForm) {
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        tabs.forEach((item) => item.classList.remove("active"));
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

      try {
        const data = await apiFetch("/auth/login", {
          method: "POST",
          body: JSON.stringify({
            email: document.getElementById("loginEmail").value,
            password: document.getElementById("loginPassword").value,
          }),
        });

        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));
        
        // Mostrar mensaje de éxito
        if (setOutput) {
          setOutput(data);
        }
        
        // Redirigir al dashboard
        window.location.href = "dashboard.html";
      } catch (error) {
        if (setOutput) {
          setOutput(error.message);
        }
      }
    });
  }

  // Register form
  if (registerForm) {
    registerForm.addEventListener("submit", async (event) => {
      event.preventDefault();

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

        if (data.cuenta && saldoList) {
          saldoList.innerHTML = renderCuentaSaldo(data.cuenta);
        }

        // Guardamos el email registrado para facilitarle el login al usuario
        const registeredEmail = document.getElementById("registerEmail")?.value;

        // Limpiamos el formulario de registro y cambiamos a la pestaña de Login
        registerForm.reset();
        const loginTab = document.querySelector('.tab[data-target="login"]');
        
        if (loginTab) {
          loginTab.click(); // Esto activa la lógica de pestañas que ya tienes
          
          // Pre-completamos el campo de email en el formulario de Login
          const loginEmail = document.getElementById("loginEmail");
          if (loginEmail && registeredEmail) {
            loginEmail.value = registeredEmail;
          }
        }

        alert("¡Registro exitoso! Por favor, ingresá tu contraseña para continuar.");
        if (setOutput) setOutput("Usuario registrado: " + (data.user?.email || ""));
      } catch (error) {
        alert("Error en el registro: " + error.message);
        if (setOutput) setOutput(error.message);
      }
    });
  }

  // Load saldo button
  if (loadSaldoBtn) {
    loadSaldoBtn.addEventListener("click", async () => {
      try {
        const cuentas = await apiFetch("/cuentas/saldo");
        if (saldoList) saldoList.innerHTML = cuentas.map(renderCuentaSaldo).join("");
        if (setOutput) setOutput(cuentas);
      } catch (error) {
        if (setOutput) setOutput(error.message);
      }
    });
  }

  // Load movimientos button
  if (loadMovimientosBtn) {
    loadMovimientosBtn.addEventListener("click", async () => {
      try {
        const movimientos = await apiFetch("/movimientos");
        if (movimientosList) {
          movimientosList.innerHTML = movimientos
            .map((mov) => {
              const isIngreso = mov.tipo === 'credito' || mov.tipo === 'deposito';
              const icon = isIngreso ? 'fa-arrow-down' : 'fa-arrow-up';
              const sign = isIngreso ? '+' : '-';
              const colorClass = isIngreso ? 'amount-positive' : '';
              
              return `
                <li class="movement-item">
                  <div class="mov-info">
                    <div class="mov-icon"><i class="fas ${icon}"></i></div>
                    <div class="mov-text">
                      <b>${mov.descripcion || "Operación Nodo"}</b>
                      <span>${new Date(mov.fecha_movimiento).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div class="mov-amount ${colorClass}">${sign} $${mov.monto}</div>
                </li>
              `;
            })
            .join("");
        }
        if (setOutput) setOutput(movimientos);
      } catch (error) {
        if (setOutput) setOutput(error.message);
      }
    });
    // Cargar automáticamente al inicio solo si hay un token
    if (getToken()) {
      loadMovimientosBtn.click();
    }
  }

  // Logout button
  if (logoutBtn) {
    logoutBtn.addEventListener("click", cerrarSesion);
  }

  // Verificación de CBU en tiempo real
  const cbuDestinoInput = document.getElementById("cbuDestino");
  const receptorInfo = document.getElementById("receptorInfo");

  if (cbuDestinoInput && receptorInfo) {
    cbuDestinoInput.addEventListener("input", async () => {
      const cbu = cbuDestinoInput.value.trim();
      
      if (cbu.length === 22) {
        receptorInfo.textContent = "🔍 Verificando destinatario...";
        receptorInfo.style.color = "#666";
        
        try {
          const persona = await apiFetch(`/transferencias/buscar/${cbu}`);
          receptorInfo.textContent = `✅ Destinatario: ${persona.nombre} ${persona.apellido}`;
          receptorInfo.style.color = "#2e7d32";
        } catch (error) {
          receptorInfo.textContent = "❌ CBU no encontrado";
          receptorInfo.style.color = "#d32f2f";
        }
      } else {
        receptorInfo.textContent = "";
      }
    });
  }

  // Transfer form
  if (transferForm) {
    transferForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      try {
        const data = await apiFetch("/transferencias", {
          method: "POST",
          body: JSON.stringify({
            cuentaOrigenId: Number(document.getElementById("cuentaOrigenId").value),
            cbuDestino: document.getElementById("cbuDestino").value,
            monto: Number(document.getElementById("monto").value),
            concepto: document.getElementById("concepto").value,
          }),
        });

        alert("¡Transferencia realizada con éxito!");
        transferForm.reset();
        if (receptorInfo) receptorInfo.textContent = "";
        
        // Recargar datos de la interfaz
        loadSaldo();
        if (loadMovimientosBtn) loadMovimientosBtn.click();

        if (setOutput) setOutput(data);
      } catch (error) {
        alert("No se pudo realizar la transferencia: " + error.message);
        if (setOutput) setOutput("ERROR: " + error.message);
      }
    });
  }

  // Deposit form
  const depositForm = document.getElementById("depositForm");
  if (depositForm) {
    depositForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      try {
        const cuentaId = document.getElementById("depositCuenta")?.value;
        const monto = document.getElementById("depositMonto")?.value;

        if (!cuentaId || !monto) {
          if (setOutput) setOutput("Faltan datos: cuenta ID y monto");
          return;
        }

        const data = await apiFetch("/cuentas/depositar", {
          method: "POST",
          body: JSON.stringify({
            cuenta_id: Number(cuentaId),
            monto: Number(monto),
          }),
        });

        if (setOutput) setOutput(data);
        // Recargar saldo después del depósito
        loadSaldo();
      } catch (error) {
        if (setOutput) setOutput(error.message);
      }
    });
  }

  // Botón de Sincronización
  const syncBtn = document.getElementById("syncBtn");
  if (syncBtn) {
    syncBtn.addEventListener("click", async () => {
      try {
        syncBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sincronizando...';
        const data = await apiFetch("/transferencias/sincronizar");
        
        console.log("Resultado de sincronización:", data);
        
        // Recargar saldo y movimientos para ver los cambios
        await loadSaldo();
        if (loadMovimientosBtn) loadMovimientosBtn.click();
        
        if (data.transferenciasRecibidas > 0) {
          alert(`¡Éxito! Se encontraron ${data.transferenciasRecibidas} nuevas transferencias.`);
        } else {
          alert("Sincronización terminada: No se encontraron transferencias nuevas para tus cuentas.");
        }

      } catch (error) {
        if (setOutput) setOutput(error.message);
      } finally {
        syncBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Sincronizar';
      }
    });
  }

  // Restore user session
  const savedUser = localStorage.getItem("user");
  if (savedUser) {
    const user = JSON.parse(savedUser);
    // Si existe el elemento welcome (página original)
    if (welcome) {
      welcome.textContent = `Sesion iniciada: ${user.nombre} ${user.apellido}`;
    }
    // Si existe el elemento userName (dashboard)
    if (document.getElementById("userName")) {
      document.getElementById("userName").textContent = `${user.nombre} ${user.apellido}`;
    }
  }

  // Verificar si hay sesión activa al cargar la página
  // Si ya hay token pero estamos en login.html, redirigir al dashboard
  if (localStorage.getItem("token") && window.location.href.includes("login.html")) {
    window.location.href = "dashboard.html";
  }

  // ========== NUEVAS FUNCIONALIDADES ==========

  // Elementos del perfil
  const loadPerfilBtn = document.getElementById("loadPerfilBtn");
  const editPerfilBtn = document.getElementById("editPerfilBtn");
  const perfilForm = document.getElementById("perfilForm");
  const perfilData = document.getElementById("perfilData");
  const cancelPerfilBtn = document.getElementById("cancelPerfilBtn");
  const changePasswordBtn = document.getElementById("changePasswordBtn");
  const passwordForm = document.getElementById("passwordForm");
  const cancelPasswordBtn = document.getElementById("cancelPasswordBtn");
  const loadGastosBtn = document.getElementById("loadGastosBtn");

  // Cargar datos del perfil
  if (loadPerfilBtn) {
    loadPerfilBtn.addEventListener("click", async () => {
      try {
        // Obtener datos del usuario y cuenta
        const user = JSON.parse(localStorage.getItem("user") || "{}");
        const cuentas = await apiFetch("/cuentas/saldo");
        const cuenta = cuentas[0] || {};

        if (perfilData) {
          perfilData.innerHTML = `
            <p><strong>Nombre:</strong> ${user.nombre || ""} ${user.apellido || ""}</p>
            <p><strong>Email:</strong> ${user.email || ""}</p>
            <p><strong>Alias:</strong> ${cuenta.alias || "No disponible"}</p>
            <p><strong>CBU:</strong> ${cuenta.cbu || "No disponible"}</p>
          `;
        }

        // Mostrar botones de edición
        if (editPerfilBtn) editPerfilBtn.classList.remove("hidden");
        if (changePasswordBtn) changePasswordBtn.classList.remove("hidden");

        if (setOutput) setOutput({ user, cuenta });
      } catch (error) {
        if (setOutput) setOutput(error.message);
      }
    });
  }

  // Mostrar formulario de edición de perfil
  if (editPerfilBtn) {
    editPerfilBtn.addEventListener("click", () => {
      if (perfilForm) perfilForm.classList.remove("hidden");
      if (editPerfilBtn) editPerfilBtn.classList.add("hidden");
      if (changePasswordBtn) changePasswordBtn.classList.add("hidden");
    });
  }

  // Cancelar edición de perfil
  if (cancelPerfilBtn) {
    cancelPerfilBtn.addEventListener("click", () => {
      if (perfilForm) perfilForm.classList.add("hidden");
      if (editPerfilBtn) editPerfilBtn.classList.remove("hidden");
    });
  }

  // Guardar cambios del perfil
  if (perfilForm) {
    perfilForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      try {
        const data = await apiFetch("/auth/perfil", {
          method: "PUT",
          body: JSON.stringify({
            alias: document.getElementById("perfilAlias")?.value || undefined,
            nombre: document.getElementById("perfilNombre")?.value || undefined,
            apellido: document.getElementById("perfilApellido")?.value || undefined,
            telefono: document.getElementById("perfilTelefono")?.value || undefined,
            direccion: document.getElementById("perfilDireccion")?.value || undefined,
          }),
        });

        if (setOutput) setOutput(data);

        // Actualizar usuario en localStorage
        if (data.user) {
          localStorage.setItem("user", JSON.stringify(data.user));
        }

        // Ocultar formulario
        if (perfilForm) perfilForm.classList.add("hidden");
        if (editPerfilBtn) editPerfilBtn.classList.remove("hidden");

        // Recargar datos del perfil
        loadPerfilBtn.click();
      } catch (error) {
        if (setOutput) setOutput(error.message);
      }
    });
  }

  // Mostrar formulario de cambio de contraseña
  if (changePasswordBtn) {
    changePasswordBtn.addEventListener("click", () => {
      if (passwordForm) passwordForm.classList.remove("hidden");
      if (editPerfilBtn) editPerfilBtn.classList.add("hidden");
      if (changePasswordBtn) changePasswordBtn.classList.add("hidden");
    });
  }

  // Cancelar cambio de contraseña
  if (cancelPasswordBtn) {
    cancelPasswordBtn.addEventListener("click", () => {
      if (passwordForm) passwordForm.classList.add("hidden");
      if (editPerfilBtn) editPerfilBtn.classList.remove("hidden");
      if (changePasswordBtn) changePasswordBtn.classList.remove("hidden");
    });
  }

  // Guardar nueva contraseña
  if (passwordForm) {
    passwordForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      try {
        const data = await apiFetch("/auth/password", {
          method: "PUT",
          body: JSON.stringify({
            currentPassword: document.getElementById("currentPassword").value,
            newPassword: document.getElementById("newPassword").value,
          }),
        });

        if (setOutput) setOutput(data);

        // Limpiar formulario
        document.getElementById("currentPassword").value = "";
        document.getElementById("newPassword").value = "";

        // Ocultar formulario
        if (passwordForm) passwordForm.classList.add("hidden");
        if (editPerfilBtn) editPerfilBtn.classList.remove("hidden");
        if (changePasswordBtn) changePasswordBtn.classList.remove("hidden");
      } catch (error) {
        if (setOutput) setOutput(error.message);
      }
    });
  }

  // Gráfico de gastos por categoría
  let gastosChart = null;

  if (loadGastosBtn) {
    loadGastosBtn.addEventListener("click", async () => {
      try {
        const data = await apiFetch("/auth/gastos-categoria");

        if (setOutput) setOutput(data);

        // Crear o actualizar gráfico
        const ctx = document.getElementById("gastosChart").getContext("2d");

        if (gastosChart) {
          gastosChart.destroy();
        }

        const categorias = data.categorias || [];
        const labels = categorias.map(c => c.nombre);
        const valores = categorias.map(c => c.monto);

        gastosChart = new Chart(ctx, {
          type: "doughnut",
          data: {
            labels: labels,
            datasets: [{
              data: valores,
              backgroundColor: [
                "#FF6384", // Transporte - rojo
                "#36A2EB", // Comida - azul
                "#FFCE56"  // Otros - amarillo
              ],
              borderWidth: 2,
              borderColor: "#ffffff"
            }]
          },
          options: {
            responsive: true,
            plugins: {
              legend: {
                position: "bottom",
                labels: {
                  padding: 20,
                  font: {
                    size: 14
                  }
                }
              },
              tooltip: {
                callbacks: {
                  label: function(context) {
                    const value = context.raw;
                    return `${context.label}: $${value.toLocaleString()}`;
                  }
                }
              }
            }
          }
        });
      } catch (error) {
        if (setOutput) setOutput(error.message);
      }
    });
  }

  // ========== LÓGICA MERCADO PAGO STYLE ==========
  
  // Toggle Saldo
  const toggleBtn = document.getElementById("toggleBalance");
  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      saldoOculto = !saldoOculto;
      actualizarDisplaySaldo();
    });
  }

  // Lógica de IA (Mock)
  const aiToggle = document.getElementById("aiToggle");
  const aiWindow = document.getElementById("aiChatWindow");
  const aiClose = document.getElementById("aiClose");
  const aiSend = document.getElementById("aiSend");
  const aiQuery = document.getElementById("aiQuery");
  const aiMessages = document.getElementById("aiMessages");

  if (aiToggle) aiToggle.addEventListener("click", () => aiWindow.classList.toggle("hidden"));
  if (aiClose) aiClose.addEventListener("click", () => aiWindow.classList.add("hidden"));

  if (aiSend) {
    aiSend.addEventListener("click", () => {
      const text = aiQuery.value;
      if (!text) return;
      aiMessages.innerHTML += `<div class="msg user">${text}</div>`;
      aiQuery.value = "";
      
      setTimeout(() => {
        aiMessages.innerHTML += `<div class="msg bot">Estoy analizando tu consulta... Según tus últimos movimientos, has gastado un 15% más en comida este mes. ¿Querés que revisemos tu presupuesto?</div>`;
        aiMessages.scrollTop = aiMessages.scrollHeight;
      }, 1000);
    });
  }
  
  // Cargar saldo al iniciar solo si hay un token activo
  if (getToken()) {
    loadSaldo();
  }
});
