/* blocks: a pile of weighted blocks with gravity. drag them around and build something.
   physics by matter-js (vendor/matter.min.js, MIT). */
(() => {
  const { Engine, Bodies, Body, Composite, Mouse, MouseConstraint, Events } = Matter;

  // [w, h] in block units
  const SET = [
    [3, 3], [2, 2], [2, 2], [2, 2],
    [4, 1], [4, 1], [3, 1], [3, 1],
    [2, 1], [2, 1], [2, 1], [1, 1], [1, 1],
  ];

  const canvas = document.getElementById("stage");
  const ctx = canvas.getContext("2d");
  const heightEl = document.getElementById("height");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  let engine, mc, W, H, U, dpr, blocks, statics, timers = [], colors, lastText = "";

  const readColors = () => {
    const s = getComputedStyle(document.documentElement);
    colors = { bg: s.getPropertyValue("--bg"), ink: s.getPropertyValue("--ink"), faint: s.getPropertyValue("--faint") };
  };
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", readColors);

  function setup() {
    timers.forEach(clearTimeout); timers = [];
    const r = canvas.getBoundingClientRect();
    W = Math.round(r.width); H = Math.round(r.height);
    dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = W * dpr; canvas.height = H * dpr;
    U = Math.max(18, Math.round(W / 14));

    engine = Engine.create({ enableSleeping: true });
    engine.gravity.y = 1.4;
    engine.positionIterations = 10;
    const wall = { isStatic: true, friction: 0.9 };
    statics = [
      Bodies.rectangle(W / 2, H + 40, W * 4, 80, wall),           // ground
      Bodies.rectangle(-40, H / 2 - 1500, 80, 4000 + H, wall),    // left wall
      Bodies.rectangle(W + 40, H / 2 - 1500, 80, 4000 + H, wall), // right wall
    ];
    Composite.add(engine.world, statics);

    const mouse = Mouse.create(canvas);
    mouse.pixelRatio = dpr;
    // keep the page scrollable with the wheel
    ["mousewheel", "DOMMouseScroll", "wheel"].forEach(n => canvas.removeEventListener(n, mouse.mousewheel));
    mc = MouseConstraint.create(engine, { mouse, constraint: { stiffness: 0.25, damping: 0.15, render: { visible: false } } });
    Composite.add(engine.world, mc);
    // heavier blocks follow the finger more slowly
    Events.on(mc, "startdrag", e => {
      const units = (e.body.bounds.max.x - e.body.bounds.min.x) * (e.body.bounds.max.y - e.body.bounds.min.y) / (U * U);
      mc.constraint.stiffness = Math.max(0.08, Math.min(0.5, 0.3 * Math.sqrt(4 / units)));
    });

    blocks = [];
    drop();
  }

  function drop() {
    SET.forEach(([w, h], i) => {
      timers.push(setTimeout(() => {
        const x = U * 2 + Math.random() * (W - U * 4);
        const b = Bodies.rectangle(x, -U * 3, w * U - 1, h * U - 1, {
          density: 0.002, friction: 0.7, frictionStatic: 1, restitution: 0.04, sleepThreshold: 40,
          angle: (Math.random() - 0.5) * 0.5,
        });
        blocks.push(b);
        Composite.add(engine.world, b);
      }, reduce ? 0 : i * 110));
    });
  }

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = colors.faint; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, H - 0.5); ctx.lineTo(W, H - 0.5); ctx.stroke();
    ctx.lineJoin = "round"; ctx.lineWidth = 1.5;
    for (const b of blocks) {
      ctx.beginPath();
      b.vertices.forEach((v, i) => (i ? ctx.lineTo(v.x, v.y) : ctx.moveTo(v.x, v.y)));
      ctx.closePath();
      ctx.fillStyle = colors.bg;
      ctx.strokeStyle = colors.ink;
      ctx.fill(); ctx.stroke();
    }
  }

  // tallest settled stack, in block units
  function measure() {
    const settled = blocks.length === SET.length && blocks.every(b => b === mc.body || (b.bounds.max.y > 0 && b.speed < 0.3 && Math.abs(b.angularVelocity) < 0.02));
    if (!settled) return;
    const top = Math.min(...blocks.map(b => b.bounds.min.y));
    const h = Math.max(0, (H - top) / U);
    const n = Math.round(h * 2) / 2;
    const text = `tallest stack: ${n} block${n === 1 ? "" : "s"}`;
    if (text !== lastText) { heightEl.textContent = text; lastText = text; }
  }

  let last = performance.now(), acc = 0, mt = 0;
  function frame(t) {
    acc += Math.min(50, t - last); last = t;
    while (acc >= 1000 / 60) { Engine.update(engine, 1000 / 60); acc -= 1000 / 60; }
    draw();
    if (t - mt > 300) { mt = t; measure(); }
    requestAnimationFrame(frame);
  }

  document.getElementById("reset").addEventListener("click", () => {
    Composite.remove(engine.world, blocks, true); blocks.length = 0;
    timers.forEach(clearTimeout); timers = [];
    heightEl.textContent = "tallest stack: 0 blocks"; lastText = "";
    drop();
  });

  let rw = 0, rt;
  new ResizeObserver(() => {
    const w = canvas.getBoundingClientRect().width;
    if (!engine) { readColors(); setup(); rw = w; requestAnimationFrame(frame); return; }
    if (Math.abs(w - rw) < 2) return;
    clearTimeout(rt); rt = setTimeout(() => { rw = w; lastText = ""; setup(); }, 150);
  }).observe(canvas);
})();
