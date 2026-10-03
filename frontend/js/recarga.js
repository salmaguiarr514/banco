/**
 * ═══════════════════════════════════════════════════════════════════════
 * NODO — MÓDULO RECARGA CELULAR
 * Selección de operador, validación telefónica argentina (10 dígitos),
 * montos rápidos y personalizados, simulación de procesamiento (~800ms),
 * confirmación, descuento de saldo y registro en historial de movimientos.
 * ═══════════════════════════════════════════════════════════════════════
 */

// ── Estado interno de la recarga ──
let recargaOperador = null;
let recargaNumero = "";
let recargaMonto = 0;
let recargaComprobante = "";

// Configuración de operadores soportados con sus colores y estilos
const OPERADORES_CONFIG = {
  Movistar: {
    nombre: "Movistar",
    color: "#019DF4",
    bgAlpha: "rgba(1, 157, 244, 0.12)",
    badge: "M",
    icono: "fa-signal"
  },
  Personal: {
    nombre: "Personal",
    color: "#00A3E0",
    bgAlpha: "rgba(0, 163, 224, 0.12)",
    badge: "P",
    icono: "fa-wifi"
  },
  Claro: {
    nombre: "Claro",
    color: "#E02B20",
    bgAlpha: "rgba(224, 43, 32, 0.12)",
    badge: "C",
    icono: "fa-sun"
  },
  Tuenti: {
    nombre: "Tuenti",
    color: "#FF007A",
    bgAlpha: "rgba(255, 0, 122, 0.12)",
    badge: "T",
    icono: "fa-bolt"
  }
};

const SERVICIOS_CATEGORIAS = [
  { id: "telefonia", nombre: "Telefonía", icon: "fa-phone", descripcion: "Móvil y hogar", proveedores: [
    { id: "movistar-linea", nombre: "Movistar Línea Móvil", detalle: "Prepago y recarga", icon: "fa-mobile-alt" },
    { id: "movistar-hogar", nombre: "Movistar Hogar", detalle: "Internet + TV", icon: "fa-house-signal" },
    { id: "personal", nombre: "Personal", detalle: "Teléfono y servicio", icon: "fa-wifi" },
    { id: "telecentro", nombre: "Telecentro", detalle: "Internet y telefonía", icon: "fa-network-wired" },
    { id: "directv", nombre: "DirecTV", detalle: "Cable + señal", icon: "fa-satellite-dish" },
    { id: "supercanal", nombre: "Supercanal", detalle: "TV por cable", icon: "fa-tv" }
  ] },
  { id: "impuestos", nombre: "Impuestos y Municipalidades", icon: "fa-landmark", descripcion: "ARCA y recaudación", proveedores: [
    { id: "arca", nombre: "ARCA", detalle: "Impuesto y deuda", icon: "fa-file-invoice" },
    { id: "agip-abl", nombre: "AGIP ABL", detalle: "Alicuotas y tasas", icon: "fa-building-columns" },
    { id: "agip-patente", nombre: "AGIP Patente", detalle: "Patente y habilitaciones", icon: "fa-building" },
    { id: "epagos", nombre: "ePagos", detalle: "Pagos y comprobantes", icon: "fa-wallet" },
    { id: "agencia-recaudacion", nombre: "Agencia de Recaudación", detalle: "Cobros municipales", icon: "fa-city" },
    { id: "rentas-tucuman", nombre: "Rentas de Tucumán", detalle: "Tributos provinciales", icon: "fa-user-shield" }
  ] },
  { id: "luz", nombre: "Luz", icon: "fa-bolt", descripcion: "Energía y servicios", proveedores: [
    { id: "edesur", nombre: "Edesur", detalle: "Electricidad", icon: "fa-bolt" },
    { id: "edenor", nombre: "Edenor", detalle: "Servicio eléctrico", icon: "fa-lightbulb" },
    { id: "epe-santa-fe", nombre: "EPE Santa Fe", detalle: "Energía provincial", icon: "fa-plug-circle-bolt" },
    { id: "edesal", nombre: "Edesal", detalle: "Electricidad", icon: "fa-battery-three-quarters" },
    { id: "epec", nombre: "EPEC", detalle: "Energía y distribución", icon: "fa-charging-station" },
    { id: "eden-online", nombre: "EDEN Online", detalle: "Pagos digitales", icon: "fa-globe" }
  ] },
  { id: "suscripciones", nombre: "Suscripciones", icon: "fa-play", descripcion: "Streaming y apps", proveedores: [
    { id: "netflix", nombre: "Netflix", detalle: "Plan mensual", icon: "fa-film" },
    { id: "spotify", nombre: "Spotify", detalle: "Premium", icon: "fa-music" },
    { id: "disney", nombre: "Disney+", detalle: "Contenido familiar", icon: "fa-star" },
    { id: "youtube-premium", nombre: "YouTube Premium", detalle: "Ad-free", icon: "fa-youtube" },
    { id: "hbo-max", nombre: "HBO Max", detalle: "Series y cine", icon: "fa-clapperboard" },
    { id: "google-one", nombre: "Google One", detalle: "Almacenamiento y backups", icon: "fa-google" }
  ] },
  { id: "seguros", nombre: "Seguros y Garantías", icon: "fa-shield-alt", descripcion: "Coberturas y seguros", proveedores: [
    { id: "federacion-patronal", nombre: "Federación Patronal", detalle: "Seguro patronal", icon: "fa-shield-heart" },
    { id: "rivadavia", nombre: "Rivadavia Seguros", detalle: "Cobertura general", icon: "fa-shield-virus" },
    { id: "mercantil-andina", nombre: "La Mercantil Andina", detalle: "Seguros y pólizas", icon: "fa-briefcase-medical" },
    { id: "san-cristobal", nombre: "San Cristóbal Seguros", detalle: "Cobertura familiar", icon: "fa-shield-check" },
    { id: "rio-uruguay", nombre: "Río Uruguay Seguros", detalle: "Pólizas y garantías", icon: "fa-umbrella" },
    { id: "sancor", nombre: "Sancor Seguros", detalle: "Seguro y garantía", icon: "fa-user-shield" }
  ] },
  { id: "tarjetas", nombre: "Tarjetas y Servicios Financieros", icon: "fa-credit-card", descripcion: "Finanzas y cuotas", proveedores: [
    { id: "credicash", nombre: "Tarjeta Credicash", detalle: "Cuotas y pagos", icon: "fa-money-check" },
    { id: "roela-siro", nombre: "Banco Roela Siro", detalle: "Cuenta y servicios", icon: "fa-university" },
    { id: "carrefour-servicios", nombre: "Carrefour Servicios Financieros", detalle: "Finanzas y crédito", icon: "fa-cart-shopping" },
    { id: "cencosud", nombre: "Tarjeta Cencosud", detalle: "Pagos y cuotas", icon: "fa-receipt" },
    { id: "psa", nombre: "PSA Peugeot Citroën", detalle: "Cuotas y mantenimiento", icon: "fa-car" },
    { id: "cobro-digital", nombre: "Cobro Digital", detalle: "Servicios digitales", icon: "fa-qrcode" }
  ] },
  { id: "gas", nombre: "Gas", icon: "fa-fire-flame-curved", descripcion: "Naturgy y distribuidoras", proveedores: [
    { id: "naturgy-bsas", nombre: "Naturgy Buenos Aires", detalle: "Gas natural", icon: "fa-fire" },
    { id: "metrogas", nombre: "Metrogas", detalle: "Gas y servicios", icon: "fa-burn" },
    { id: "camuzzi-pampeana", nombre: "Camuzzi Gas Pampeana", detalle: "Distribución", icon: "fa-temperature-arrow-up" },
    { id: "camuzzi-sur", nombre: "Camuzzi Gas del Sur", detalle: "Cobros mensuales", icon: "fa-temperature-low" },
    { id: "ecogas-cuyana", nombre: "Ecogas Cuyana", detalle: "Servicio gas", icon: "fa-gas-pump" },
    { id: "litoral-gas", nombre: "Litoral Gas", detalle: "Gas y energía", icon: "fa-burn" }
  ] },
  { id: "ventas-catalogo", nombre: "Ventas por Catálogo", icon: "fa-bag-shopping", descripcion: "Cosmética y moda", proveedores: [
    { id: "natura", nombre: "Natura Cosméticos", detalle: "Pedidos y cuotas", icon: "fa-spa" },
    { id: "cigot", nombre: "Cigot Cosméticos", detalle: "Productos y ventas", icon: "fa-seedling" },
    { id: "aware", nombre: "A-ware", detalle: "Compras y suscripciones", icon: "fa-shirt" },
    { id: "amodil", nombre: "Amodil", detalle: "Venta por catálogo", icon: "fa-bag-shopping" },
    { id: "bagues", nombre: "Bagués", detalle: "Productos de tienda", icon: "fa-box" },
    { id: "essen", nombre: "Essen", detalle: "Compras y catálogos", icon: "fa-cube" }
  ] },
  { id: "agua", nombre: "Agua", icon: "fa-droplet", descripcion: "Servicios hídricos", proveedores: [
    { id: "aysa", nombre: "AySA", detalle: "Agua y cloaca", icon: "fa-water" },
    { id: "aguas-cordobesas", nombre: "Aguas Cordobesas", detalle: "Servicio de agua", icon: "fa-faucet" },
    { id: "aguas-santafesinas", nombre: "Aguas Santafesinas", detalle: "Agua y saneamiento", icon: "fa-faucet-drip" },
    { id: "aguas-bonaerenses", nombre: "Aguas Bonaerenses", detalle: "Agua y servicios", icon: "fa-water" },
    { id: "aguas-corrientes", nombre: "Aguas de Corrientes", detalle: "Cobro de agua", icon: "fa-droplet" },
    { id: "aguas-rionegrinas", nombre: "Aguas Rionegrinas", detalle: "Servicio de agua", icon: "fa-droplet" }
  ] },
  { id: "salud", nombre: "Salud", icon: "fa-heart-pulse", descripcion: "Obras sociales y prepaga", proveedores: [
    { id: "osde", nombre: "OSDE", detalle: "Prestación médica", icon: "fa-heart" },
    { id: "sancor-salud", nombre: "Sancor Salud", detalle: "Prepaga", icon: "fa-stethoscope" },
    { id: "galeno", nombre: "Galeno", detalle: "Salud y bienestar", icon: "fa-user-doctor" },
    { id: "upcn-accord", nombre: "UPCN Accord Salud", detalle: "Cobertura médica", icon: "fa-hospital" },
    { id: "medife", nombre: "Medifé", detalle: "Servicios médios", icon: "fa-notes-medical" },
    { id: "swiss-medical", nombre: "Swiss Medical", detalle: "Prepaga internacional", icon: "fa-briefcase-medical" }
  ] },
  { id: "educacion-viajes", nombre: "Educación y Viajes de Egresados", icon: "fa-graduation-cap", descripcion: "Colegios y viajes", proveedores: [
    { id: "travel-rock", nombre: "Travel Rock", detalle: "Viajes y egresados", icon: "fa-plane" },
    { id: "pagoseduc", nombre: "PagosEduc", detalle: "Cuotas y servicios", icon: "fa-school" },
    { id: "fundacion-barcelo", nombre: "Fundación Barceló", detalle: "Educación y viajes", icon: "fa-book" },
    { id: "express-baxtter", nombre: "Express Baxtter", detalle: "Pagos de viajes", icon: "fa-route" },
    { id: "wolf-travel", nombre: "Wolf Travel", detalle: "Viajes egresados", icon: "fa-map-location-dot" },
    { id: "um-mendoza", nombre: "Universidad de Mendoza", detalle: "Matrícula y servicios", icon: "fa-building-columns" }
  ] }
];

