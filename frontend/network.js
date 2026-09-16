function initNetwork(canvas, opts) {
  const ctx  = canvas.getContext('2d');
  let color         = opts.color       || 'rgba(100,116,139,';
  const count       = opts.count       || 55;
  const maxDist     = opts.maxDist     || 150;
  const speed       = opts.speed       || 0.28;
  const nodeOpacity = opts.nodeOpacity || 0.28;
  const lineOpacity = opts.lineOpacity || 0.13;

  let nodes = [], W = 0, H = 0;

  function resize() {
    W = canvas.width  = canvas.offsetWidth  || parseInt(canvas.getAttribute('width'))  || 400;
    H = canvas.height = canvas.offsetHeight || parseInt(canvas.getAttribute('height')) || 300;
    nodes = Array.from({ length: count }, () => ({
      x:  Math.random() * W,
      y:  Math.random() * H,
      vx: (Math.random() - 0.5) * speed,
      vy: (Math.random() - 0.5) * speed,
      r:  Math.random() * 1.4 + 0.8
    }));
  }

  function frame() {
    ctx.clearRect(0, 0, W, H);
    const c = typeof color === 'function' ? color() : color;

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i].x - nodes[j].x;
        const dy = nodes[i].y - nodes[j].y;
        const d  = Math.sqrt(dx * dx + dy * dy);
        if (d < maxDist) {
          ctx.beginPath();
          ctx.strokeStyle = c + ((1 - d / maxDist) * lineOpacity) + ')';
          ctx.lineWidth   = 0.8;
          ctx.moveTo(nodes[i].x, nodes[i].y);
          ctx.lineTo(nodes[j].x, nodes[j].y);
          ctx.stroke();
        }
      }
    }

    nodes.forEach(n => {
      ctx.beginPath();
      ctx.fillStyle = c + nodeOpacity + ')';
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fill();

      n.x += n.vx;
      n.y += n.vy;
      if (n.x < 0 || n.x > W) n.vx *= -1;
      if (n.y < 0 || n.y > H) n.vy *= -1;
    });

    if (opts.animated !== false) requestAnimationFrame(frame);
  }

  resize();
  frame();
  if (opts.animated !== false) new ResizeObserver(resize).observe(canvas);
  return { setColor(c) { color = c; } };
}
