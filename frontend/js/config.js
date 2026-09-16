const API_URL = "http://localhost:3000/api";

// â”€â”€ Tema claro / oscuro â”€â”€
const THEME_KEY = 'nodo_theme';
const applyTheme = (theme) => {
  document.documentElement.setAttribute('data-theme', theme);
  document.querySelectorAll('.btn-theme-toggle').forEach(btn => {
    btn.innerHTML = theme === 'dark' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
    btn.title = theme === 'dark' ? 'Modo claro' : 'Modo oscuro';
  });
  // Actualizar color de la red de nodos del dashboard
  window.dashNet?.setColor(theme === 'dark' ? 'rgba(148,163,184,' : 'rgba(30,41,59,');
  localStorage.setItem(THEME_KEY, theme);
};
const toggleTheme = () => applyTheme(
  document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'
);
applyTheme(localStorage.getItem(THEME_KEY) || 'light');

// InicializaciÃ³n de Supabase Client
// Reemplaza estas cadenas con la URL y la Anon Key de TU PROPIO proyecto de Supabase (Settings -> API)
const SUPABASE_URL = 'https://fjbjqetnyrhvbbrymhde.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_bG5yTGeEYFH5t2g2x619jQ_VxG6xXpj';
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const output = document.getElementById("output");
const saldoList = document.getElementById("saldoList");
const movimientosList = document.getElementById("movimientosList");
const logoutBtn = document.getElementById("logoutBtn");

const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const transferForm = document.getElementById("transferForm");

const loadMovimientosBtn = document.getElementById("loadMovimientosBtn");

// Global para manejo de saldo oculto
let saldoActual = 0;
let saldoOculto = true;
// Variables globales para la cuenta activa
let cuentaActiva = null;
// Variable para guardar el CBU verificado
let cbuDestinoVerificado = "";
// Objeto para guardar info completa del destinatario validado
let destinatarioValidado = null;
// Instancia del escÃ¡ner
let html5QrCode = null;

const tabs = document.querySelectorAll(".tab");

const debounce = (fn, delay) => {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
};

// â”€â”€ BotÃ³n loading â”€â”€
const btnLoad = (btn, on) => {
  if (!btn) return;
  if (on) {
    btn._origHTML = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    btn.disabled = true;
    btn.classList.add('btn-loading');
  } else {
    btn.innerHTML = btn._origHTML ?? btn.innerHTML;
    btn.disabled = false;
    btn.classList.remove('btn-loading');
  }
};
const formLoad = (form, on) => btnLoad(form?.querySelector('button[type="submit"]'), on);

// â”€â”€ Toast â”€â”€
const showToast = (msg, duration = 3500, type = 'success') => {
  const toast    = document.getElementById('syncToast');
  const toastMsg = document.getElementById('syncToastMsg');
  const toastIcon = toast?.querySelector('i');
  if (!toast || !toastMsg) return;

  const icons = { success: 'fas fa-check-circle', info: 'fas fa-info-circle', error: 'fas fa-exclamation-circle' };
  if (toastIcon) toastIcon.className = icons[type] || icons.success;

  toast.className = `sync-toast sync-toast--${type}`;
  toastMsg.textContent = msg;
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.add('hidden'), duration);
};

const setOutput = (data) => {
  if (output) {
    output.textContent = typeof data === "string" ? data : JSON.stringify(data, null, 2);
  } else if (typeof data === "string" || data.message) {
    console.error("Error de API:", data);
  }
};

// â”€â”€ Card Engine â”€â”€
let tarjetaActiva = null;
let payCardCBUVerificado = '';