const SERVICIOS_STORAGE_KEY = "nodo_servicios_favoritos";

const serviciosState = {
  categoriaActual: null,
  proveedorActual: null,
  numeroCliente: "",
  monto: 0,
  montoManual: "",
  favoritos: JSON.parse(localStorage.getItem(SERVICIOS_STORAGE_KEY) || "[]")
};

const getServicioCategoriaActual = () => SERVICIOS_CATEGORIAS.find(c => c.id === serviciosState.categoriaActual) || null;
const getServicioProveedorActual = () => {
  const categoria = getServicioCategoriaActual();
  if (!categoria) return null;
  return categoria.proveedores.find(p => p.id === serviciosState.proveedorActual) || null;
};

const guardarFavoritosServicios = () => localStorage.setItem(SERVICIOS_STORAGE_KEY, JSON.stringify(serviciosState.favoritos));

const renderServiciosCategorias = () => {
  const cont = document.getElementById("serviciosCategorias");
  if (!cont) return;

  cont.innerHTML = SERVICIOS_CATEGORIAS.map(c => `
    <button type="button" class="servicio-categoria-btn ${serviciosState.categoriaActual === c.id ? "active" : ""}" data-servicio-categoria="${c.id}">
      <div class="servicio-categoria-icon"><i class="fas ${c.icon}"></i></div>
      <div class="servicio-categoria-info">
        <strong>${c.nombre}</strong>
        <span>${c.descripcion}</span>
      </div>
    </button>
  `).join("");

  cont.querySelectorAll(".servicio-categoria-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      serviciosState.categoriaActual = btn.dataset.servicioCategoria;
      serviciosState.proveedorActual = null;
      serviciosState.numeroCliente = "";
      serviciosState.monto = 0;
      serviciosState.montoManual = "";
      renderServiciosCategorias();
      renderServiciosProveedores();
      renderServicioDetalle();
    });
  });
};

const renderServiciosProveedores = () => {
  const cont = document.getElementById("serviciosProveedores");
  const searchInput = document.getElementById("serviciosSearch");
  if (!cont) return;

  const categoria = getServicioCategoriaActual();
  const query = (searchInput?.value || "").trim().toLowerCase();
  const proveedores = categoria ? categoria.proveedores.filter(p => !query || `${p.nombre} ${p.detalle}`.toLowerCase().includes(query)) : [];

  if (!categoria) {
    cont.innerHTML = '<div class="servicio-detalle empty"><p>Seleccioná una categoría para ver los proveedores.</p></div>';
    return;
  }

  cont.innerHTML = proveedores.map(prov => {
    const isFav = serviciosState.favoritos.includes(prov.id);
    return `
      <div class="servicio-proveedor-card" data-servicio-proveedor="${prov.id}">
        <div class="servicio-proveedor-left">
          <div class="servicio-proveedor-icon"><i class="fas ${prov.icon}"></i></div>
          <div class="servicio-proveedor-meta">
            <strong>${prov.nombre}</strong>
            <span>${prov.detalle}</span>
          </div>
        </div>
        <button type="button" class="servicio-favorito-btn ${isFav ? "is-favorite" : ""}" data-favorito-proveedor="${prov.id}" aria-label="Marcar favorito">
          <i class="fas ${isFav ? "fa-star" : "fa-star"}"></i>
        </button>
      </div>
    `;
  }).join("") || '<div class="servicio-detalle empty"><p>No se encontraron proveedores con ese filtro.</p></div>';

  cont.querySelectorAll(".servicio-proveedor-card").forEach(card => {
    card.addEventListener("click", (e) => {
      if (e.target.closest(".servicio-favorito-btn")) return;
      serviciosState.proveedorActual = card.dataset.servicioProveedor;
      serviciosState.numeroCliente = "";
      serviciosState.monto = 0;
      serviciosState.montoManual = "";
      renderServicioDetalle();
    });
  });

  cont.querySelectorAll(".servicio-favorito-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const proveedorId = btn.dataset.favoritoProveedor;
      const idx = serviciosState.favoritos.indexOf(proveedorId);
      if (idx >= 0) serviciosState.favoritos.splice(idx, 1);
      else serviciosState.favoritos.push(proveedorId);
      guardarFavoritosServicios();
      renderServiciosProveedores();
    });
  });
};

const renderServicioDetalle = () => {
  const cont = document.getElementById("servicioDetalle");
  if (!cont) return;

  const categoria = getServicioCategoriaActual();
  const proveedor = getServicioProveedorActual();

  if (!categoria || !proveedor) {
    cont.className = "servicio-detalle empty";
    cont.innerHTML = '<p>Elegí una categoría y un proveedor para comenzar.</p>';
    return;
  }

  const montoActual = Number(serviciosState.montoManual || serviciosState.monto || 0);
  const totalLabel = montoActual > 0 ? `$ ${montoActual.toLocaleString("es-AR", { minimumFractionDigits: 2 })}` : "$ 0,00";

  cont.className = "servicio-detalle";
  cont.innerHTML = `
    <div class="servicio-header-card">
      <div class="servicio-header-meta">
        <div class="servicio-header-icon"><i class="fas ${proveedor.icon}"></i></div>
        <div>
          <h4>${proveedor.nombre}</h4>
          <span>${categoria.nombre}</span>
        </div>
      </div>
      <button type="button" class="servicio-favorito-btn ${serviciosState.favoritos.includes(proveedor.id) ? "is-favorite" : ""}" data-quick-favorito="${proveedor.id}" aria-label="Guardar favorito">
        <i class="fas fa-star"></i>
      </button>
    </div>

    <div class="servicio-form">
      <div class="servicio-input-wrap">
        <label>Número de cliente / factura</label>
        <input type="text" id="servicioNumeroCliente" value="${serviciosState.numeroCliente}" placeholder="Ej: 1234567890" autocomplete="off">
      </div>

      <div class="servicio-input-wrap">
        <label>Monto a pagar</label>
        <div class="servicio-input-price">
          <span>$</span>
          <input type="text" id="servicioMonto" value="${serviciosState.montoManual || ""}" placeholder="0" inputmode="numeric">
        </div>
      </div>

      <div class="servicio-confirm-box">
        <div class="servicio-confirm-row"><strong>Categoría</strong><span>${categoria.nombre}</span></div>
        <div class="servicio-confirm-row"><strong>Proveedor</strong><span>${proveedor.nombre}</span></div>
        <div class="servicio-confirm-row"><strong>Cliente</strong><span id="servicioClienteValor">${serviciosState.numeroCliente || "Sin número"}</span></div>
        <div class="servicio-confirm-row"><strong>Monto</strong><span id="servicioMontoValor">${totalLabel}</span></div>
      </div>

      <div class="servicio-actions">
        <button type="button" class="btn-secondary" id="servicioVolverCategoria">Cambiar proveedor</button>
        <button type="button" class="btn-primary" id="servicioConfirmar">Confirmar pago</button>
      </div>
    </div>
  `;

  const inputNumero = document.getElementById("servicioNumeroCliente");
  const inputMonto = document.getElementById("servicioMonto");
  const btnConfirmar = document.getElementById("servicioConfirmar");
  const btnVolver = document.getElementById("servicioVolverCategoria");
  const btnFav = cont.querySelector("[data-quick-favorito]");

  inputNumero?.addEventListener("input", () => {
    const rawValue = inputNumero.value.replace(/\D/g, "");
    inputNumero.value = rawValue;
    serviciosState.numeroCliente = rawValue;

    const clienteValor = document.getElementById("servicioClienteValor");
    if (clienteValor) {
      clienteValor.textContent = rawValue || "Sin número";
    }
  });

  inputMonto?.addEventListener("input", () => {
    const digits = inputMonto.value.replace(/\D/g, "");
    inputMonto.value = digits;
    serviciosState.montoManual = digits || "";
    serviciosState.monto = Number(serviciosState.montoManual || 0);

    const montoValor = document.getElementById("servicioMontoValor");
    if (montoValor) {
      const montoActual = Number(serviciosState.montoManual || 0);
      montoValor.textContent = montoActual > 0 ? `$ ${montoActual.toLocaleString("es-AR", { minimumFractionDigits: 2 })}` : "$ 0,00";
    }
  });

  btnConfirmar?.addEventListener("click", async () => {
    const numero = (serviciosState.numeroCliente || "").trim();
    const monto = Number(serviciosState.montoManual || 0);

    if (!numero || monto <= 0) {
      showToast("Ingresá un número de cliente y un monto válido", 3000, "error");
      return;
    }

    if (typeof saldoActual !== "number") saldoActual = 0;
    if (saldoActual < monto) {
      showToast("Saldo insuficiente para este pago", 3000, "error");
      return;
    }

    const resumen = {
      categoria: categoria.nombre,
      proveedor: proveedor.nombre,
      numeroCliente: numero,
      monto,
      comprobante: `SER-${Date.now().toString().slice(-6)}${Math.floor(1000 + Math.random() * 9000)}`
    };

    const step = document.getElementById("servicioDetalle");
    if (step) {
      step.className = "servicio-detalle";
      step.innerHTML = `
        <div class="servicio-header-card">
          <div class="servicio-header-meta">
            <div class="servicio-header-icon"><i class="fas fa-spinner fa-spin"></i></div>
            <div>
              <h4>Procesando pago</h4>
              <span>Validando operación con ${proveedor.nombre}</span>
            </div>
          </div>
        </div>
        <div class="servicio-form">
          <div class="servicio-input-wrap" style="align-items:center;justify-content:center;padding:8px 0;">
            <i class="fas fa-spinner fa-spin" style="font-size:2rem;color:var(--green);"></i>
            <span style="color:var(--text-3);">Acreditando el pago...</span>
          </div>
        </div>
      `;
    }

    await new Promise(resolve => setTimeout(resolve, 800));

    const saldoAnterior = Number(saldoActual || 0);
    const nuevoSaldo = saldoAnterior - monto;
    saldoActual = nuevoSaldo;

    if (typeof cuentaActiva === "object") {
      cuentaActiva.saldo = nuevoSaldo;
    }

    if (typeof animarSaldo === "function") {
      animarSaldo(saldoAnterior, nuevoSaldo);
    } else if (typeof actualizarDisplaySaldo === "function") {
      actualizarDisplaySaldo();
    }

    const saldoBadge = document.getElementById("serviciosSaldoDisponible");
    if (saldoBadge) {
      saldoBadge.textContent = `Saldo: $ ${nuevoSaldo.toLocaleString("es-AR", { minimumFractionDigits: 2 })}`;
    }

    if (typeof _actualizarLimitePrestamos === "function") {
      _actualizarLimitePrestamos(saldoActual);
    }

    localStorage.setItem("nodo_saldo_override", String(saldoActual));

    const nuevoMovimiento = {
      id: `serv_${Date.now()}`,
      cuenta_id: (typeof cuentaActiva === "object" && cuentaActiva?.id) ? cuentaActiva.id : 1,
      tipo: "debito",
      monto,
      descripcion: `Pago ${categoria.nombre} - ${proveedor.nombre}`,
      saldo_anterior: saldoAnterior,
      saldo_posterior: nuevoSaldo,
      fecha_movimiento: new Date().toISOString(),
      comprobante: resumen.comprobante,
      categoria: categoria.nombre,
      proveedor: proveedor.nombre,
      numero_cliente: numero
    };

    guardarMovimientoLocal(nuevoMovimiento);
    insertarMovimientoEnDOM(nuevoMovimiento);

    cont.className = "servicio-detalle";
    cont.innerHTML = `
      <div class="servicio-header-card">
        <div class="servicio-header-meta">
          <div class="servicio-header-icon" style="background:rgba(16,185,129,0.13);color:var(--green);"><i class="fas fa-check"></i></div>
          <div>
            <h4>Pago realizado</h4>
            <span>Comprobante ${resumen.comprobante}</span>
          </div>
        </div>
      </div>
      <div class="servicio-form">
        <div class="servicio-confirm-box">
          <div class="servicio-confirm-row"><strong>Categoría</strong><span>${resumen.categoria}</span></div>
          <div class="servicio-confirm-row"><strong>Proveedor</strong><span>${resumen.proveedor}</span></div>
          <div class="servicio-confirm-row"><strong>Cliente</strong><span>${resumen.numeroCliente}</span></div>
          <div class="servicio-confirm-row"><strong>Pagaste</strong><span>$ ${monto.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</span></div>
          <div class="servicio-confirm-row"><strong>Saldo restante</strong><span>$ ${nuevoSaldo.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</span></div>
        </div>
        <div class="servicio-actions">
          <button type="button" class="btn-secondary" id="servicioNueva">Otro pago</button>
          <button type="button" class="btn-primary" id="servicioVolverInicio">Volver al inicio</button>
        </div>
      </div>
    `;

    const btnNueva = document.getElementById("servicioNueva");
    const btnInicio = document.getElementById("servicioVolverInicio");
    btnNueva?.addEventListener("click", () => {
      serviciosState.proveedorActual = null;
      serviciosState.numeroCliente = "";
      serviciosState.monto = 0;
      serviciosState.montoManual = "";
      renderServicioDetalle();
    });
    btnInicio?.addEventListener("click", () => {
      document.querySelector('.sidebar-nav-item[data-section="inicio"]')?.click();
    });

    if (typeof actualizarDisplaySaldo === "function") actualizarDisplaySaldo();
    if (typeof _actualizarLimitePrestamos === "function") _actualizarLimitePrestamos(saldoActual);
    if (typeof showToast === "function") showToast(`Pago de $${monto.toLocaleString("es-AR")} procesado correctamente`, 4000, "success");
  });

  btnVolver?.addEventListener("click", () => {
    serviciosState.proveedorActual = null;
    renderServiciosProveedores();
    renderServicioDetalle();
  });

  btnFav?.addEventListener("click", (e) => {
    e.stopPropagation();
    const id = btnFav.dataset.quickFavorito;
    if (!id) return;
    const idx = serviciosState.favoritos.indexOf(id);
    if (idx >= 0) serviciosState.favoritos.splice(idx, 1);
    else serviciosState.favoritos.push(id);
    guardarFavoritosServicios();
    renderServiciosProveedores();
    renderServicioDetalle();
  });
};

