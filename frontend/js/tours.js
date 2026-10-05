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
        info: 'El saldo se actualiza automáticamente cada 45 segundos. Podés tener cuenta en ARS y USD al mismo tiempo. Tu CBU y alias aparecen debajo del balance para compartirlos fácilmente.',
      },
      {
        sel: '.balance-actions',
        title: 'Acciones rápidas',
        text: 'Ingresá dinero, transferí pesos, pagá con QR o sincronizá tu saldo. Todo con un solo toque.',
        info: '<b>Depositar:</b> acreditación instantánea desde cualquier banco.<br><b>Transferir:</b> enviás a cualquier CBU o alias del país.<br><b>Pagar QR:</b> compatible con QRs DEBIN y CBU directo.<br><b>Sincronizar:</b> trae transferencias recibidas desde otros bancos.',
      },
      {
        sel: '#btn-transfer-shortcut',
        title: 'Transferir',
        text: 'Enviá pesos a cualquier CBU o alias del país en segundos, sin comisiones.',
        info: 'El CBU tiene 22 dígitos y el alias es tipo <i>nombre.apellido.banco</i>. La transferencia se procesa en tiempo real a través del Banco Central. No tiene costo ni límite diario.',
      },
      {
        sel: '#actividadCard',
        title: 'Tu actividad',
        text: 'Expandí este panel para ver todos tus movimientos: depósitos, transferencias y pagos recientes.',
        info: 'Podés filtrar por ingresos o egresos y buscar por descripción o monto. Los movimientos se actualizan solos cada 45 segundos. Los ingresos aparecen en verde y los egresos en rojo.',
      },
      {
        sel: '.sidebar-nav-list',
        title: 'Explorá NODO',
        text: 'Desde el menú lateral accedés a Tarjetas, Préstamos, Inversiones, Recargas y más. ¡Todo en un solo lugar!',
        info: '<b>Tarjetas:</b> Visa Débito Virtual gratuita.<br><b>Préstamos:</b> simulador con TNA, TEA y cuotas.<br><b>Inversiones:</b> rendimientos sobre tu saldo.<br><b>Recargas:</b> Movistar, Personal, Claro y Tuenti.',
      },
    ],

    tarjetas: [
      {
        sel: '#section-tarjetas > .card',
        title: 'Tarjeta Visa Débito Virtual',
        text: 'Tu tarjeta virtual NODO. Los datos son seguros: número y CVV se revelan solo cuando los necesitás.',
        info: 'La tarjeta funciona en cualquier comercio online que acepte Visa. Si la bloqueás temporalmente, el número no se cancela: se reactiva cuando vos querés.',
      },
      {
        sel: '#emitirTarjetaBtn',
        title: 'Emitir tarjeta',
        text: 'Todavía no tenés tarjeta. Tocá este botón para emitir tu tarjeta virtual Visa Débito al instante, sin costo.',
        info: 'La emisión es gratuita e instantánea. Una vez emitida podés usarla para compras online, suscripciones y pagos digitales. No tiene fecha de vencimiento física.',
      },
      {
        sel: '.card-controls-grid',
        title: 'Controles',
        text: 'Ver los datos completos, bloquear temporalmente si la perdés, o simular un pago para probar cómo funciona.',
        info: '<b>Bloqueo temporal:</b> suspende la tarjeta sin cancelarla. <b>Ver datos:</b> muestra número, vencimiento y CVV de forma segura. <b>Pago de prueba:</b> no descuenta dinero real, es solo para testear.',
      },
      {
        sel: '.card-tx-section',
        title: 'Historial de pagos',
        text: 'Todos los pagos realizados con tu tarjeta, ordenados del más reciente al más antiguo.',
        info: 'Cada transacción muestra el comercio, monto y fecha. El historial se actualiza en tiempo real con cada compra.',
      },
    ],

    prestamos: [
      {
        sel: '.ptab-bar',
        title: 'Simular o gestionar',
        text: 'Alternás entre el simulador para calcular cuotas y "Mis Préstamos" para ver los que ya tenés activos.',
        info: '<b>Simular:</b> calculá cuotas y costos antes de comprometerte, sin impacto en tu historial. <b>Mis Préstamos:</b> muestra los activos con cuotas pagadas, saldo restante y próximo vencimiento.',
      },
      {
        sel: '#prestamoInputWrap',
        title: 'Elegí el monto',
        text: 'Escribí el monto o usá el slider. El sistema calcula las cuotas en tiempo real mientras ajustás.',
        info: 'El monto mínimo es $5.000 y el máximo depende de tu historial en NODO. El slider va de $5.000 a $500.000 en pasos de $5.000.',
      },
      {
        sel: '.prestamo-pills',
        title: 'Plazo en cuotas',
        text: 'Elegí entre 3, 6, 12, 24 o 36 cuotas. A más cuotas, cuota mensual más baja pero mayor costo total.',
        info: 'A <b>3 cuotas</b> pagás menos interés total pero la cuota mensual es más alta. A <b>36 cuotas</b> la cuota mensual es accesible pero el costo total del préstamo es mayor.',
      },
      {
        sel: '.prestamo-col-results',
        title: 'Resumen de costos',
        text: 'Cuota mensual estimada, TNA, TEA, intereses y CFT antes de solicitar. Sin sorpresas ni letras chicas.',
        info: '<b>TNA:</b> Tasa Nominal Anual (sin capitalización). <b>TEA:</b> Tasa Efectiva Anual (incluye capitalización mensual). <b>CFT:</b> Costo Financiero Total — la cifra más honesta, incluye todo.',
      },
    ],

    finanzas: [
      {
        sel: '#section-finanzas .two-col-cards',
        title: 'Tus finanzas personales',
        text: 'Dos herramientas en un panel: reservas para tus metas de ahorro y el análisis de gastos por categoría.',
        info: 'Todo se registra automáticamente a partir de tus movimientos. No necesitás cargar gastos a mano ni conectar otras cuentas.',
      },
      {
        sel: '#section-finanzas .two-col-cards > .card:first-child',
        title: 'Mis Reservas',
        text: 'Separá dinero para objetivos concretos: vacaciones, fondo de emergencia, tecnología. Cada reserva tiene nombre, plazo y monto.',
        info: 'Podés tener hasta 10 reservas activas. El dinero reservado sigue en tu cuenta pero queda marcado para ese objetivo. Podés liberar una reserva en cualquier momento.',
      },
      {
        sel: '#section-finanzas .two-col-cards > .card:last-child',
        title: 'Gastos por categoría',
        text: 'El gráfico muestra en qué categorías gastás más. Identificá hábitos y ajustá tu presupuesto mes a mes.',
        info: 'Las categorías se asignan automáticamente según el tipo de movimiento: comercios, servicios, transferencias, recargas. Podés ver el desglose del mes actual o histórico.',
      },
    ],

    dolares: [
      {
        sel: '#heroUSD',
        title: 'Tu cuenta en dólares',
        text: 'Desde acá manejás tu caja de ahorro en USD. Cambiá entre ARS y dólares usando las pestañas de arriba.',
        info: 'Tu cuenta USD tiene un CBU y alias propios, distintos de la cuenta ARS. Podés recibir transferencias en dólares desde cualquier banco del país que opere en USD.',
      },
      {
        sel: '#btnAbrirUSD',
        title: 'Abrir cuenta USD',
        text: 'Todavía no tenés cuenta en dólares. Con un toque la abrís al instante: te asignamos un CBU y alias propios en USD.',
        info: 'La apertura no tiene costo ni trámite. Una vez abierta podés recibir transferencias en USD, comprar dólares desde tus pesos y vender cuando quieras.',
      },
      {
        sel: '#heroUSDCon',
        title: 'Tu saldo en dólares',
        text: 'Ves tu balance en USD y su equivalente en pesos. Tocá el ojo para ocultarlo.',
        info: 'El equivalente en pesos se calcula al dólar blue de referencia, no al oficial. El valor puede variar con las cotizaciones del mercado.',
      },
      {
        sel: '.balance-actions-usd',
        title: 'Operaciones en USD',
        text: '<b>Comprar:</b> convertís pesos a dólares al tipo de cambio blue de referencia.<br><b>Vender:</b> convertís tus dólares a pesos.<br><b>Transferir:</b> enviás USD a otro CBU o alias en dólares.',
        info: 'La compra y venta usan el tipo blue como referencia. La transferencia en USD sale directo de tu saldo en dólares sin conversión intermedia.',
      },
      {
        sel: '#usdCotizaciones',
        title: 'Cotizaciones en vivo',
        text: 'Seguí el dólar blue, oficial, MEP y más, actualizados en tiempo real para que tomes decisiones informadas.',
        info: '<b>Blue:</b> mercado informal de divisas. <b>Oficial:</b> tipo de cambio del BNA. <b>MEP:</b> dólar a través de compra de bonos. Las cotizaciones se actualizan cada 5 minutos.',
      },
    ],

    recargas: [
      {
        sel: '#recargasSectionCard',
        title: 'Recargar celular',
        text: 'Cargá saldo en cualquier línea de Movistar, Personal, Claro o Tuenti. La acreditación es inmediata.',
        info: 'La recarga se debita de tu saldo ARS. Si el número no acepta la recarga por algún motivo, la operación no se procesa y el dinero no se descuenta.',
      },
      {
        sel: '.operators-grid',
        title: 'Elegí el operador',
        text: 'Seleccioná el operador de la línea a recargar. Si no sabés cuál es, chequeá en Ajustes del celular.',
        info: 'Para verificar el operador en el celular: en iOS andá a Ajustes → General → Info → Operadora. En Android: Ajustes → Acerca del teléfono → Estado → Operadora.',
      },
      {
        sel: '.recarga-section-label',
        title: 'Número y monto',
        text: 'Ingresá el número sin el 15 y elegí el monto. Podés guardar números frecuentes para recargar más rápido la próxima vez.',
        info: 'Ingresá solo los 10 dígitos sin el 0 ni el 15. Ejemplo: para el número 011 15-1234-5678 ingresás <b>1112345678</b>. Para líneas del interior, incluí el código de área.',
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
