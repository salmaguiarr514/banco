const NodoTour = (() => {
  let _active = false, _step = 0, _steps = [], _spot, _card, _onEnd, _posTimer = null, _startScroll = 0;

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

  const _isMobile = () => window.innerWidth <= 720;

  // Fixed targets (bottom nav) can't be scrolled into place
  const _isFixed = (el) => {
    for (let e = el; e && e !== document.body; e = e.parentElement) {
      if (getComputedStyle(e).position === 'fixed') return true;
    }
    return false;
  };

  const _cardWidth = () => _isMobile() ? Math.min(420, window.innerWidth - 24) : 320;

  // Scroll so the target and the card fit together on screen, instead of centering the
  // target (which leaves no room above or below a tall element and puts the card on top)
  const _scrollToTarget = (target) => {
    if (_isFixed(target)) return;
    const cardH = _card.offsetHeight || 230;
    const h = target.getBoundingClientRect().height;
    const offset = Math.max(20, (window.innerHeight - (h + 16 + 14 + cardH)) / 2);
    target.style.scrollMarginTop = `${offset}px`;
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(() => { target.style.scrollMarginTop = ''; }, 600);
  };

  // Visible area of rect a covered by rect b
  const _overlap = (a, b) =>
    Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) *
    Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));

  const _positionElements = () => {
    if (!_active || _step >= _steps.length) return;
    const target = document.querySelector(_steps[_step].sel);
    if (!target) return;

    const PAD = 8;
    const raw = target.getBoundingClientRect();
    // Mobile: the spotlight stops above the bottom nav, which would otherwise sit inside it and cover the target
    const nav = document.getElementById('sidebarNav');
    let bottom = raw.bottom;
    if (_isMobile() && nav && !nav.contains(target) && getComputedStyle(nav).position === 'fixed') {
      bottom = Math.min(bottom, nav.getBoundingClientRect().top - PAD - 4);
    }
    bottom = Math.max(bottom, raw.top + 24);
    const r = { top: raw.top, left: raw.left, width: raw.width, right: raw.right, bottom, height: bottom - raw.top };

    Object.assign(_spot.style, {
      top:    `${r.top  - PAD}px`,
      left:   `${r.left - PAD}px`,
      width:  `${r.width  + PAD * 2}px`,
      height: `${r.height + PAD * 2}px`,
      opacity: '1',
    });

    const CW = _cardWidth();
    _card.style.width = `${CW}px`;
    const cardH = _card.offsetHeight || 230;
    const GAP = 14, EDGE = 12;
    const vw = window.innerWidth, vh = window.innerHeight;
    const clampX = (x) => Math.max(EDGE, Math.min(vw - CW - EDGE, x));
    const clampY = (y) => Math.max(EDGE, Math.min(vh - cardH - EDGE, y));
    const centerX = clampX(r.left + r.width / 2 - CW / 2);
    const middleY = clampY(r.top + r.height / 2 - cardH / 2);
    const hole = { left: r.left - PAD, right: r.right + PAD, top: r.top - PAD, bottom: r.bottom + PAD };

    // Candidate spots, kept inside the screen: next to the target first, then the corners.
    // The first one that covers nothing of the highlighted area wins; if none, the one that covers least.
    const docX = [EDGE, vw - CW - EDGE];
    const options = [
      { top: clampY(r.bottom + PAD + GAP),      left: centerX, arrow: 'top' },
      { top: clampY(r.top - PAD - GAP - cardH), left: centerX, arrow: 'bottom' },
      { top: middleY, left: clampX(r.right + PAD + GAP),     arrow: 'none' },
      { top: middleY, left: clampX(r.left - PAD - GAP - CW), arrow: 'none' },
      ...docX.flatMap(x => [{ top: vh - cardH - EDGE, left: x, arrow: 'none' }, { top: EDGE, left: x, arrow: 'none' }]),
      { top: vh - cardH - EDGE, left: (vw - CW) / 2, arrow: 'none' },
    ];
    const cover = (o) => _overlap(hole, { left: o.left, right: o.left + CW, top: o.top, bottom: o.top + cardH });
    let pick = options[0], best = Infinity;
    for (const o of options) {
      const c = cover(o);
      if (c < best) { best = c; pick = o; }
      if (c === 0) break;
    }
    // Arrows only make sense when the card actually sits right next to the target
    if (pick.arrow === 'top' && pick.top < r.bottom + PAD) pick = { ...pick, arrow: 'none' };
    if (pick.arrow === 'bottom' && pick.top + cardH > r.top - PAD) pick = { ...pick, arrow: 'none' };

    // Arrow horizontal offset: align with target center, clamped inside card
    const arrowLeft = Math.max(28, Math.min(CW - 28, (r.left + r.width / 2) - pick.left));

    Object.assign(_card.style, { top: `${pick.top}px`, left: `${pick.left}px`, opacity: '1' });
    _card.dataset.arrow = pick.arrow;
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
        <div class="nodo-tour-btns">
          ${!isFirst ? '<button class="nodo-tour-prev" id="_ntPrev">← Anterior</button>' : ''}
          <button class="nodo-tour-next" id="_ntNext">${isLast ? '¡Listo!' : 'Siguiente →'}</button>
        </div>
        <div class="nodo-tour-foot">
          <div class="nodo-tour-dots">
            ${valid.map((_, i) => `<div class="nodo-tour-dot${i === pos ? ' active' : ''}"></div>`).join('')}
          </div>
          ${!isLast ? '<button class="nodo-tour-skip" id="_ntSkip">Omitir tutorial</button>' : ''}
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
    _card.style.width = `${_cardWidth()}px`;
    _scrollToTarget(target);
    clearTimeout(_posTimer);
    // Position once the scroll settles, and again in case it was still moving
    _posTimer = setTimeout(() => { _positionElements(); _posTimer = setTimeout(_positionElements, 450); }, 450);
  };

  const start = (steps, { onEnd } = {}) => {
    if (_active) return;
    _active = true; _step = 0; _steps = steps; _onEnd = onEnd;
    _startScroll = window.scrollY;
    document.body.classList.add('nodo-tour-on');

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
    document.body.classList.remove('nodo-tour-on');
    clearTimeout(_posTimer);
    _spot?.remove(); _spot = null;
    _card?.remove(); _card = null;
    // Volver a donde estaba la persona antes del tutorial
    window.scrollTo({ top: _startScroll, behavior: 'smooth' });
    _onEnd?.();
    _onEnd = null;
  };

  // Reposition on resize and while the page scrolls
  let _raf = 0;
  const _follow = () => { if (_active && !_raf) _raf = requestAnimationFrame(() => { _raf = 0; _positionElements(); }); };
  window.addEventListener('resize', _follow);
  window.addEventListener('scroll', _follow, { capture: true, passive: true });

  return { start, end, get active() { return _active; } };
})();