const inicializarServiciosDashboard = () => {
  const cont = document.getElementById("serviciosCategorias");
  const searchInput = document.getElementById("serviciosSearch");
  if (!cont) return;

  const categoriaInicial = SERVICIOS_CATEGORIAS[0];
  serviciosState.categoriaActual = categoriaInicial.id;
  serviciosState.proveedorActual = null;

  renderServiciosCategorias();
  if (searchInput) {
    searchInput.addEventListener("input", () => renderServiciosProveedores());
  }

  renderServiciosProveedores();
  renderServicioDetalle();

  const saldoBadge = document.getElementById("serviciosSaldoDisponible");
  if (saldoBadge) {
    const s = typeof saldoActual === "number" ? saldoActual : 0;
    saldoBadge.textContent = `Saldo: $ ${s.toLocaleString("es-AR", { minimumFractionDigits: 2 })}`;
  }
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", inicializarServiciosDashboard);
} else {
  inicializarServiciosDashboard();
}

/**
 * Abre el modal de Recargar Celular y resetea el formulario al Paso 1
 */
const resetRecargaState = () => {
  recargaOperador = null;
  recargaNumero = "";
  recargaMonto = 0;
  recargaComprobante = "";

  document.querySelectorAll(".operator-card").forEach(c => c.classList.remove("selected"));

  const phoneInput = document.getElementById("recargaTelefono");
  if (phoneInput) {
    phoneInput.value = "";
    document.getElementById("phoneInputWrap")?.classList.remove("has-error");
    const err = document.getElementById("recargaPhoneError");
    if (err) { err.textContent = ""; err.classList.remove("visible"); }
  }

  document.querySelectorAll(".amount-chip").forEach(c => c.classList.remove("selected"));
  const customBox = document.getElementById("customAmountBox");
  const customInput = document.getElementById("recargaMontoCustom");
  if (customBox) customBox.classList.add("hidden");
  if (customInput) customInput.value = "";

  actualizarSaldoBadgeRecarga();
  mostrarPasoRecarga("recargaStep1");
  validarFormularioRecarga();
};

const openRecargaModal = () => {
  const modal = document.getElementById("recargaModal");
  if (!modal) return;

  const moraBanner = document.getElementById("moraBanner");
  if (moraBanner && !moraBanner.classList.contains("hidden")) {
    if (typeof showToast === "function") {
      showToast("Regularizá tu préstamo para recargar servicios", 4000, "error");
    }
    return;
  }

  resetRecargaState();
  modal.classList.remove("hidden");
  setTimeout(() => document.getElementById("recargaTelefono")?.focus(), 150);
};

/**
 * Cierra el modal de recarga
 */
const closeRecargaModal = () => {
  const modal = document.getElementById("recargaModal");
  if (modal) modal.classList.add("hidden");
  resetRecargaState();
};

const volverAlInicioRecarga = () => {
  resetRecargaState();
  const modal = document.getElementById("recargaModal");
  if (modal) modal.classList.add("hidden");

  const inicioBtn = document.querySelector('.sidebar-nav-item[data-section="inicio"]');
  if (inicioBtn) {
    inicioBtn.click();
  }
};

const nuevaRecarga = () => {
  resetRecargaState();
  const modal = document.getElementById("recargaModal");
  if (modal) modal.classList.remove("hidden");
  setTimeout(() => document.getElementById("recargaTelefono")?.focus(), 150);
};

/**
 * Controla la visualización exclusiva de los pasos del modal
 */
const mostrarPasoRecarga = (pasoId) => {
  const pasos = [
    "recargaStep1",
    "recargaStepConfirm",
    "recargaStepProcessing",
    "recargaStepSuccess",
    "recargaStepError"
  ];

  pasos.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      if (id === pasoId) el.classList.remove("hidden");
      else el.classList.add("hidden");
    }
  });
};

/**
 * Actualiza la etiqueta de saldo disponible del bloque de recarga.
 */
const actualizarSaldoBadgeRecarga = () => {
  const badge = document.getElementById("recargaSaldoDisponible") || document.getElementById("recargaSectionSaldoDisponible");
  if (badge) {
    const s = typeof saldoActual === "number" ? saldoActual : 0;
    badge.textContent = `Saldo: $ ${s.toLocaleString("es-AR", { minimumFractionDigits: 2 })}`;
  }
};

/**
 * Formatea un string de celular argentino al formato legible.
 * Acepta entre 10 y 12 dígitos sin 0 ni 15, por ejemplo:
 * 1123456789 -> "11 2345-6789"
 * 112345678901 -> "11 2345-678901" (formato flexible para casos de 12 dígitos)
 */
const formatearNumeroArgentino = (digits) => {
  if (!digits) return "";
  const d = digits.slice(0, 12);
  if (d.startsWith("11")) {
    if (d.length <= 2) return d;
    if (d.length <= 6) return `${d.slice(0, 2)} ${d.slice(2)}`;
    if (d.length <= 10) return `${d.slice(0, 2)} ${d.slice(2, 6)}-${d.slice(6)}`;
    return `${d.slice(0, 2)} ${d.slice(2, 6)}-${d.slice(6, 10)} ${d.slice(10)}`;
  } else if (d.startsWith("2") || d.startsWith("3")) {
    if (d.length <= 3) return d;
    if (d.length <= 6) return `${d.slice(0, 3)} ${d.slice(3)}`;
    if (d.length <= 10) return `${d.slice(0, 3)} ${d.slice(3, 6)}-${d.slice(6)}`;
    return `${d.slice(0, 3)} ${d.slice(3, 6)}-${d.slice(6, 10)} ${d.slice(10)}`;
  }
  return d;
};

/**
 * Valida todos los campos del Paso 1 para habilitar el botón "Continuar"
 */
const validarFormularioRecarga = () => {
  const btnContinuar = document.getElementById("btnRecargaContinuar");
  const phoneError = document.getElementById("recargaPhoneError");
  const phoneWrap = document.getElementById("phoneInputWrap");

  let esValido = true;
  let mensajeError = "";

  // 1. Operador seleccionado
  if (!recargaOperador) {
    esValido = false;
  }

  // 2. Validación de número argentino (10 a 12 dígitos, sin 0 ni 15)
  if (!recargaNumero) {
    esValido = false;
  } else if (recargaNumero.startsWith("0")) {
    esValido = false;
    mensajeError = "Ingresá el número sin el 0 inicial (ej: 11...).";
  } else if (recargaNumero.startsWith("15")) {
    esValido = false;
    mensajeError = "Ingresá el número sin el 15. Usá el código de área (ej: 11...).";
  } else if (recargaNumero.length < 10) {
    esValido = false;
    if (recargaNumero.length >= 6) {
      mensajeError = `Faltan ${10 - recargaNumero.length} dígitos (deben ser entre 10 y 12 en total).`;
    }
  } else if (recargaNumero.length > 12) {
    esValido = false;
    mensajeError = "El número debe tener entre 10 y 12 dígitos.";
  } else {
    mensajeError = "";
  }

  // Feedback visual del input telefónico
  if (phoneError && phoneWrap) {
    if (mensajeError) {
      phoneError.textContent = mensajeError;
      phoneError.classList.add("visible");
      phoneWrap.classList.add("has-error");
    } else {
      phoneError.textContent = "";
      phoneError.classList.remove("visible");
      phoneWrap.classList.remove("has-error");
    }
  }

  // 3. Monto seleccionado o ingresado
  if (!recargaMonto || isNaN(recargaMonto) || recargaMonto <= 0) {
    esValido = false;
  }

  if (btnContinuar) {
    btnContinuar.disabled = !esValido;
  }

  return esValido;
};

