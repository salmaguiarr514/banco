const NodoTour = (() => {
  let _active = false, _step = 0, _steps = [], _spot, _card, _onEnd, _posTimer = null;

  // True if el exists in DOM and isn't display:none / hidden
  const _inDOM = (el) => {
    if (!el) return false;
    return el.offsetWidth > 0 || el.offsetHeight > 0;
  };

  // Collect indices of steps whose target elements exist and aren't hidden
  const _validIdxs = () => _steps.reduce((acc, s, i) => {
    const el = document.querySelector(s.sel);
    if (_inDOM(el)) acc.push(i);
    return acc;
  }, []);

  const _positionElements = () => {
    if (!_active || _step >= _steps.length) return;
    const target = document.querySelector(_steps[_step].sel);
    if (!target) return;

    const r   = target.getBoundingClientRect();
    const PAD = 8;

    Object.assign(_spot.style, {
      top:    `${r.top  - PAD}px`,
      left:   `${r.left - PAD}px`,
      width:  `${r.width  + PAD * 2}px`,
      height: `${r.height + PAD * 2}px`,
      opacity: '1',
    });

    const CW    = 300;
    const cardH = _card.offsetHeight || 230;
    const GAP   = 14;
    const vw    = window.innerWidth;
    const vh    = window.innerHeight;

    let ct, cl, arrowDir;
    const spaceBelow = vh - r.bottom - PAD - GAP;
    const spaceAbove = r.top - PAD - GAP;

    if (spaceBelow >= cardH) {
      ct = r.bottom + PAD + GAP;
      arrowDir = 'top';
    } else if (spaceAbove >= cardH) {
      ct = r.top - PAD - GAP - cardH;
      arrowDir = 'bottom';
    } else {
      ct = Math.max(16, Math.min(vh - cardH - 16, r.top + r.height / 2 - cardH / 2));
      arrowDir = 'none';
    }

    cl = r.left + r.width / 2 - CW / 2;
    cl = Math.max(16, Math.min(vw - CW - 16, cl));

    // Arrow horizontal offset: align with target center, clamped inside card
    const arrowLeft = Math.max(28, Math.min(CW - 28, (r.left + r.width / 2) - cl));

    Object.assign(_card.style, { top: `${ct}px`, left: `${cl}px`, opacity: '1' });
    _card.dataset.arrow = arrowDir;
    _card.style.setProperty('--arrow-left', `${arrowLeft}px`);
  };

  const _render = () => {
    if (!_active) return;

    const valid = _validIdxs();

    // Advance past truly hidden elements
    while (_step < _steps.length && !valid.includes(_step)) _step++;
    if (_step >= _steps.length) { end(); return; }

    const s      = _steps[_step];
    const target = document.querySelector(s.sel);
    const pos    = valid.indexOf(_step);
    const total  = valid.length;
    const isFirst = pos === 0;
    const isLast  = pos === total - 1;

    _card.style.opacity = '0';
    _spot.style.opacity = '0';

    _card.innerHTML = `
      <div class="nodo-tour-label">Paso ${pos + 1} de ${total}</div>
      <div class="nodo-tour-title">${s.title}</div>
      <div class="nodo-tour-text">${s.html || s.text || ''}</div>
      ${s.info ? `<button class="nodo-tour-info-btn" id="_ntInfoBtn">+ info</button><div class="nodo-tour-info-expanded" id="_ntInfoExpanded">${s.info}</div>` : ''}
      <div class="nodo-tour-actions">
        <div class="nodo-tour-dots">
          ${valid.map((_, i) => `<div class="nodo-tour-dot${i === pos ? ' active' : ''}"></div>`).join('')}
        </div>
        <div class="nodo-tour-btns">
          ${!isFirst ? '<button class="nodo-tour-prev" id="_ntPrev">← Anterior</button>' : ''}
          <button class="nodo-tour-skip" id="_ntSkip">Omitir</button>
          <button class="nodo-tour-next" id="_ntNext">${isLast ? '¡Listo!' : 'Siguiente →'}</button>
        </div>
      </div>`;

    document.getElementById('_ntInfoBtn')?.addEventListener('click', () => {
      const expanded = document.getElementById('_ntInfoExpanded');
      const btn = document.getElementById('_ntInfoBtn');
      if (!expanded) return;
      const isVisible = expanded.classList.toggle('visible');
      if (btn) btn.textContent = isVisible ? '− info' : '+ info';
      clearTimeout(_posTimer);
      _posTimer = setTimeout(_positionElements, 100);
    });
    document.getElementById('_ntPrev')?.addEventListener('click', () => {
      if (pos > 0) { _step = valid[pos - 1]; _render(); }
    });
    document.getElementById('_ntSkip')?.addEventListener('click', end);
    document.getElementById('_ntNext')?.addEventListener('click', () => {
      if (isLast) { end(); } else { _step = valid[pos + 1]; _render(); }
    });

    // Scroll to target first, then position after scroll settles
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    clearTimeout(_posTimer);
    _posTimer = setTimeout(_positionElements, 380);
  };

  const start = (steps, { onEnd } = {}) => {
    if (_active) return;
    _active = true; _step = 0; _steps = steps; _onEnd = onEnd;

    _spot = document.createElement('div');
    _spot.className = 'nodo-tour-spotlight';
    _spot.style.cssText = 'opacity:0;top:-9999px;left:0;width:0;height:0';
    document.body.appendChild(_spot);

    _card = document.createElement('div');
    _card.className = 'nodo-tour-card';
    _card.style.cssText = 'opacity:0;top:-9999px;left:0';
    document.body.appendChild(_card);

    setTimeout(_render, 50);
  };

  const end = () => {
    if (!_active) return;
    _active = false;
    clearTimeout(_posTimer);
    _spot?.remove(); _spot = null;
    _card?.remove(); _card = null;
    _onEnd?.();
    _onEnd = null;
  };

  // Reposition on resize
  window.addEventListener('resize', () => { if (_active) _positionElements(); });

  return { start, end, get active() { return _active; } };
})();
