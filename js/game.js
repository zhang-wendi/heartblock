/* ============================================================
 * HEARTBLOCK — game.js
 * 8x8 方块消除引擎：拖拽放置 / 行列消除 / 连击 / 心数产出
 * ============================================================ */

'use strict';

const Game = (() => {
  const N = ECON.boardSize;
  const COLORS = BLOCK_COLORS;
  const DPR = Math.min(window.devicePixelRatio || 1, 2.5);

  let canvas, ctx, opts;
  let cssW = 0, cell = 0, boardX = 0, boardY = 10, trayY = 0, trayH = 0;

  let grid;                 // N×N: 0=空 / 1..5=颜色索引+1
  let tray;                 // [piece|null]×3  piece={shape,cIdx,w,h,cells}
  let score = 0, combo = 0, sessionHearts = 0, nextHeartAt = ECON.heartPer;
  let running = false, over = false;

  let drag = null;          // {slot, piece, px, py, valid, gx, gy}
  let clears = [];          // 消除动画 [{cells:[{x,y,color}], t0}]
  let sparks = [];          // 粒子
  let trayPopT = 0;         // 补块弹出动画时间戳
  let lastPlacedAt = 0;

  /* ---------- 工具 ---------- */
  const shapeOf = s => {
    let w = 0, h = 0;
    for (const [x, y] of s.c) { w = Math.max(w, x + 1); h = Math.max(h, y + 1); }
    return { cells: s.c, w, h, size: s.c.length };
  };
  const fillRatio = () => {
    let n = 0;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (grid[y][x]) n++;
    return n / (N * N);
  };
  const weightedShape = crowded => {
    let total = 0;
    const mods = SHAPES.map(s => {
      let m = s.w;
      if (crowded) m *= s.c.length <= 3 ? 1.7 : (s.c.length >= 5 ? 0.45 : 1);
      total += m; return m;
    });
    let r = Math.random() * total;
    for (let i = 0; i < SHAPES.length; i++) { r -= mods[i]; if (r <= 0) return SHAPES[i]; }
    return SHAPES[0];
  };
  const canPlaceAt = (p, gx, gy) => {
    if (gx < 0 || gy < 0 || gx + p.w > N || gy + p.h > N) return false;
    for (const [x, y] of p.cells) if (grid[gy + y][gx + x]) return false;
    return true;
  };
  const canPlaceAnywhere = p => {
    for (let y = 0; y <= N - p.h; y++)
      for (let x = 0; x <= N - p.w; x++)
        if (canPlaceAt(p, x, y)) return true;
    return false;
  };

  /* ---------- 补块（防伪死局：至少一块可放） ---------- */
  const refill = () => {
    const crowded = fillRatio() > 0.42;
    let best = null;
    for (let t = 0; t < 16; t++) {
      const ps = [0, 0, 0].map(() => {
        const sh = shapeOf(weightedShape(crowded));
        return { ...sh, cIdx: Math.floor(Math.random() * COLORS.length) };
      });
      best = ps;
      if (ps.some(canPlaceAnywhere)) break;
    }
    tray = best;
    trayPopT = performance.now();
  };

  /* ---------- 放置与消除 ---------- */
  const fullLines = () => {
    const rows = [], cols = [];
    for (let y = 0; y < N; y++) if (grid[y].every(v => v)) rows.push(y);
    for (let x = 0; x < N; x++) { let f = true; for (let y = 0; y < N; y++) if (!grid[y][x]) { f = false; break; } if (f) cols.push(x); }
    return { rows, cols };
  };
  const linesWith = (p, gx, gy) => {
    const g = grid.map(r => r.slice());
    for (const [x, y] of p.cells) g[gy + y][gx + x] = 1;
    const rows = [], cols = [];
    for (let y = 0; y < N; y++) if (g[y].every(v => v)) rows.push(y);
    for (let x = 0; x < N; x++) { let f = true; for (let y = 0; y < N; y++) if (!g[y][x]) { f = false; break; } if (f) cols.push(x); }
    return rows.length + cols.length;
  };

  const place = (slot, gx, gy) => {
    const p = tray[slot];
    for (const [x, y] of p.cells) grid[gy + y][gx + x] = p.cIdx + 1;
    tray[slot] = null;
    score += p.size;
    opts.onScore(score);

    const { rows, cols } = fullLines();
    const lines = rows.length + cols.length;
    let gained = 0, mult = 1;

    if (lines > 0) {
      combo += 1;
      mult = Math.min(combo, ECON.comboCap);
      gained = lines * ECON.clearBase * mult + (rows.length > 0 && cols.length > 0 ? ECON.crossBonus : 0);
      score += gained;
      opts.onScore(score);

      const clearedCells = [];
      for (const y of rows) for (let x = 0; x < N; x++) clearedCells.push({ x, y, color: grid[y][x] });
      for (const x of cols) for (let y = 0; y < N; y++) if (!rows.includes(y)) clearedCells.push({ x, y, color: grid[y][x] });
      for (const c of clearedCells) {
        grid[c.y][c.x] = 0;
        for (let i = 0; i < 3; i++) sparks.push({
          x: boardX + c.x * cell + cell / 2, y: boardY + c.y * cell + cell / 2,
          vx: (Math.random() - .5) * 3, vy: (Math.random() - .5) * 3 - 1,
          t: 0, color: COLORS[(c.color - 1 + COLORS.length) % COLORS.length] || COLORS[0],
        });
      }
      clears.push({ cells: clearedCells, t0: performance.now(), lines, rows, cols });

      if (combo >= 2) opts.onCombo(combo, mult);
      if (lines >= 2) {
        const wrap = document.getElementById('boardWrap');
        wrap.classList.remove('shake'); void wrap.offsetWidth; wrap.classList.add('shake');
      }
      opts.onClear(lines, mult);
    } else {
      combo = 0;
    }
    opts.onPlace(score, gained, boardX + gx * cell, boardY + gy * cell, lines, mult);

    while (score >= nextHeartAt) {
      nextHeartAt += ECON.heartPer;
      sessionHearts++;
      opts.onHearts(sessionHearts);
    }

    if (tray.every(t => t === null)) refill();

    /* 死局检测：剩余方块全部无处可放 */
    if (!tray.some(t => t && canPlaceAnywhere(t))) {
      over = true; running = false;
      setTimeout(() => opts.onGameOver({ score, sessionHearts }), 420);
    }
  };

  /* ---------- 绘制 ---------- */
  const roundRect = (x, y, w, h, r) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };
  const drawBlock = (x, y, s, color, alpha = 1) => {
    ctx.save();
    ctx.globalAlpha = alpha;
    const r = Math.max(3, s * 0.22);
    ctx.fillStyle = color;
    roundRect(x + 1, y + 1, s - 2, s - 2, r); ctx.fill();
    // 顶部高光
    const g = ctx.createLinearGradient(x, y, x, y + s);
    g.addColorStop(0, 'rgba(255,255,255,.38)');
    g.addColorStop(.45, 'rgba(255,255,255,.07)');
    g.addColorStop(.55, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,.22)');
    ctx.fillStyle = g;
    roundRect(x + 1, y + 1, s - 2, s - 2, r); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.25)';
    ctx.lineWidth = 1;
    roundRect(x + 1.5, y + 1.5, s - 3, s - 3, r); ctx.stroke();
    ctx.restore();
  };

  const draw = now => {
    ctx.clearRect(0, 0, cssW, canvas.height / DPR);

    /* 空格背景 */
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        ctx.fillStyle = grid[y][x] ? 'rgba(255,255,255,.03)' : 'rgba(255,255,255,.045)';
        roundRect(boardX + x * cell + 2, boardY + y * cell + 2, cell - 4, cell - 4, cell * .18);
        ctx.fill();
      }

    /* 预览：将被消除的行列金色光晕 */
    if (drag && drag.valid && linesWith(drag.piece, drag.gx, drag.gy) > 0) {
      const g = grid.map(r => r.slice());
      for (const [x, y] of drag.piece.cells) g[drag.gy + y][drag.gx + x] = 1;
      ctx.save();
      ctx.fillStyle = 'rgba(233,184,109,.16)';
      for (let y = 0; y < N; y++) if (g[y].every(v => v)) ctx.fillRect(boardX, boardY + y * cell, N * cell, cell);
      for (let x = 0; x < N; x++) { let f = true; for (let y = 0; y < N; y++) if (!g[y][x]) { f = false; break; }
        if (f) ctx.fillRect(boardX + x * cell, boardY, cell, N * cell); }
      ctx.restore();
    }

    /* 已放置方块 */
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++)
        if (grid[y][x]) drawBlock(boardX + x * cell, boardY + y * cell, cell, COLORS[grid[y][x] - 1]);

    /* 消除动画：闪白 + 收缩 */
    const done = [];
    for (let i = 0; i < clears.length; i++) {
      const cl = clears[i], k = Math.min(1, (now - cl.t0) / 260);
      for (const c of cl.cells) {
        const s = cell * (1 - k * .6);
        const off = (cell - s) / 2;
        drawBlock(boardX + c.x * cell + off, boardY + c.y * cell + off, s, '#ffffff', (1 - k) * .95);
      }
      if (k >= 1) done.push(i);
    }
    clears = clears.filter((_, i) => !done.includes(i));

    /* 粒子（t 本帧刚过期时必须跳过绘制：负半径会让 arc 抛 IndexSizeError，杀死整个渲染循环） */
    sparks = sparks.filter(p => p.t < 1);
    for (const p of sparks) {
      p.x += p.vx; p.y += p.vy; p.vy += .08; p.t += .045;
      if (p.t >= 1) continue;
      ctx.globalAlpha = 1 - p.t;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, 3 * (1 - p.t), 0, 7); ctx.fill();
      ctx.globalAlpha = 1;
    }

    /* 托盘 */
    const slotW = (cssW - 24) / 3, gapX = 8;
    const pop = Math.min(1, (now - trayPopT) / 220);
    const popScale = 0.6 + 0.4 * (1 - Math.pow(1 - pop, 3));
    for (let i = 0; i < 3; i++) {
      const sx = 12 + i * (slotW + gapX), sy = trayY;
      ctx.fillStyle = 'rgba(255,255,255,.05)';
      roundRect(sx, sy, slotW, trayH, 14); ctx.fill();
      const p = tray[i];
      if (!p || drag && drag.slot === i) continue;
      const mc = Math.min(cell * .52, (trayH - 20) / Math.max(p.w, p.h));
      const pw = p.w * mc, ph = p.h * mc;
      ctx.save();
      ctx.translate(sx + slotW / 2, sy + trayH / 2);
      ctx.scale(popScale, popScale);
      for (const [x, y] of p.cells) drawBlock(x * mc - pw / 2, y * mc - ph / 2, mc, COLORS[p.cIdx]);
      ctx.restore();
    }

    /* 拖拽中的方块 */
    if (drag) {
      const p = drag.piece;
      const pw = p.w * cell, ph = p.h * cell;
      const tlx = drag.px - pw / 2, tly = drag.py - drag.lift;
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 8;
      for (const [x, y] of p.cells) drawBlock(tlx + x * cell, tly + y * cell, cell, COLORS[p.cIdx]);
      ctx.restore();
      if (drag.valid) {
        for (const [x, y] of p.cells) drawBlock(boardX + (drag.gx + x) * cell, boardY + (drag.gy + y) * cell, cell, COLORS[p.cIdx], .45);
      }
    }
  };

  const loop = now => { draw(now); requestAnimationFrame(loop); };

  /* ---------- 指针交互 ---------- */
  const evPos = e => {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const slotAt = (x, y) => {
    const slotW = (cssW - 24) / 3, gapX = 8;
    for (let i = 0; i < 3; i++) {
      const sx = 12 + i * (slotW + gapX);
      if (x >= sx && x <= sx + slotW && y >= trayY && y <= trayY + trayH) return i;
    }
    return -1;
  };

  const onDown = e => {
    if (!running || over || drag) return;
    const { x, y } = evPos(e);
    const slot = slotAt(x, y);
    if (slot >= 0 && tray[slot]) {
      const p = tray[slot];
      const ph = p.h * cell;
      drag = {
        slot, piece: p, px: x, py: y, valid: false,
        /* 鼠标：方块贴着光标；触摸：方块上浮避免被手指遮挡 */
        lift: e.pointerType === 'mouse' ? ph * 0.5 + 6 : ph + cell * 0.9,
      };
      updateTarget();
      e.preventDefault();
      opts.onFirstGrab && opts.onFirstGrab();
    }
  };
  const updateTarget = () => {
    const p = drag.piece;
    const pw = p.w * cell;
    const tlx = drag.px - pw / 2, tly = drag.py - drag.lift;
    const gx = Math.round((tlx - boardX) / cell), gy = Math.round((tly - boardY) / cell);
    drag.gx = gx; drag.gy = gy;
    drag.valid = canPlaceAt(p, gx, gy);
  };
  const onMove = e => {
    if (!drag) return;
    const { x, y } = evPos(e);
    drag.px = x; drag.py = y;
    updateTarget();
    e.preventDefault();
  };
  const onUp = () => {
    if (!drag) return;
    const d = drag;
    drag = null;   /* 先清空再落子：即使 place 内部异常，拖拽也绝不卡死 */
    if (d.valid) place(d.slot, d.gx, d.gy);
  };

  /* ---------- 尺寸 ---------- */
  const layout = () => {
    const wrap = document.getElementById('boardWrap');
    const w = wrap.clientWidth;
    /* 页面隐藏（切 Tab）时跳过：保留上一次的正确布局，用 0 宽度重算会把画布永久算坏 */
    if (w < 40) return;
    cssW = w;
    cell = Math.floor((cssW - 16) / N);
    boardX = Math.floor((cssW - cell * N) / 2);
    trayH = cell * 3.1;
    trayY = boardY + cell * N + cell * .55;
    const cssH = trayY + trayH + 10;
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    canvas.width = cssW * DPR; canvas.height = cssH * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  };

  /* ---------- 对外接口 ---------- */
  const api = {
    init(cv, o) {
      canvas = cv; ctx = canvas.getContext('2d'); opts = o;
      layout();
      window.addEventListener('resize', () => layout());
      canvas.addEventListener('pointerdown', onDown);
      /* 移动/松手挂 window：无论指针在哪、是否出画布，都必定结束拖拽 */
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
      /* 兜底：失焦时取消拖拽（只还块，不落子），防止鬼影残留 */
      window.addEventListener('blur', () => { drag = null; });
      requestAnimationFrame(loop);
      this.start();
    },
    start() {
      grid = Array.from({ length: N }, () => Array(N).fill(0));
      score = 0; combo = 0; sessionHearts = 0;
      nextHeartAt = ECON.heartPer; over = false;
      drag = null; clears = []; sparks = [];
      refill();
      running = true;
      opts.onScore(0);
    },
    getSessionHearts: () => sessionHearts,
    resize: layout,
    /* 仅供自动化回归测试读取内部状态（只读快照，不影响玩法） */
    _debug: () => ({
      tray: tray.map(p => p && { cells: p.cells, w: p.w, h: p.h }),
      grid: grid.map(r => r.slice()),
      score, running, over, drag: !!drag,
    }),
  };
  return api;
})();