/**
 * Paso 2: Pantalla de confirmación previa con resumen
 */
const irAConfirmacion = () => {
  if (!validarFormularioRecarga()) return;

  const cfg = OPERADORES_CONFIG[recargaOperador] || {
    nombre: recargaOperador,
    color: "#10B981",
    badge: recargaOperador.charAt(0)
  };

  // Badge del operador
  const opBadge = document.getElementById("confirmOpBadge");
  const opNombre = document.getElementById("confirmOpNombre");
  if (opBadge) {
    opBadge.style.background = cfg.color;
    opBadge.textContent = cfg.badge;
  }
  if (opNombre) opNombre.textContent = cfg.nombre;

  // Número formateado internacional
  const numEl = document.getElementById("confirmTelefono");
  if (numEl) {
    numEl.textContent = `+54 9 ${formatearNumeroArgentino(recargaNumero)}`;
  }

  // Monto a debitar
  const montoEl = document.getElementById("confirmMonto");
  if (montoEl) {
    montoEl.textContent = `$ ${recargaMonto.toLocaleString("es-AR", { minimumFractionDigits: 2 })}`;
  }

  // Saldo disponible en cuenta
  const saldoOrigenEl = document.getElementById("confirmSaldoOrigen");
  if (saldoOrigenEl) {
    const s = typeof saldoActual === "number" ? saldoActual : 0;
    saldoOrigenEl.textContent = `$ ${s.toLocaleString("es-AR", { minimumFractionDigits: 2 })}`;
  }

  mostrarPasoRecarga("recargaStepConfirm");
};

/**
 * Paso 3: Simulación de procesamiento (~800ms) y verificación de saldo
 */
const procesarRecarga = async () => {
  // Mostrar pantalla de carga con spinner fintech
  mostrarPasoRecarga("recargaStepProcessing");

  const procSub = document.getElementById("recargaProcessingSub");
  if (procSub) {
    procSub.textContent = `Conectando con ${recargaOperador} para acreditar tu saldo...`;
  }

  // Simulación del delay de red (~800ms)
  await new Promise(resolve => setTimeout(resolve, 850));

  // Verificar si el saldo es suficiente
  const saldoDisponible = typeof saldoActual === "number" ? saldoActual : 0;

  if (saldoDisponible < recargaMonto) {
    // ── ERROR: Saldo insuficiente ──
    // NO se descuenta saldo de la cuenta
    mostrarPantallaError(saldoDisponible, recargaMonto);
  } else {
    // ── ÉXITO: Saldo suficiente ──
    await ejecutarRecargaExitosa(saldoDisponible, recargaMonto);
  }
};

/**
 * Renderiza la pantalla de error por saldo insuficiente
 */
const mostrarPantallaError = (saldoDisponible, montoRequerido) => {
  const subEl = document.getElementById("recargaErrorSub");
  const saldoDispEl = document.getElementById("recargaErrorSaldoDisp");
  const montoReqEl = document.getElementById("recargaErrorMontoReq");

  if (subEl) {
    subEl.textContent = `No disponés de saldo suficiente para recargar $${montoRequerido.toLocaleString("es-AR")}. Tu saldo actual es de $${saldoDisponible.toLocaleString("es-AR")}.`;
  }
  if (saldoDispEl) {
    saldoDispEl.textContent = `$ ${saldoDisponible.toLocaleString("es-AR", { minimumFractionDigits: 2 })}`;
  }
  if (montoReqEl) {
    montoReqEl.textContent = `$ ${montoRequerido.toLocaleString("es-AR", { minimumFractionDigits: 2 })}`;
  }

  mostrarPasoRecarga("recargaStepError");
};

/**
 * Ejecuta la recarga exitosa: descuenta saldo, genera comprobante y guarda movimiento
 */
const ejecutarRecargaExitosa = async (saldoAnterior, monto) => {
  // Generar número de comprobante único
  recargaComprobante = `REC-${Date.now().toString().slice(-6)}${Math.floor(1000 + Math.random() * 9000)}`;
  const fechaActual = new Date();

  // 1. Descuento del saldo SOLO si la recarga es exitosa
  const nuevoSaldo = saldoAnterior - monto;
  saldoActual = nuevoSaldo;

  // Animar y actualizar el hero de saldo en la pantalla principal
  if (typeof animarSaldo === "function") {
    animarSaldo(saldoAnterior, nuevoSaldo);
  } else if (typeof actualizarDisplaySaldo === "function") {
    actualizarDisplaySaldo();
  }

  // Notificar al módulo de préstamos si existe
  if (typeof _actualizarLimitePrestamos === "function") {
    _actualizarLimitePrestamos(saldoActual);
  }

  // Persistir saldo en localStorage para persistencia offline
  localStorage.setItem("nodo_saldo_override", String(saldoActual));

  // 2. Registro del movimiento en el historial
  const descripcionMov = `Recarga ${recargaOperador} - ${recargaNumero}`;
  const nuevoMovimiento = {
    id: `rec_${Date.now()}`,
    cuenta_id: (typeof cuentaActiva === "object" && cuentaActiva?.id) ? cuentaActiva.id : 1,
    tipo: "debito",
    monto: monto,
    descripcion: descripcionMov,
    saldo_anterior: saldoAnterior,
    saldo_posterior: nuevoSaldo,
    fecha_movimiento: fechaActual.toISOString(),
    comprobante: recargaComprobante,
    operador: recargaOperador,
    telefono: recargaNumero
  };

  // Guardar en localStorage para persistencia de movimientos
  guardarMovimientoLocal(nuevoMovimiento);

  // Inyectar inmediatamente en el DOM en la lista de movimientos
  insertarMovimientoEnDOM(nuevoMovimiento);

  // Intentar persistir en backend si está disponible y autenticado
  if (typeof apiFetch === "function") {
    try {
      await apiFetch("/cuentas/recarga-celular", {
        method: "POST",
        body: JSON.stringify({
          cuenta_id: typeof cuentaActiva === "object" ? cuentaActiva?.id : undefined,
          operador: recargaOperador,
          numero_celular: recargaNumero,
          monto: monto
        })
      });
    } catch (e) {
      console.warn("Recarga guardada en modo local (sin sincronización con backend):", e.message);
    }
  }

  // 3. Renderizar pantalla de éxito
  const comprobanteEl = document.getElementById("recargaSuccessComprobante");
  const opEl = document.getElementById("recargaSuccessOp");
  const telEl = document.getElementById("recargaSuccessTel");
  const montoEl = document.getElementById("recargaSuccessMonto");
  const saldoEl = document.getElementById("recargaSuccessSaldo");
  const fechaEl = document.getElementById("recargaSuccessFecha");

  if (comprobanteEl) comprobanteEl.textContent = recargaComprobante;
  if (opEl) opEl.textContent = recargaOperador;
  if (telEl) telEl.textContent = `+54 9 ${formatearNumeroArgentino(recargaNumero)}`;
  if (montoEl) montoEl.textContent = `$ ${monto.toLocaleString("es-AR", { minimumFractionDigits: 2 })}`;
  if (saldoEl) saldoEl.textContent = `$ ${nuevoSaldo.toLocaleString("es-AR", { minimumFractionDigits: 2 })}`;
  if (fechaEl) {
    fechaEl.textContent = fechaActual.toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }) + " hs";
  }

  mostrarPasoRecarga("recargaStepSuccess");

  if (typeof showToast === "function") {
    showToast(`Recarga de $${monto.toLocaleString("es-AR")} acreditada con éxito`, 4000, "success");
  }

  // Refrescar gráfico de gastos por categoría automáticamente
  setTimeout(() => document.getElementById("loadGastosBtn")?.click(), 1200);
};

/**
 * Guarda el movimiento en localStorage bajo la clave "nodo_recargas_movimientos"
 */
const guardarMovimientoLocal = (mov) => {
  try {
    const list = JSON.parse(localStorage.getItem("nodo_recargas_movimientos") || "[]");
    list.unshift(mov);
    localStorage.setItem("nodo_recargas_movimientos", JSON.stringify(list.slice(0, 50)));
  } catch (e) {
    console.error("Error al guardar movimiento en localStorage:", e);
  }
};

/**
 * Inserta el movimiento de recarga directamente en el DOM de la lista de actividad
 */
const insertarMovimientoEnDOM = (mov) => {
  const movimientosList = document.getElementById("movimientosList");
  if (movimientosList) {
    // Si estaba el mensaje de "No hay movimientos", limpiarlo
    if (movimientosList.querySelector(".muted") || movimientosList.querySelector(".list-empty")) {
      movimientosList.innerHTML = "";
    }

    const li = document.createElement("li");
    li.className = "movement-item";
    li.style.animation = "fadeIn 0.4s ease-out";
    li.innerHTML = `
      <div class="mov-info">
        <div class="mov-icon muted"><i class="fas fa-mobile-alt"></i></div>
        <div class="mov-text">
          <b>${mov.descripcion}</b>
          <span>${new Date(mov.fecha_movimiento).toLocaleDateString("es-AR")} <span class="mov-bank-badge" style="background:#019DF4;color:#fff;">Recarga</span></span>
        </div>
      </div>
      <div class="mov-amount">-$${Math.abs(mov.monto).toLocaleString("es-AR")}</div>
    `;

    movimientosList.prepend(li);
  }

  // También actualizar últimos movimientos en el hero si existe
  const heroMov = document.getElementById("heroMovimientos");
  if (heroMov) {
    heroMov.classList.remove("hidden");
  }
};

