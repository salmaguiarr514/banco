document.addEventListener('DOMContentLoaded', async () => {
  const KEYS = {
    inicio:    'nodo_tour_inicio_v1',
    dolares:   'nodo_tour_dolares_v1',
    tarjetas:  'nodo_tour_tarjetas_v1',
    prestamos: 'nodo_tour_prestamos_v1',
    finanzas:  'nodo_tour_finanzas_v1',
    recargas:  'nodo_tour_recargas_v1',
  };

  const STEPS = {
    inicio: [
      {
        sel: '#balanceHero',
        title: 'Tu balance principal',
        text: 'Acá ves tu saldo en pesos y dólares. Tocá el ojo para mostrarlo u ocultarlo cuando estés en público.',
      },
      {
        sel: '.balance-actions',
        title: 'Acciones rápidas',
        text: 'Ingresá dinero, transferí pesos, pagá con QR o sincronizá tu saldo. Todo con un solo toque.',
      },
      {
        sel: '#btn-transfer-shortcut',
        title: 'Transferir',
        text: 'Enviá pesos a cualquier CBU o alias del país en segundos, sin comisiones.',
      },
      {
        sel: '#actividadCard',
        title: 'Tu actividad',
        text: 'Expandí este panel para ver todos tus movimientos: depósitos, transferencias y pagos recientes.',
      },
      {
        sel: '.sidebar-nav-list',
        title: 'Explorá NODO',
        text: 'Desde el menú lateral accedés a Tarjetas, Préstamos, Inversiones, Recargas y más. ¡Todo en un solo lugar!',
      },
    ],

    tarjetas: [
      {
        sel: '#section-tarjetas > .card',
        title: 'Tarjeta Visa Débito Virtual',
        text: 'Tu tarjeta virtual NODO. Los datos son seguros: número y CVV se revelan solo cuando los necesitás.',
      },
      {
        sel: '#emitirTarjetaBtn',
        title: 'Emitir tarjeta',
        text: 'Todavía no tenés tarjeta. Tocá este botón para emitir tu tarjeta virtual Visa Débito al instante, sin costo.',
      },
      {
        sel: '.card-controls-grid',
        title: 'Controles',
        text: 'Ver los datos completos, bloquear temporalmente si la perdés, o simular un pago para probar cómo funciona.',
      },
      {
        sel: '.card-tx-section',
        title: 'Historial de pagos',
        text: 'Todos los pagos realizados con tu tarjeta, ordenados del más reciente al más antiguo.',
      },
    ],

    prestamos: [
      {
        sel: '.ptab-bar',
        title: 'Simular o gestionar',
        text: 'Alternás entre el simulador para calcular cuotas y "Mis Préstamos" para ver los que ya tenés activos.',
      },
      {
        sel: '#prestamoInputWrap',
        title: 'Elegí el monto',
        text: 'Escribí el monto o usá el slider. El sistema calcula las cuotas en tiempo real mientras ajustás.',
      },
      {
        sel: '.prestamo-pills',
        title: 'Plazo en cuotas',
        text: 'Elegí entre 3, 6, 12, 24 o 36 cuotas. A más cuotas, cuota mensual más baja pero mayor costo total.',
      },
      {
        sel: '.prestamo-col-results',
        title: 'Resumen de costos',
        text: 'Cuota mensual estimada, TNA, TEA, intereses y CFT antes de solicitar. Sin sorpresas ni letras chicas.',
      },
    ],

    finanzas: [
      {
        sel: '#section-finanzas .two-col-cards',
        title: 'Tus finanzas personales',
        text: 'Dos herramientas en un panel: reservas para tus metas de ahorro y el análisis de gastos por categoría.',
      },
      {
        sel: '#section-finanzas .two-col-cards > .card:first-child',
        title: 'Mis Reservas',
        text: 'Separá dinero para objetivos concretos: vacaciones, fondo de emergencia, tecnología. Cada reserva tiene nombre, plazo y monto.',
      },
      {
        sel: '#section-finanzas .two-col-cards > .card:last-child',
        title: 'Gastos por categoría',
        text: 'El gráfico muestra en qué categorías gastás más. Identificá hábitos y ajustá tu presupuesto mes a mes.',
      },
    ],

    dolares: [
      {
        sel: '#heroUSD',
        title: 'Tu cuenta en dólares',
        text: 'Desde acá manejás tu caja de ahorro en USD. Cambiá entre ARS y dólares usando las pestañas de arriba.',
      },
      {
        sel: '#btnAbrirUSD',
        title: 'Abrir cuenta USD',
        text: 'Todavía no tenés cuenta en dólares. Con un toque la abrís al instante: te asignamos un CBU y alias propios en USD.',
      },
      {
        sel: '#heroUSDCon',
        title: 'Tu saldo en dólares',
        text: 'Ves tu balance en USD y su equivalente en pesos. Tocá el ojo para ocultarlo.',
      },
      {
        sel: '.balance-actions-usd',
        title: 'Operaciones en USD',
        text: '<b>Comprar:</b> convertís pesos a dólares al tipo de cambio blue de referencia.<br><b>Vender:</b> convertís tus dólares a pesos.<br><b>Transferir:</b> enviás USD a otro CBU o alias en dólares.',
      },
      {
        sel: '#usdCotizaciones',
        title: 'Cotizaciones en vivo',
        text: 'Seguí el dólar blue, oficial, MEP y más, actualizados en tiempo real para que tomes decisiones informadas.',
      },
    ],

    recargas: [
      {
        sel: '#recargasSectionCard',
        title: 'Recargar celular',
        text: 'Cargá saldo en cualquier línea de Movistar, Personal, Claro o Tuenti. La acreditación es inmediata.',
      },
      {
        sel: '.operators-grid',
        title: 'Elegí el operador',
        text: 'Seleccioná el operador de la línea a recargar. Si no sabés cuál es, chequeá en Ajustes del celular.',
      },
      {
        sel: '.recarga-section-label',
        title: 'Número y monto',
        text: 'Ingresá el número sin el 15 y elegí el monto. Podés guardar números frecuentes para recargar más rápido la próxima vez.',
      },
    ],
  };

  // ── Estado guardado en Supabase (cross-device) + localStorage como caché ──
  let _meta = {};

  const _loadMeta = async () => {
    try {
      const { data: { user } } = await _supabase.auth.getUser();
      _meta = user?.user_metadata || {};
      // Sincronizar caché local
      Object.values(KEYS).forEach(k => { if (_meta[k]) localStorage.setItem(k, '1'); });
    } catch {
      // Sin sesión: usar solo localStorage
      Object.values(KEYS).forEach(k => { if (localStorage.getItem(k)) _meta[k] = '1'; });
    }
  };

  const _seen = (key) => _meta[key] === '1' || localStorage.getItem(key) === '1';

  const _markSeen = async (key) => {
    localStorage.setItem(key, '1');
    _meta[key] = '1';
    try { await _supabase.auth.updateUser({ data: { [key]: '1' } }); } catch {}
  };

  await _loadMeta();

  const startTour = (section) => {
    const steps = STEPS[section];
    if (!steps) return;
    NodoTour.start(steps, { onEnd: () => _markSeen(KEYS[section]) });
  };

  // Botón Ayuda en el header — lanza el tour de la sección activa
  const headerAyudaBtn = document.getElementById('headerAyudaBtn');
  if (headerAyudaBtn) {
    headerAyudaBtn.addEventListener('click', () => {
      const activeSection = document.querySelector('.content-section.active');
      const sectionId = activeSection?.id?.replace('section-', '') || 'inicio';
      startTour(sectionId);
    });
  }

  // El tour de dólares se lanza automáticamente al clickear la pestaña USD por primera vez.

  // Auto-lanzar al entrar a cada sección por primera vez
  document.querySelectorAll('.sidebar-nav-item[data-section]').forEach(btn => {
    btn.addEventListener('click', () => {
      const s = btn.dataset.section;
      if (s === 'inversiones') return;
      if (KEYS[s] && !_seen(KEYS[s])) {
        setTimeout(() => startTour(s), 800);
      }
    });
  });

  // Auto-lanzar tour dólares al clickear la pestaña USD
  document.getElementById('tabUSD')?.addEventListener('click', () => {
    if (!_seen(KEYS.dolares)) {
      setTimeout(() => startTour('dolares'), 500);
    }
  });

  // Auto-lanzar tour inicio en el primer acceso
  if (!_seen(KEYS.inicio)) {
    setTimeout(() => startTour('inicio'), 1200);
  }
});
