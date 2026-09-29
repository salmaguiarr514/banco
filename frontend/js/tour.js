const NodoTour = (() => {
  let _active = false, _step = 0, _steps = [], _spot, _card, _onEnd;

  const _isVisible = (el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };

  const _render = () => {
    if (!_active) return;
    // Skip invisible steps
    while (_step < _steps.length) {
      const target = document.querySelector(_steps[_step].sel);
      if (target && _isVisible(target)) break;
      _step++;
    }
    if (_step >= _steps.length) { end(); return; }

    const s      = _steps[_step];
    const target = document.querySelector(s.sel);
    const r      = target.getBoundingClientRect();
    const PAD    = 8;
    Object.assign(_spot.style, {
      top:    `${r.top  - PAD}px`,
      left:   `${r.left - PAD}px`,
      width:  `${r.width  + PAD * 2}px`,
      height: `${r.height + PAD * 2}px`,
    });

    const CW  = 300;
    let ct = r.bottom + PAD + 14;
    let cl = r.left + r.width / 2 - CW / 2;
    if (ct + 260 > window.innerHeight - 16) ct = Math.max(16, r.top - PAD - 260 - 14);
    cl = Math.max(16, Math.min(window.innerWidth - CW - 16, cl));
    Object.assign(_card.style, { top: `${ct}px`, left: `${cl}px` });

    // Count only visible steps for progress indicator
    const total   = _steps.filter((s2, i) => {
      if (i < _step) return true; // already shown
      const el = document.querySelector(s2.sel);
      return el && _isVisible(el);
    }).length;
    const current = _steps.slice(0, _step).filter((s2) => {
      const el = document.querySelector(s2.sel);
      return el && _isVisible(el);
    }).length + 1;

    const last = _step === _steps.length - 1 ||
      !_steps.slice(_step + 1).some(s2 => { const el = document.querySelector(s2.sel); return el && _isVisible(el); });

    _card.innerHTML = `
      <div class="nodo-tour-label">Paso ${current} de ${total}</div>
      <div class="nodo-tour-title">${s.title}</div>
      <div class="nodo-tour-text">${s.html || s.text || ''}</div>
      <div class="nodo-tour-actions">
        <div class="nodo-tour-dots">${Array.from({ length: total }, (_, i) => `<div class="nodo-tour-dot${i === current - 1 ? ' active' : ''}"></div>`).join('')}</div>
        <button class="nodo-tour-skip" id="_ntSkip">Omitir</button>
        <button class="nodo-tour-next" id="_ntNext">${last ? '¡Listo!' : 'Siguiente →'}</button>
      </div>`;
    document.getElementById('_ntSkip')?.addEventListener('click', end);
    document.getElementById('_ntNext')?.addEventListener('click', () => {
      if (last) { end(); } else { _step++; _render(); }
    });
  };

  const start = (steps, { onEnd } = {}) => {
    if (_active) return;
    _active = true; _step = 0; _steps = steps; _onEnd = onEnd;
    _spot = document.createElement('div');
    _spot.className = 'nodo-tour-spotlight';
    document.body.appendChild(_spot);
    _card = document.createElement('div');
    _card.className = 'nodo-tour-card';
    document.body.appendChild(_card);
    setTimeout(_render, 50);
  };

  const end = () => {
    if (!_active) return;
    _active = false;
    _spot?.remove(); _spot = null;
    _card?.remove(); _card = null;
    _onEnd?.();
    _onEnd = null;
  };

  return { start, end, get active() { return _active; } };
})();