const descargarComprobanteRecarga = () => {
  const comprobante = recargaComprobante || "REC-000000";
  const fecha = new Date().toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Comprobante ${comprobante}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Arial,sans-serif;max-width:400px;margin:40px auto;color:#1e293b;padding:0 16px}
  .hdr{text-align:center;padding-bottom:16px;margin-bottom:20px;border-bottom:2px solid #10B981}
  .logo{font-size:1.6rem;font-weight:800;color:#10B981;letter-spacing:3px}
  .sub{font-size:.85rem;color:#64748b;margin-top:4px}
  .icon{display:block;margin:12px auto 4px;width:44px;height:44px;border-radius:50%;background:#d1fae5;line-height:44px;text-align:center;font-size:1.4rem;color:#10B981}
  .row{display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px solid #e2e8f0;font-size:.88rem}
  .lbl{color:#64748b}.val{font-weight:600}
  .green{color:#10B981}
  .ftr{text-align:center;margin-top:22px;color:#94a3b8;font-size:.78rem}
  @media print{body{margin:10px}}
</style>
</head>
<body>
<div class="hdr">
  <div class="logo">NODO</div>
  <div class="sub">Comprobante de Recarga Celular</div>
  <span class="icon">✓</span>
</div>
<div class="row"><span class="lbl">Comprobante</span><span class="val">${comprobante}</span></div>
<div class="row"><span class="lbl">Operador</span><span class="val">${recargaOperador || "—"}</span></div>
<div class="row"><span class="lbl">Número</span><span class="val">+54 9 ${formatearNumeroArgentino(recargaNumero)}</span></div>
<div class="row"><span class="lbl">Monto recargado</span><span class="val green">$ ${recargaMonto.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</span></div>
<div class="row"><span class="lbl">Estado</span><span class="val green">✓ Acreditado</span></div>
<div class="row"><span class="lbl">Fecha y hora</span><span class="val">${fecha} hs</span></div>
<div class="ftr">Operado por NODO Home Banking · El nodo de tu crecimiento</div>
</body>
</html>`;

  const win = window.open("", "_blank", "width=500,height=620");
  if (win) {
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 350);
  }

  if (typeof showToast === "function") showToast("Abriendo comprobante para imprimir", 2500, "success");
};

const REPORTES_STORAGE_KEYS = ["nodo_recargas_movimientos", "nodo_historial_global", "nodo_movimientos"];

const normalizarReporteMovimiento = (m) => {
  if (!m || typeof m !== "object") return null;

  const fecha = m.fecha_movimiento || m.fecha || m.date || new Date().toISOString();
  const rawMonto = Number(m.monto ?? m.amount ?? 0);
  const tipo = (m.tipo || m.kind || m.type || m.operacion || "debito").toString().toLowerCase();
  const descripcion = m.descripcion || m.description || "Movimiento";
  const categoria = (
    m.categoria ||
    m.category ||
    (() => {
      const texto = `${(m.proveedor || "")} ${(m.operador || "")} ${(m.descripcion || "")} ${(m.concepto || "")}`.toLowerCase();
      if (/telefon|movistar|personal|claro|tuenti/.test(texto)) return "telefonía";
      if (/luz|edenor|edesur|electric|energia/.test(texto)) return "luz";
      if (/gas|metrogas|naturgy|camuzzi/.test(texto)) return "gas";
      if (/agua|aysa|aguas/.test(texto)) return "agua";
      if (/spotify|netflix|youtube|disney|hbo|premium|suscrip/.test(texto)) return "suscripciones";
      if (/transfer|envio|cobro|deposit/.test(texto)) return "transferencia";
      if (/servicio|factura|pago/.test(texto)) return "servicios";
      if (/recarga/.test(texto)) return "telefonía";
      return "general";
    })()
  ).toString().toLowerCase();

  const categoriaNormalizada = categoria === "telefoni" || categoria === "telefonia" ? "telefonía" : categoria;
  const proveedorDestino = m.proveedor || m.operador || m.destino || m.receptor || m.descripcion || "Movimiento";
  const estado = (m.estado || m.status || "completado").toString().toLowerCase();
  const comprobante = m.comprobante || m.comprobante_id || m.id || "N/A";
  const isIngreso = /ingreso|deposito|cobro|credito|acredit/.test((m.descripcion || "") + " " + (m.tipo || ""));
  const isGasto = !isIngreso && (tipo.includes("debito") || tipo.includes("egreso") || tipo.includes("pago") || /recarga|servicio|transferencia|compra|gasto/.test((m.descripcion || "") + " " + (m.tipo || "")));
  const montoFinal = Number.isFinite(rawMonto) ? Math.abs(rawMonto) : 0;

  let tipoReporte = "transferencia";
  if (/recarga/.test((m.descripcion || "") + " " + (m.operador || ""))) tipoReporte = "recarga";
  else if (/servicio|factura|pago/.test((m.descripcion || "") + " " + (m.proveedor || ""))) tipoReporte = "pago de servicio";
  else if (/transfer/.test((m.descripcion || "") + " " + (m.destino || ""))) tipoReporte = "transferencia";
  else if (isIngreso) tipoReporte = "ingreso";
  else if (/compra|debito|egreso/.test(tipo + " " + (m.descripcion || ""))) tipoReporte = "gasto";

  return {
    id: m.id || comprobante,
    fecha,
    fechaISO: new Date(fecha).toISOString(),
    categoria: categoriaNormalizada,
    proveedorDestino,
    monto: montoFinal,
    montoOriginal: rawMonto,
    tipo: tipoReporte,
    estado,
    descripcion,
    comprobante,
    esGasto: isGasto,
    esIngreso: isIngreso
  };
};

const obtenerMovimientosReporte = () => {
  const movimientos = [];

  REPORTES_STORAGE_KEYS.forEach((key) => {
    try {
      const raw = JSON.parse(localStorage.getItem(key) || "[]");
      const list = Array.isArray(raw) ? raw : [raw].filter(Boolean);
      list.forEach((mov) => {
        const item = normalizarReporteMovimiento(mov);
        if (item) movimientos.push(item);
      });
    } catch (e) {
      console.warn("No se pudo leer historial de reportes:", key, e);
    }
  });

  return movimientos
    .filter(Boolean)
    .sort((a, b) => new Date(b.fechaISO) - new Date(a.fechaISO));
};

const formatearMonto = (valor) => `$ ${Number(valor || 0).toLocaleString("es-AR", { minimumFractionDigits: 2 })}`;

const obtenerRangoPorDefecto = () => {
  const hasta = new Date();
  const desde = new Date();
  desde.setDate(hasta.getDate() - 29);
  return { desde, hasta };
};

const aplicarFiltrosReporte = (movimientos, filtros) => {
  const desde = filtros.desde ? new Date(`${filtros.desde}T00:00:00`) : null;
  const hasta = filtros.hasta ? new Date(`${filtros.hasta}T23:59:59`) : null;

  return movimientos.filter((mov) => {
    const fecha = new Date(mov.fechaISO);
    if (desde && fecha < desde) return false;
    if (hasta && fecha > hasta) return false;
    if (filtros.tipo && filtros.tipo !== "todos" && mov.tipo !== filtros.tipo) return false;
    if (filtros.categoria && filtros.categoria !== "todos" && mov.categoria !== filtros.categoria) return false;
    if (filtros.estado && filtros.estado !== "todos" && mov.estado !== filtros.estado) return false;
    return true;
  });
};

const prepararOpcionesReporte = (movimientos) => {
  const tipos = [...new Set(movimientos.map((m) => m.tipo))].sort();
  const categorias = [...new Set(movimientos.map((m) => m.categoria))].sort();

  const tipoSelect = document.getElementById("reporteTipo");
  const categoriaSelect = document.getElementById("reporteCategoria");

  if (tipoSelect) {
    const values = ["todos", ...tipos];
    tipoSelect.innerHTML = values.map((tipo) => `<option value="${tipo}">${tipo === "todos" ? "Todos" : tipo}</option>`).join("");
  }

  if (categoriaSelect) {
    const values = ["todos", ...categorias];
    categoriaSelect.innerHTML = values.map((cat) => `<option value="${cat}">${cat === "todos" ? "Todas" : cat}</option>`).join("");
  }
};

const obtenerSumaPorCategoria = (movimientos) => {
  const mapa = new Map();
  movimientos.forEach((mov) => {
    if (!mov.esGasto) return;
    const key = mov.categoria || "general";
    mapa.set(key, (mapa.get(key) || 0) + mov.monto);
  });
  return [...mapa.entries()].sort((a, b) => b[1] - a[1]);
};

const obtenerEvolucionPorRango = (movimientos, desde, hasta) => {
  const diffDays = Math.max(1, Math.ceil((hasta - desde) / (1000 * 60 * 60 * 24)) + 1);
  const isDaily = diffDays <= 31;
  const isWeekly = diffDays <= 180;

  const groups = new Map();

  movimientos.forEach((mov) => {
    if (!mov.esGasto) return;
    const fecha = new Date(mov.fechaISO);
    let key = "";
    if (isDaily) {
      const y = fecha.getFullYear();
      const m = String(fecha.getMonth() + 1).padStart(2, "0");
      const d = String(fecha.getDate()).padStart(2, "0");
      key = `${y}-${m}-${d}`;
    } else if (isWeekly) {
      const oneJan = new Date(fecha.getFullYear(), 0, 1);
      const semana = Math.ceil((((fecha - oneJan) / 86400000) + oneJan.getDay() + 1) / 7);
      key = `sem-${fecha.getFullYear()}-${semana}`;
    } else {
      key = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}`;
    }
    groups.set(key, (groups.get(key) || 0) + mov.monto);
  });

  const result = [];
  const iter = new Date(desde);
  while (iter <= hasta) {
    const key = isDaily
      ? `${iter.getFullYear()}-${String(iter.getMonth() + 1).padStart(2, "0")}-${String(iter.getDate()).padStart(2, "0")}`
      : isWeekly
      ? `sem-${iter.getFullYear()}-${Math.ceil((((iter - new Date(iter.getFullYear(), 0, 1)) / 86400000) + new Date(iter.getFullYear(), 0, 1).getDay() + 1) / 7)}`
      : `${iter.getFullYear()}-${String(iter.getMonth() + 1).padStart(2, "0")}`;

    const label = isDaily
      ? iter.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" })
      : isWeekly
      ? `Sem ${Math.ceil((((iter - new Date(iter.getFullYear(), 0, 1)) / 86400000) + new Date(iter.getFullYear(), 0, 1).getDay() + 1) / 7)}`
      : iter.toLocaleDateString("es-AR", { month: "short" });

    result.push({ label, value: groups.get(key) || 0, key });
    if (isDaily) iter.setDate(iter.getDate() + 1);
    else if (isWeekly) iter.setDate(iter.getDate() + 7);
    else iter.setMonth(iter.getMonth() + 1);
  }

  return result;
};

const renderizarResumenReporte = (movimientos, rango) => {
  const cont = document.getElementById("reportesResumen");
  if (!cont) return;

  const totalGastado = movimientos.filter((m) => m.esGasto).reduce((sum, m) => sum + m.monto, 0);
  const transacciones = movimientos.length;
  const categoriaMasGasto = obtenerSumaPorCategoria(movimientos)[0] || ["general", 0];

  const allMovs = obtenerMovimientosReporte();
  const previa = allMovs.filter((m) => {
    const fecha = new Date(m.fechaISO);
    const start = new Date(rango.desde);
    const end = new Date(rango.hasta);
    const previousStart = new Date(start);
    previousStart.setDate(start.getDate() - (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24) - 1);
    const previousEnd = new Date(start);
    previousEnd.setDate(start.getDate() - 1);
    return fecha >= previousStart && fecha <= previousEnd;
  });

  const totalPrevio = previa.filter((m) => m.esGasto).reduce((sum, m) => sum + m.monto, 0);
  const cambio = totalPrevio > 0 ? ((totalGastado - totalPrevio) / totalPrevio) * 100 : 0;
  const trendText = totalPrevio === 0 ? "Sin comparación previa" : `${cambio >= 0 ? "+" : ""}${cambio.toFixed(1)}% respecto al período anterior`;

  cont.innerHTML = `
    <div class="report-kpi">
      <span class="report-kpi-label">Total gastado</span>
      <div class="report-kpi-value">${formatearMonto(totalGastado)}</div>
      <span class="report-kpi-trend ${cambio < 0 ? "negative" : ""}">${trendText}</span>
    </div>
    <div class="report-kpi">
      <span class="report-kpi-label">Transacciones</span>
      <div class="report-kpi-value">${transacciones}</div>
      <span class="report-kpi-trend">${movimientos.filter((m) => m.esGasto).length} gastos</span>
    </div>
    <div class="report-kpi">
      <span class="report-kpi-label">Mayor gasto</span>
      <div class="report-kpi-value">${categoriaMasGasto[0]}</div>
      <span class="report-kpi-trend">${formatearMonto(categoriaMasGasto[1])}</span>
    </div>
    <div class="report-kpi">
      <span class="report-kpi-label">Comparación</span>
      <div class="report-kpi-value">${totalPrevio > 0 ? `${cambio >= 0 ? "+" : ""}${cambio.toFixed(1)}%` : "—"}</div>
      <span class="report-kpi-trend ${cambio < 0 ? "negative" : ""}">${totalPrevio > 0 ? (cambio >= 0 ? "superior" : "inferior") : "Sin base"}</span>
    </div>
  `;
};

const renderizarGraficoCategorias = (movimientos) => {
  const cont = document.getElementById("chartCategorias");
  if (!cont) return;

  const gastosPorCat = obtenerSumaPorCategoria(movimientos);
  if (!gastosPorCat.length) {
    cont.innerHTML = '<div class="report-empty"><i class="fas fa-chart-pie"></i><p>No hay gastos por categoría.</p></div>';
    return;
  }

  const max = Math.max(...gastosPorCat.map(([, value]) => value), 1);
  cont.innerHTML = `
    <div class="report-bars">
      ${gastosPorCat.slice(0, 6).map(([categoria, valor]) => `
        <div class="report-bar-item">
          <div class="report-bar" style="height: ${(valor / max) * 100}%"></div>
          <span class="report-bar-label">${categoria.slice(0, 8)}</span>
        </div>
      `).join("")}
    </div>
  `;
};

const renderizarGraficoTiempo = (movimientos, desde, hasta) => {
  const cont = document.getElementById("chartTiempo");
  if (!cont) return;

  const evolucion = obtenerEvolucionPorRango(movimientos, desde, hasta);
  const values = evolucion.map((d) => d.value);
  const maxValue = Math.max(...values, 1);

  const linePoints = evolucion.map((d, index) => {
    const x = (index / Math.max(1, evolucion.length - 1)) * 100;
    const y = 100 - (d.value / maxValue) * 80 - 10;
    return `${x},${y}`;
  }).join(" ");

  if (!values.some((v) => v > 0)) {
    cont.innerHTML = '<div class="report-empty"><i class="fas fa-chart-line"></i><p>No hay evolución de gastos en el período.</p></div>';
    return;
  }

  cont.innerHTML = `
    <svg class="report-line-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
      <defs>
        <linearGradient id="line-gradient" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="#5eead4" stop-opacity="0.9" />
          <stop offset="100%" stop-color="#5eead4" stop-opacity="0.2" />
        </linearGradient>
      </defs>
      <polyline points="${linePoints}" fill="none" stroke="#5eead4" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
      ${evolucion.map((d, index) => {
        const x = (index / Math.max(1, evolucion.length - 1)) * 100;
        const y = 100 - (d.value / maxValue) * 80 - 10;
        return `<circle cx="${x}" cy="${y}" r="2.2" fill="#5eead4" />`;
      }).join("")}
    </svg>
  `;
};

const getTipoOrden = (campo) => {
  const map = {
    fecha: "fechaISO",
    categoria: "categoria",
    proveedor: "proveedorDestino",
    monto: "monto",
    estado: "estado",
    comprobante: "comprobante"
  };
  return map[campo] || campo;
};

const renderizarTablaReportes = (movimientos) => {
  const container = document.getElementById("reportesTableContainer");
  const empty = document.getElementById("reportesEmpty");
  if (!container) return;

  if (!movimientos.length) {
    container.innerHTML = "";
    empty?.classList.remove("hidden");
    return;
  }

  empty?.classList.add("hidden");

  const sortState = window.__reportSort || { campo: "fecha", dir: "desc" };
  const key = getTipoOrden(sortState.campo);
  const ordered = [...movimientos].sort((a, b) => {
    let left = a[key] ?? "";
    let right = b[key] ?? "";
    if (typeof left === "number" && typeof right === "number") {
      return sortState.dir === "asc" ? left - right : right - left;
    }
    left = String(left).toLowerCase();
    right = String(right).toLowerCase();
    return sortState.dir === "asc" ? left.localeCompare(right) : right.localeCompare(left);
  });

  container.innerHTML = `
    <table class="report-table">
      <thead>
        <tr>
          <th data-sort="fecha">Fecha</th>
          <th data-sort="categoria">Categoría</th>
          <th data-sort="proveedor">Proveedor/Destino</th>
          <th data-sort="monto">Monto</th>
          <th data-sort="estado">Estado</th>
          <th data-sort="comprobante">Comprobante</th>
        </tr>
      </thead>
      <tbody>
        ${ordered.map((mov) => `
          <tr>
            <td>${new Date(mov.fechaISO).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" })}</td>
            <td>${mov.categoria}</td>
            <td>${mov.proveedorDestino}</td>
            <td class="${mov.esGasto ? "amount-negative" : "amount-positive"}">${mov.esGasto ? "-" : "+"}${formatearMonto(mov.monto).replace("$", "")}</td>
            <td><span class="report-badge ${mov.estado === "fallido" ? "danger" : mov.estado === "pendiente" ? "warning" : ""}">${mov.estado}</span></td>
            <td>${mov.comprobante}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;

  container.querySelectorAll("th[data-sort]").forEach((header) => {
    header.addEventListener("click", () => {
      const campo = header.dataset.sort;
      const dir = window.__reportSort?.campo === campo && window.__reportSort.dir === "asc" ? "desc" : "asc";
      window.__reportSort = { campo, dir };
      renderizarReporte();
    });
  });
};

const exportarReporteCSV = () => {
  const movimientos = obtenerReportesFiltrados();
  const headers = ["fecha", "categoría", "proveedor/destino", "monto", "estado", "comprobante", "tipo"];
  const csv = [headers.join(",")].concat(movimientos.map((m) => [
    new Date(m.fechaISO).toLocaleDateString("es-AR"),
    m.categoria,
    m.proveedorDestino,
    m.monto,
    m.estado,
    m.comprobante,
    m.tipo
  ].map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","))).join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "reporte-nodo.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
};

const obtenerReportesFiltrados = () => {
  const allMovs = obtenerMovimientosReporte();
  const filters = {
    desde: document.getElementById("reporteDesde")?.value || "",
    hasta: document.getElementById("reporteHasta")?.value || "",
    tipo: document.getElementById("reporteTipo")?.value || "todos",
    categoria: document.getElementById("reporteCategoria")?.value || "todos",
    estado: document.getElementById("reporteEstado")?.value || "todos"
  };
  return aplicarFiltrosReporte(allMovs, filters);
};

const renderizarReporte = () => {
  const movimientos = obtenerReportesFiltrados();
  const fromInput = document.getElementById("reporteDesde");
  const toInput = document.getElementById("reporteHasta");
  const desde = fromInput && fromInput.value ? new Date(`${fromInput.value}T00:00:00`) : obtenerRangoPorDefecto().desde;
  const hasta = toInput && toInput.value ? new Date(`${toInput.value}T23:59:59`) : obtenerRangoPorDefecto().hasta;

  renderizarResumenReporte(movimientos, { desde, hasta });
  renderizarGraficoCategorias(movimientos);
  renderizarGraficoTiempo(movimientos, desde, hasta);
  renderizarTablaReportes(movimientos);
};

const inicializarReportes = () => {
  const section = document.getElementById("section-reportes");
  if (!section) return;

  const { desde, hasta } = obtenerRangoPorDefecto();
  const fromInput = document.getElementById("reporteDesde");
  const toInput = document.getElementById("reporteHasta");
  if (fromInput) fromInput.value = desde.toISOString().slice(0, 10);
  if (toInput) toInput.value = hasta.toISOString().slice(0, 10);

  const movimientos = obtenerMovimientosReporte();
  prepararOpcionesReporte(movimientos);

  ["reporteDesde", "reporteHasta", "reporteTipo", "reporteCategoria", "reporteEstado"].forEach((id) => {
    document.getElementById(id)?.addEventListener("input", renderizarReporte);
    document.getElementById(id)?.addEventListener("change", renderizarReporte);
  });

  document.getElementById("reportExportCsv")?.addEventListener("click", exportarReporteCSV);
  document.getElementById("reportExportPdf")?.addEventListener("click", () => window.print());

  window.__reportSort = { campo: "fecha", dir: "desc" };
  renderizarReporte();
};

const SEGURIDAD_STORAGE_KEY = "nodo_seguridad_config";

const construirConfigSeguridadBase = () => ({
  twoFactorEnabled: false,
  twoFactorMethod: "sms",
  currentPassword: "Nodo2024!",
  questions: [
    { question: "Nombre de tu primera mascota", answer: "Luna" },
    { question: "Ciudad de nacimiento", answer: "Buenos Aires" }
  ],
  sessions: [
    { id: "current-device", name: "Este dispositivo", location: "Buenos Aires, AR", lastAccess: new Date().toISOString(), current: true },
    { id: "laptop-home", name: "MacBook Air", location: "Córdoba, AR", lastAccess: new Date(Date.now() - 86400000 * 2).toISOString(), current: false },
    { id: "iphone-14", name: "iPhone 14", location: "Rosario, AR", lastAccess: new Date(Date.now() - 86400000 * 7).toISOString(), current: false }
  ],
  alerts: {
    newDevice: true,
    largeTx: true,
    profileChange: true,
    channel: "email",
    largeTxThreshold: 50000
  },
  limits: {
    daily: 50000,
    monthly: 200000,
    perTx: 20000
  },
  blockState: {
    account: false,
    card: false
  },
  history: [
    { id: "hist-1", title: "Configuración inicial", detail: "Se activó la seguridad básica del perfil.", timestamp: new Date().toISOString() }
  ]
});

const obtenerSeguridadConfig = () => {
  try {
    const raw = JSON.parse(localStorage.getItem(SEGURIDAD_STORAGE_KEY) || "null");
    const base = construirConfigSeguridadBase();
    if (!raw) return base;
    return {
      ...base,
      ...raw,
      alerts: { ...base.alerts, ...(raw.alerts || {}) },
      limits: { ...base.limits, ...(raw.limits || {}) },
      blockState: { ...base.blockState, ...(raw.blockState || {}) },
      questions: Array.isArray(raw.questions) && raw.questions.length ? raw.questions : base.questions,
      sessions: Array.isArray(raw.sessions) && raw.sessions.length ? raw.sessions : base.sessions,
      history: Array.isArray(raw.history) && raw.history.length ? raw.history : base.history
    };
  } catch (error) {
    console.warn("No se pudo cargar la configuración de seguridad:", error);
    return construirConfigSeguridadBase();
  }
};

const guardarSeguridadConfig = (config) => {
  localStorage.setItem(SEGURIDAD_STORAGE_KEY, JSON.stringify(config));
};

const agregarEventoSeguridad = (titulo, detalle) => {
  const config = obtenerSeguridadConfig();
  const item = {
    id: `seg-${Date.now()}`,
    title: titulo,
    detail: detalle,
    timestamp: new Date().toISOString()
  };
  config.history = [item, ...(config.history || [])].slice(0, 10);
  guardarSeguridadConfig(config);
};

const calcularFortalezaPassword = (value) => {
  let score = 0;
  if (value.length >= 8) score += 1;
  if (/[A-Z]/.test(value)) score += 1;
  if (/[a-z]/.test(value)) score += 1;
  if (/\d/.test(value)) score += 1;
  if (/[^A-Za-z0-9]/.test(value)) score += 1;
  return score;
};

const obtenerLabelFortaleza = (score) => {
  if (score <= 1) return "Débil";
  if (score === 2) return "Aceptable";
  if (score === 3) return "Buena";
  if (score === 4) return "Fuerte";
  return "Muy fuerte";
};

const calcularNivelSeguridad = (config) => {
  let points = 0;
  if (config.twoFactorEnabled) points += 25;
  if (calcularFortalezaPassword(config.currentPassword || "") >= 4) points += 20;
  if ((config.questions || []).length >= 2) points += 20;
  if ((config.alerts && Object.values(config.alerts).some(Boolean)) || (config.alerts && config.alerts.channel)) points += 15;
  if ((config.limits && (config.limits.daily > 0 || config.limits.monthly > 0 || config.limits.perTx > 0))) points += 10;
  if ((config.sessions || []).length > 1) points += 10;
  if (!(config.blockState && config.blockState.account)) points += 5;

  const score = Math.min(100, points);
  if (score < 45) return { label: "Básico", score };
  if (score < 75) return { label: "Medio", score };
  return { label: "Alto", score };
};

const renderSeguridadOverview = () => {
  const config = obtenerSeguridadConfig();
  const nivel = calcularNivelSeguridad(config);
  const scoreValue = document.getElementById("seguridadScoreValue");
  const scoreRing = document.querySelector(".seguridad-score-ring");
  const nivelText = document.getElementById("seguridadNivelTexto");
  const nivelBadge = document.getElementById("seguridadNivel");
  const checklist = document.getElementById("seguridadChecklist");

  if (scoreValue) scoreValue.textContent = `${nivel.score}%`;
  if (nivelText) nivelText.textContent = nivel.label;
  if (nivelBadge) nivelBadge.textContent = `Nivel: ${nivel.label}`;
  if (scoreRing) {
    const degrees = (nivel.score / 100) * 360;
    scoreRing.style.background = `conic-gradient(#34d399 0deg ${degrees}deg, rgba(148, 163, 184, 0.2) ${degrees}deg 360deg)`;
  }

  const checks = [
    { title: "2FA activo", ok: !!config.twoFactorEnabled },
    { title: "Contraseña segura", ok: calcularFortalezaPassword(config.currentPassword || "") >= 4 },
    { title: "Preguntas guardadas", ok: (config.questions || []).length >= 2 },
    { title: "Alertas activas", ok: Boolean(config.alerts && (config.alerts.newDevice || config.alerts.largeTx || config.alerts.profileChange)) },
    { title: "Límites definidos", ok: Boolean(config.limits && (config.limits.daily > 0 || config.limits.monthly > 0 || config.limits.perTx > 0)) },
    { title: "Sesiones revisadas", ok: (config.sessions || []).length > 1 }
  ];

  checklist.innerHTML = checks.map((check) => `
    <div class="seguridad-check-item ${check.ok ? "success" : "error"}">
      <span class="seguridad-check-icon">${check.ok ? "✓" : "✕"}</span>
      <span>${check.title}</span>
    </div>
  `).join("");
};

const renderSeguridadForms = () => {
  const config = obtenerSeguridadConfig();

  const toggle = document.getElementById("seguridad2faToggle");
  const methodSelect = document.getElementById("seguridad2faMethod");
  const panel = document.getElementById("seguridad2faPanel");
  const alertChannel = document.getElementById("seguridadAlertChannel");
  const alertNewDevice = document.getElementById("alertNewDevice");
  const alertLargeTx = document.getElementById("alertLargeTx");
  const alertProfileChange = document.getElementById("alertProfileChange");
  const dailyLimit = document.getElementById("seguridadDailyLimit");
  const monthlyLimit = document.getElementById("seguridadMonthlyLimit");
  const perTxLimit = document.getElementById("seguridadPerTxLimit");
  const question1 = document.getElementById("seguridadQuestion1");
  const answer1 = document.getElementById("seguridadAnswer1");
  const question2 = document.getElementById("seguridadQuestion2");
  const answer2 = document.getElementById("seguridadAnswer2");

  if (toggle) toggle.checked = !!config.twoFactorEnabled;
  if (methodSelect) methodSelect.value = config.twoFactorMethod || "sms";
  if (panel) panel.classList.toggle("hidden", !config.twoFactorEnabled);
  if (alertChannel) alertChannel.value = config.alerts?.channel || "email";
  if (alertNewDevice) alertNewDevice.checked = !!config.alerts?.newDevice;
  if (alertLargeTx) alertLargeTx.checked = !!config.alerts?.largeTx;
  if (alertProfileChange) alertProfileChange.checked = !!config.alerts?.profileChange;
  if (dailyLimit) dailyLimit.value = config.limits?.daily || 0;
  if (monthlyLimit) monthlyLimit.value = config.limits?.monthly || 0;
  if (perTxLimit) perTxLimit.value = config.limits?.perTx || 0;
  if (question1) question1.value = config.questions?.[0]?.question || "";
  if (answer1) answer1.value = config.questions?.[0]?.answer || "";
  if (question2) question2.value = config.questions?.[1]?.question || "";
  if (answer2) answer2.value = config.questions?.[1]?.answer || "";

  const statusBadge = document.getElementById("seguridadBlockStatus");
  const unlockBtn = document.getElementById("seguridadUnlockBtn");
  const blockAccountBtn = document.getElementById("seguridadBlockAccountBtn");
  if (statusBadge) {
    const blocked = config.blockState?.account || config.blockState?.card;
    statusBadge.textContent = blocked ? "Cuenta bloqueada" : "Cuenta desbloqueada";
    statusBadge.classList.toggle("blocked", blocked);
  }
  if (unlockBtn) unlockBtn.classList.toggle("hidden", !(config.blockState?.account || config.blockState?.card));
  if (blockAccountBtn) blockAccountBtn.textContent = config.blockState?.account ? "Cuenta bloqueada" : "Bloquear cuenta";
};

const renderSeguridadSessions = () => {
  const config = obtenerSeguridadConfig();
  const list = document.getElementById("seguridadSessionsList");
  if (!list) return;

  const sessions = config.sessions || [];
  list.innerHTML = sessions.map((device) => `
    <div class="seguridad-session-item ${device.current ? "current" : ""}">
      <div class="seguridad-session-main">
        <div class="seguridad-session-icon"><i class="fas ${device.current ? "fa-laptop" : "fa-mobile-alt"}"></i></div>
        <div class="seguridad-session-meta">
          <strong>${device.name}</strong>
          <span>${device.location} • ${new Date(device.lastAccess).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
        </div>
      </div>
      ${device.current ? "" : '<button type="button" class="btn-secondary btn-small" data-close-session="' + device.id + '">Cerrar sesión</button>'}
    </div>
  `).join("");

  list.querySelectorAll("[data-close-session]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.closeSession;
      const next = obtenerSeguridadConfig();
      const filtered = (next.sessions || []).filter((session) => session.id !== id);
      next.sessions = filtered;
      guardarSeguridadConfig(next);
      agregarEventoSeguridad("Sesión cerrada", `Se cerró una sesión activa de un dispositivo no autorizado.`);
      renderSeguridad();
    });
  });
};

const renderSeguridadHistory = () => {
  const list = document.getElementById("seguridadHistoryList");
  if (!list) return;
  const config = obtenerSeguridadConfig();
  list.innerHTML = (config.history || []).map((event) => `
    <div class="seguridad-history-item">
      <strong>${event.title}</strong>
      <span>${event.detail}</span>
      <span>${new Date(event.timestamp).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
    </div>
  `).join("");
};

const renderSeguridad = () => {
  renderSeguridadOverview();
  renderSeguridadForms();
  renderSeguridadSessions();
  renderSeguridadHistory();
};

const inicializarSeguridad = () => {
  const section = document.getElementById("section-seguridad");
  if (!section) return;

  renderSeguridad();

  const strengthBar = document.getElementById("seguridadStrengthBar");
  const strengthLabel = document.getElementById("seguridadStrengthLabel");
  const passwordInput = document.getElementById("seguridadNewPassword");
  const currentPasswordInput = document.getElementById("seguridadCurrentPassword");

  if (passwordInput) {
    passwordInput.addEventListener("input", () => {
      const score = calcularFortalezaPassword(passwordInput.value);
      const width = Math.max((score / 5) * 100, 0);
      if (strengthBar) strengthBar.style.width = `${width}%`;
      if (strengthLabel) strengthLabel.textContent = obtenerLabelFortaleza(score);
    });
  }

  document.getElementById("seguridadPasswordForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const config = obtenerSeguridadConfig();
    const current = document.getElementById("seguridadCurrentPassword")?.value || "";
    const next = document.getElementById("seguridadNewPassword")?.value || "";
    const confirm = document.getElementById("seguridadConfirmPassword")?.value || "";

    if (!current || !next || !confirm) {
      showToast("Completá todos los campos de contraseña", 3000, "error");
      return;
    }

    if (current !== config.currentPassword) {
      showToast("La contraseña actual no coincide", 3000, "error");
      return;
    }

    const score = calcularFortalezaPassword(next);
    if (score < 4) {
      showToast("La contraseña debe incluir mayúsculas, números y símbolos", 3500, "error");
      return;
    }

    if (next !== confirm) {
      showToast("Las contraseñas nuevas no coinciden", 3000, "error");
      return;
    }

    config.currentPassword = next;
    agregarEventoSeguridad("Contraseña actualizada", "Se cambió la contraseña principal de la cuenta.");
    guardarSeguridadConfig(config);
    event.target.reset();
    renderSeguridad();
    showToast("Contraseña actualizada con éxito", 3000, "success");
  });

  document.getElementById("seguridad2faToggle")?.addEventListener("change", (event) => {
    const config = obtenerSeguridadConfig();
    config.twoFactorEnabled = event.target.checked;
    guardarSeguridadConfig(config);
    agregarEventoSeguridad(config.twoFactorEnabled ? "2FA activado" : "2FA desactivado", `Se ${config.twoFactorEnabled ? "activó" : "desactivó"} la autenticación en dos pasos.`);
    renderSeguridad();
  });

  document.getElementById("seguridadConfig2faBtn")?.addEventListener("click", () => {
    const config = obtenerSeguridadConfig();
    const method = document.getElementById("seguridad2faMethod")?.value || "sms";
    config.twoFactorMethod = method;
    const code = "123456";
    const enteredCode = window.prompt(`Código simulado de verificación\nMétodo: ${method}\nCódigo: ${code}\nIngresá el código recibido:`, "");
    if (enteredCode === code || enteredCode === String(code)) {
      config.twoFactorEnabled = true;
      guardarSeguridadConfig(config);
      agregarEventoSeguridad("2FA configurado", `Se configuró la autenticación por ${method}.`);
      renderSeguridad();
      showToast("2FA configurado correctamente", 3000, "success");
    } else {
      showToast("Código de verificación inválido", 3000, "error");
    }
  });

  document.getElementById("seguridadQuestionsForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const q1 = document.getElementById("seguridadQuestion1")?.value.trim();
    const a1 = document.getElementById("seguridadAnswer1")?.value.trim();
    const q2 = document.getElementById("seguridadQuestion2")?.value.trim();
    const a2 = document.getElementById("seguridadAnswer2")?.value.trim();
    if (!q1 || !a1 || !q2 || !a2) {
      showToast("Completá las preguntas y respuestas", 3000, "error");
      return;
    }
    const config = obtenerSeguridadConfig();
    config.questions = [
      { question: q1, answer: a1 },
      { question: q2, answer: a2 }
    ];
    guardarSeguridadConfig(config);
    agregarEventoSeguridad("Preguntas de seguridad guardadas", "Se actualizaron las preguntas de recuperación.");
    renderSeguridad();
    showToast("Preguntas de seguridad actualizadas", 3000, "success");
  });

  document.getElementById("seguridadCerrarSesionesBtn")?.addEventListener("click", () => {
    const config = obtenerSeguridadConfig();
    config.sessions = config.sessions.filter((session) => session.current);
    guardarSeguridadConfig(config);
    agregarEventoSeguridad("Sesiones cerradas", "Se cerraron las sesiones restantes y quedó solo la sesión actual.");
    renderSeguridad();
    showToast("Se cerraron las demás sesiones", 3000, "success");
  });

  ["alertNewDevice", "alertLargeTx", "alertProfileChange"].forEach((id) => {
    document.getElementById(id)?.addEventListener("change", () => {
      const config = obtenerSeguridadConfig();
      config.alerts = {
        ...config.alerts,
        newDevice: document.getElementById("alertNewDevice")?.checked ?? config.alerts.newDevice,
        largeTx: document.getElementById("alertLargeTx")?.checked ?? config.alerts.largeTx,
        profileChange: document.getElementById("alertProfileChange")?.checked ?? config.alerts.profileChange,
        channel: document.getElementById("seguridadAlertChannel")?.value || config.alerts.channel
      };
      guardarSeguridadConfig(config);
      agregarEventoSeguridad("Alertas actualizadas", "Se cambiaron las preferencias de seguridad y notificaciones.");
      renderSeguridad();
    });
  });

  document.getElementById("seguridadAlertChannel")?.addEventListener("change", () => {
    const config = obtenerSeguridadConfig();
    config.alerts = { ...config.alerts, channel: document.getElementById("seguridadAlertChannel")?.value || "email" };
    guardarSeguridadConfig(config);
    agregarEventoSeguridad("Canal de alertas actualizado", `Nuevo canal: ${config.alerts.channel}.`);
    renderSeguridad();
  });

  document.getElementById("seguridadLimitsForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const config = obtenerSeguridadConfig();
    config.limits = {
      daily: Number(document.getElementById("seguridadDailyLimit")?.value || 0),
      monthly: Number(document.getElementById("seguridadMonthlyLimit")?.value || 0),
      perTx: Number(document.getElementById("seguridadPerTxLimit")?.value || 0)
    };
    guardarSeguridadConfig(config);
    agregarEventoSeguridad("Límites de transacciones guardados", "Se actualizó la configuración de seguridad financiera.");
    renderSeguridad();
    showToast("Límites guardados", 3000, "success");
  });

  document.getElementById("seguridadBlockAccountBtn")?.addEventListener("click", () => {
    const config = obtenerSeguridadConfig();
    const confirmed = window.confirm("¿Estás seguro de querer bloquear la cuenta?");
    if (!confirmed) return;
    config.blockState = { ...config.blockState, account: true };
    guardarSeguridadConfig(config);
    agregarEventoSeguridad("Cuenta bloqueada", "La cuenta fue bloqueada por decisión del usuario.");
    renderSeguridad();
    showToast("Cuenta bloqueada", 3000, "warning");
  });

  document.getElementById("seguridadBlockCardBtn")?.addEventListener("click", () => {
    const config = obtenerSeguridadConfig();
    const confirmed = window.confirm("¿Estás seguro de querer bloquear la tarjeta?");
    if (!confirmed) return;
    config.blockState = { ...config.blockState, card: true };
    guardarSeguridadConfig(config);
    agregarEventoSeguridad("Tarjeta bloqueada", "La tarjeta fue bloqueada por seguridad.");
    renderSeguridad();
    showToast("Tarjeta bloqueada", 3000, "warning");
  });

  document.getElementById("seguridadUnlockBtn")?.addEventListener("click", () => {
    const config = obtenerSeguridadConfig();
    const confirmed = window.confirm("¿Deseas desbloquear la cuenta y la tarjeta?");
    if (!confirmed) return;
    config.blockState = { account: false, card: false };
    guardarSeguridadConfig(config);
    agregarEventoSeguridad("Cuenta desbloqueada", "Se restauró el acceso de la cuenta y la tarjeta.");
    renderSeguridad();
    showToast("Cuenta desbloqueada", 3000, "success");
  });

  if (currentPasswordInput) {
    currentPasswordInput.value = "";
  }
  if (passwordInput) {
    passwordInput.value = "";
  }
  if (strengthBar) strengthBar.style.width = "0%";
  if (strengthLabel) strengthLabel.textContent = "Débil";
};

