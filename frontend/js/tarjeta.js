const cargarTarjeta = async () => {
  try {
    const data = await apiFetch('/cards');
    const cards = data.cards || [];
    tarjetaActiva = cards[0] || null;
    renderTarjeta();
    if (tarjetaActiva) cargarHistorialTarjeta(tarjetaActiva.id);
  } catch (_) {}
};

const renderTarjeta = () => {
  const noCard    = document.getElementById('noCardState');
  const container = document.getElementById('cardContainer');
  const badge     = document.getElementById('cardStatusBadge');
  if (!noCard || !container) return;

  if (!tarjetaActiva) {
    noCard.classList.remove('hidden');
    container.classList.add('hidden');
    if (badge) badge.classList.add('hidden');
    return;
  }

  noCard.classList.add('hidden');
  container.classList.remove('hidden');

  // Badge de estado
  if (badge) {
    badge.textContent = tarjetaActiva.status === 'active' ? 'Activa' : 'Bloqueada';
    badge.className = `card-status-badge ${tarjetaActiva.status}`;
    badge.classList.remove('hidden');
  }

  // Visual de la tarjeta
  const [panPrefix, , , panLast] = tarjetaActiva.pan_masked.split(' ');
  const binEl  = document.getElementById('cardNumBin');
  const lastEl = document.getElementById('userCardLast4');
  if (binEl)  binEl.textContent  = panPrefix || '4539';
  if (lastEl) lastEl.textContent = panLast   || 'â€¢â€¢â€¢â€¢';

  const expiryEl = document.getElementById('userCardExpiry');
  if (expiryEl) {
    const mm = String(tarjetaActiva.expiry_month).padStart(2, '0');
    const yy = String(tarjetaActiva.expiry_year).slice(-2);
    expiryEl.textContent = `${mm}/${yy}`;
  }

  // Panel "Ver datos"
  const panEl    = document.getElementById('cardDataPan');
  const expiryD  = document.getElementById('cardDataExpiry');
  const limitEl  = document.getElementById('cardDataLimit');
  if (panEl)   { panEl.textContent = tarjetaActiva.pan_masked; panEl.dataset.value = tarjetaActiva.pan_masked.replace(/\s/g,''); }
  if (expiryD) {
    const mm = String(tarjetaActiva.expiry_month).padStart(2, '0');
    expiryD.textContent = `${mm}/${tarjetaActiva.expiry_year}`;
  }
  if (limitEl) limitEl.textContent = `$${Number(tarjetaActiva.daily_limit).toLocaleString('es-AR')} / día`;

  // CVV â€” siempre empieza oculto
  const cvvEl = document.getElementById('cardDataCvv');
  if (cvvEl) cvvEl.textContent = 'â€¢â€¢â€¢';

  // BotÃ³n bloquear / activar
  const toggleBtn = document.getElementById('toggleCardStatusBtn');
  if (toggleBtn) {
    const blocked = tarjetaActiva.status === 'blocked';
    toggleBtn.innerHTML = blocked
      ? '<i class="fas fa-lock-open"></i><span>Desbloquear</span>'
      : '<i class="fas fa-lock"></i><span>Bloquear</span>';
    toggleBtn.classList.toggle('blocked-state', blocked);
  }

  // Tarjeta bloqueada: overlay visual
  const cardEl = document.getElementById('visaCardEl');
  if (cardEl) cardEl.style.filter = tarjetaActiva.status === 'blocked' ? 'grayscale(0.7) brightness(0.7)' : '';
};

const cargarHistorialTarjeta = async (cardId) => {
  try {
    const data = await apiFetch(`/cards/${cardId}/transactions`);
    const list = document.getElementById('cardTxList');
    if (!list) return;
    const txs = data.transactions || [];
    if (txs.length === 0) {
      list.innerHTML = '<li class="list-empty">Sin movimientos con tarjeta todavía</li>';
      return;
    }
    list.innerHTML = txs.map(tx => {
      const isRefund  = tx.status === 'refunded';
      const icon      = isRefund ? 'fa-arrow-turn-up' : 'fa-credit-card';
      const iconColor = isRefund ? '#34d399' : '#94a3b8';
      const iconBg    = isRefund ? 'rgba(16,185,129,.12)' : '#1e293b';
      const iconBorder = isRefund ? 'rgba(16,185,129,.3)' : 'rgba(51,65,85,.5)';
      const amtColor  = isRefund ? '#34d399' : '#f87171';
      const sign      = isRefund ? '+' : '-';
      const fecha = new Date(tx.created_at).toLocaleDateString('es-AR', { day:'2-digit', month:'short' });
      const badge = isRefund ? '<span class="tx-badge-refund">devuelto</span>' : '';
      return `<li class="movement-item ctx-tx-row">
        <div class="ctx-tx-icon" style="background:${iconBg};border-color:${iconBorder}">
          <i class="fas ${icon}" style="color:${iconColor}"></i>
        </div>
        <div class="ctx-tx-info">
          <span class="ctx-tx-desc">${tx.merchant_name}${badge}</span>
          <span class="ctx-tx-meta">${fecha} · Auth: ${tx.authorization_code}</span>
        </div>
        <span class="movement-amount" style="color:${amtColor};font-variant-numeric:tabular-nums">${sign}$${Number(tx.amount).toLocaleString('es-AR')}</span>
      </li>`;
    }).join('');
  } catch (_) {}
};