// ── Inicialización y Event Listeners ──
document.addEventListener("DOMContentLoaded", () => {
  actualizarSaldoBadgeRecarga();

  // Actualizar saldo badge cada vez que la sección Recargas se hace visible
  const _secRecargas = document.getElementById("section-recargas");
  if (_secRecargas) {
    new MutationObserver(() => {
      if (_secRecargas.classList.contains("active")) actualizarSaldoBadgeRecarga();
    }).observe(_secRecargas, { attributes: true, attributeFilter: ["class"] });
  }

  // 1. Botón de acceso rápido en el balance hero
  const btnShortcut = document.getElementById("btn-recarga-shortcut");
  if (btnShortcut) {
    btnShortcut.addEventListener("click", openRecargaModal);
  }

  // 2. Botón de cierre del modal
  document.getElementById("closeRecargaModal")?.addEventListener("click", closeRecargaModal);

  // Cerrar al hacer clic en el backdrop oscuro
  document.getElementById("recargaModal")?.addEventListener("click", (e) => {
    if (e.target.id === "recargaModal") closeRecargaModal();
  });

  // 3. Selección de Operador
  const operatorCards = document.querySelectorAll(".operator-card");
  operatorCards.forEach(card => {
    card.addEventListener("click", () => {
      operatorCards.forEach(c => c.classList.remove("selected"));
      card.classList.add("selected");
      recargaOperador = card.dataset.operator;
      validarFormularioRecarga();
    });
  });

  // 4. Input Telefónico con formateo en tiempo real
  const phoneInput = document.getElementById("recargaTelefono");
  if (phoneInput) {
    phoneInput.addEventListener("input", () => {
      // Extraer únicamente los dígitos, permitiendo hasta 12 en vez de fijar 10 exactos
      const digitsOnly = phoneInput.value.replace(/\D/g, "").slice(0, 12);
      recargaNumero = digitsOnly;
      phoneInput.value = formatearNumeroArgentino(digitsOnly);
      validarFormularioRecarga();
    });

    phoneInput.addEventListener("blur", () => {
      validarFormularioRecarga();
    });
  }

  // 5. Selector de Montos Rápidos
  const amountChips = document.querySelectorAll(".amount-chip");
  const customBox = document.getElementById("customAmountBox");
  const customInput = document.getElementById("recargaMontoCustom");

  amountChips.forEach(chip => {
    chip.addEventListener("click", () => {
      amountChips.forEach(c => c.classList.remove("selected"));
      chip.classList.add("selected");
      recargaMonto = Number(chip.dataset.amount);

      // Ocultar y limpiar monto personalizado si estaba abierto
      if (customBox) customBox.classList.add("hidden");
      if (customInput) customInput.value = "";

      validarFormularioRecarga();
    });
  });

  // 6. Opción Monto Personalizado
  const btnCustomToggle = document.getElementById("btnCustomAmountToggle");
  if (btnCustomToggle) {
    btnCustomToggle.addEventListener("click", () => {
      amountChips.forEach(c => c.classList.remove("selected"));
      customBox?.classList.remove("hidden");
      customInput?.focus();
      recargaMonto = Number(customInput?.value.replace(/\D/g, "") || 0);
      validarFormularioRecarga();
    });
  }

  if (customInput) {
    customInput.addEventListener("input", () => {
      const val = customInput.value.replace(/\D/g, "").slice(0, 6);
      const num = Number(val);
      customInput.value = val ? num.toLocaleString("es-AR") : "";
      recargaMonto = num;
      amountChips.forEach(c => c.classList.remove("selected"));
      validarFormularioRecarga();
    });
  }

  // 7. Botones de Navegación del Modal
  document.getElementById("btnRecargaContinuar")?.addEventListener("click", irAConfirmacion);
  document.getElementById("btnRecargaVolver")?.addEventListener("click", volverAlInicioRecarga);
  document.getElementById("btnRecargaVolverPaso1")?.addEventListener("click", volverAlInicioRecarga);
  document.getElementById("btnConfirmarRecarga")?.addEventListener("click", procesarRecarga);

  // Botones de pantalla de error
  document.getElementById("btnRecargaErrorReintentar")?.addEventListener("click", volverAlInicioRecarga);
  document.getElementById("btnRecargaErrorCerrar")?.addEventListener("click", volverAlInicioRecarga);

  // Botones de pantalla de éxito
  document.getElementById("btnRecargaSuccessDescargar")?.addEventListener("click", descargarComprobanteRecarga);
  document.getElementById("btnRecargaSuccessNueva")?.addEventListener("click", nuevaRecarga);
  document.getElementById("btnRecargaSuccessListo")?.addEventListener("click", volverAlInicioRecarga);

  // Copiar número de comprobante al portapapeles
  document.getElementById("btnCopyComprobanteRecarga")?.addEventListener("click", () => {
    if (recargaComprobante) {
      if (typeof copiarAlPortapapeles === "function") {
        copiarAlPortapapeles(recargaComprobante);
      } else {
        navigator.clipboard.writeText(recargaComprobante);
      }
    }
  });

  // Restaurar saldo guardado en localStorage si no vino del backend
  const savedSaldo = localStorage.getItem("nodo_saldo_override");
  if (savedSaldo !== null && !isNaN(Number(savedSaldo))) {
    if (typeof saldoActual === "number" && saldoActual === 0) {
      saldoActual = Number(savedSaldo);
      if (typeof actualizarDisplaySaldo === "function") actualizarDisplaySaldo();
    }
  }

  // Restaurar movimientos guardados localmente si los hubiere
  try {
    const localMovs = JSON.parse(localStorage.getItem("nodo_recargas_movimientos") || "[]");
    localMovs.forEach(mov => insertarMovimientoEnDOM(mov));
  } catch {}

  inicializarReportes();
});

