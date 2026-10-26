/* ============================================================
 * HEARTBLOCK — game.js
 * 8x8 方块消除引擎：拖拽放置 / 行列消除 / 连击 / 心数产出
 * ============================================================ */

'use strict';

const Game = (() => {
  const N = ECON.boardSize;
  const COLORS = BLOCK_COLORS;
  const GEMS = BLOCK_GEMS;
  const DPR = Math.min(window.devicePixelRatio || 1, 2.5);

  let canvas, ctx, opts;
  let cssW = 0, cell = 0, boardX = 0, boardY = 10, trayY = 0, trayH = 0;

  let grid;                 // N×N: 0=空 / 1..5=颜色索引+1
  let tray;                 // [piece|null]×3  piece={shape,cIdx,w,h,cells}
  let score = 0, combo = 0, sessionHearts = 0;
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

      /* 爱心产出：每消除一行/列 +10 ♥ */
      const earned = lines * ECON.heartPerLine;
      sessionHearts += earned;
      opts.onHearts(earned, sessionHearts);
    } else {
      combo = 0;
    }
    opts.onPlace(score, gained, boardX + gx * cell, boardY + gy * cell, lines, mult);

    if (tray.every(t => t === null)) refill();

    /* 死局检测：剩余方块全部无处可放 */
    if (!tray.some(t => t && canPlaceAnywhere(t))) {
      over = true; running = false;
      setTimeout(() => opts.onGameOver({ score, sessionHearts }), 420);
    }
  };

  /* ---------- 绘制 ---------- */
  const rr = (c, x, y, w, h, r) => {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  };
  const roundRect = (x, y, w, h, r) => rr(ctx, x, y, w, h, r);

  /* 四角星芒 */
  const star = (c, cx, cy, r, col) => {
    c.fillStyle = col;
    c.beginPath();
    c.moveTo(cx, cy - r);
    c.quadraticCurveTo(cx + r * .16, cy - r * .16, cx + r, cy);
    c.quadraticCurveTo(cx + r * .16, cy + r * .16, cx, cy + r);
    c.quadraticCurveTo(cx - r * .16, cy + r * .16, cx - r, cy);
    c.quadraticCurveTo(cx - r * .16, cy - r * .16, cx, cy - r);
    c.fill();
  };
  const heartPath = (c, cx, cy, r) => {
    c.beginPath();
    c.moveTo(cx, cy + r * .75);
    c.bezierCurveTo(cx - r * 1.25, cy - r * .15, cx - r * .55, cy - r * 1.1, cx, cy - r * .35);
    c.bezierCurveTo(cx + r * .55, cy - r * 1.1, cx + r * 1.25, cy - r * .15, cx, cy + r * .75);
    c.closePath();
  };

  /* 单颗宝石：多段渐变 + 切面 + 内部暗角 + 镜面高光 + 星芒；金币另加内圈与爱心浮雕 */
  const renderGem = (c, x, y, s, cIdx) => {
    const g = GEMS[cIdx % GEMS.length];
    const pad = s * .06, b = s - pad * 2, r = b * .26;
    const bx = x + pad, by = y + pad;

    /* 落影 */
    c.fillStyle = 'rgba(0,0,0,.3)';
    rr(c, bx, by + b * .07, b, b, r); c.fill();

    /* 宝石体 */
    const body = c.createLinearGradient(bx, by, bx + b, by + b);
    body.addColorStop(0, g.light);
    body.addColorStop(.3, g.base);
    body.addColorStop(.74, g.deep);
    body.addColorStop(1, g.base);
    c.fillStyle = body;
    rr(c, bx, by, b, b, r); c.fill();

    c.save();
    rr(c, bx, by, b, b, r); c.clip();

    /* 左上亮切面 */
    c.fillStyle = 'rgba(255,255,255,.17)';
    c.beginPath();
    c.moveTo(bx, by); c.lineTo(bx + b, by); c.lineTo(bx, by + b);
    c.closePath(); c.fill();

    /* 右下暗切面 */
    c.fillStyle = 'rgba(0,0,0,.2)';
    c.beginPath();
    c.moveTo(bx + b, by); c.lineTo(bx + b, by + b); c.lineTo(bx, by + b);
    c.closePath(); c.fill();

    /* 底部内阴影（厚度感） */
    const bot = c.createLinearGradient(0, by + b * .5, 0, by + b);
    bot.addColorStop(0, 'rgba(0,0,0,0)');
    bot.addColorStop(1, 'rgba(0,0,0,.45)');
    c.fillStyle = bot;
    c.fillRect(bx, by, b, b);

    /* 中心径向高光 */
    const sp = c.createRadialGradient(bx + b * .33, by + b * .25, 0, bx + b * .33, by + b * .25, b * .58);
    sp.addColorStop(0, 'rgba(255,255,255,.68)');
    sp.addColorStop(.26, 'rgba(255,255,255,.16)');
    sp.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = sp;
    c.fillRect(bx, by, b, b);

    /* 顶部镜面长条反光 */
    c.fillStyle = 'rgba(255,255,255,.26)';
    c.beginPath();
    c.ellipse(bx + b * .44, by + b * .12, b * .29, b * .065, -.1, 0, 7);
    c.fill();
    c.restore();

    /* 亮边 + 内圈暗边（宝石镶嵌感） */
    c.strokeStyle = 'rgba(255,255,255,.5)';
    c.lineWidth = Math.max(1, s * .028);
    rr(c, bx + .5, by + .5, b - 1, b - 1, r); c.stroke();
    c.strokeStyle = 'rgba(0,0,0,.22)';
    c.lineWidth = Math.max(1, s * .02);
    rr(c, bx + b * .07, by + b * .07, b * .86, b * .86, r * .78); c.stroke();

    /* 星芒 */
    star(c, bx + b * .25, by + b * .24, b * .14, g.glint);

    /* 金币纹样 */
    if (g.type === 'coin') {
      const cx = bx + b / 2, cy = by + b / 2, rad = b * .35;
      c.strokeStyle = 'rgba(255,243,196,.6)';
      c.lineWidth = Math.max(1, b * .04);
      c.beginPath(); c.arc(cx, cy, rad, 0, 7); c.stroke();
      c.strokeStyle = 'rgba(108,64,4,.5)';
      c.lineWidth = Math.max(1, b * .022);
      c.beginPath(); c.arc(cx, cy, rad * .74, 0, 7); c.stroke();
      c.fillStyle = 'rgba(112,66,6,.5)';
      heartPath(c, cx, cy - b * .01, b * .15); c.fill();
      c.fillStyle = 'rgba(255,244,200,.55)';
      heartPath(c, cx - b * .012, cy - b * .02, b * .15); c.fill();
    }
  };

  /* 精灵缓存：尺寸/颜色不变时不重复生成渐变，移动端也能稳 60fps */
  let gemCache = new Map();
  const gemSprite = (cIdx, size) => {
    const s = Math.max(10, Math.round(size));
    const key = cIdx + '@' + s;
    let cv = gemCache.get(key);
    if (cv) return cv;
    const px = Math.ceil(s * DPR);
    cv = document.createElement('canvas');
    cv.width = px; cv.height = px;
    const c2 = cv.getContext('2d');
    c2.scale(px / s, px / s);
    renderGem(c2, 0, 0, s, cIdx);
    gemCache.set(key, cv);
    return cv;
  };
  const drawBlock = (x, y, s, cIdx, alpha = 1) => {
    if (alpha !== 1) { ctx.save(); ctx.globalAlpha = alpha; }
    ctx.drawImage(gemSprite(cIdx, s), x, y, s, s);
    if (alpha !== 1) ctx.restore();
  };

  /* 棋盘玻璃底板 */
  const drawBoardPanel = () => {
    const pad = Math.max(5, cell * .14);
    const px = boardX - pad, py = boardY - pad;
    const pw = N * cell + pad * 2, ph = N * cell + pad * 2;
    const rad = cell * .42;

    ctx.save();
    ctx.shadowColor = 'rgba(167,139,250,.5)';
    ctx.shadowBlur = cell * .9;
    const glass = ctx.createLinearGradient(px, py, px + pw, py + ph);
    glass.addColorStop(0, 'rgba(72,55,108,.68)');
    glass.addColorStop(.48, 'rgba(40,29,62,.62)');
    glass.addColorStop(1, 'rgba(24,16,38,.78)');
    ctx.fillStyle = glass;
    rr(ctx, px, py, pw, ph, rad); ctx.fill();
    ctx.restore();

    /* 玻璃上缘反光 + 斜向光带 */
    ctx.save();
    rr(ctx, px, py, pw, ph, rad); ctx.clip();
    const sheen = ctx.createLinearGradient(0, py, 0, py + ph * .42);
    sheen.addColorStop(0, 'rgba(255,255,255,.16)');
    sheen.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sheen;
    ctx.fillRect(px, py, pw, ph * .42);
    ctx.globalAlpha = .055;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(px + pw * .14, py); ctx.lineTo(px + pw * .36, py);
    ctx.lineTo(px + pw * .06, py + ph); ctx.lineTo(px - pw * .16, py + ph);
    ctx.closePath(); ctx.fill();
    ctx.restore();

    /* 玻璃边框 */
    ctx.strokeStyle = 'rgba(255,255,255,.14)';
    ctx.lineWidth = 1;
    rr(ctx, px + .5, py + .5, pw - 1, ph - 1, rad); ctx.stroke();
  };

  /* 微发光网格线 */
  const drawGridGlow = () => {
    for (let i = 1; i < N; i++) {
      const gx = boardX + i * cell;
      ctx.strokeStyle = 'rgba(233,184,109,.06)';
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(gx, boardY); ctx.lineTo(gx, boardY + N * cell); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,222,170,.17)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(gx, boardY); ctx.lineTo(gx, boardY + N * cell); ctx.stroke();

      const gy = boardY + i * cell;
      ctx.strokeStyle = 'rgba(233,184,109,.06)';
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(boardX, gy); ctx.lineTo(boardX + N * cell, gy); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,222,170,.17)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(boardX, gy); ctx.lineTo(boardX + N * cell, gy); ctx.stroke();
    }
  };

  const draw = now => {
    ctx.clearRect(0, 0, cssW, canvas.height / DPR);

    /* 玻璃棋盘底板 */
    drawBoardPanel();

    /* 空槽：内凹玻璃井 */
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        if (grid[y][x]) continue;
        const ix = boardX + x * cell + cell * .07, iy = boardY + y * cell + cell * .07;
        const iw = cell * .86;
        ctx.fillStyle = 'rgba(255,255,255,.035)';
        rr(ctx, ix, iy, iw, iw, cell * .2); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,.2)';
        ctx.lineWidth = 1;
        rr(ctx, ix, iy, iw, iw, cell * .2); ctx.stroke();
      }

    /* 微发光网格 */
    drawGridGlow();

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

    /* 已放置宝石 */
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++)
        if (grid[y][x]) drawBlock(boardX + x * cell, boardY + y * cell, cell, grid[y][x] - 1);

    /* 消除动画：闪白 + 收缩 */
    const done = [];
    for (let i = 0; i < clears.length; i++) {
      const cl = clears[i], k = Math.min(1, (now - cl.t0) / 260);
      for (const c of cl.cells) {
        const s = cell * (1 - k * .6);
        const off = (cell - s) / 2;
        ctx.save();
        ctx.globalAlpha = (1 - k) * .95;
        ctx.fillStyle = '#fff';
        rr(ctx, boardX + c.x * cell + off + 1, boardY + c.y * cell + off + 1, s - 2, s - 2, s * .26);
        ctx.fill();
        ctx.restore();
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
      /* 玻璃槽 */
      const slotG = ctx.createLinearGradient(0, sy, 0, sy + trayH);
      slotG.addColorStop(0, 'rgba(255,255,255,.075)');
      slotG.addColorStop(1, 'rgba(255,255,255,.028)');
      ctx.fillStyle = slotG;
      roundRect(sx, sy, slotW, trayH, 14); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.09)';
      ctx.lineWidth = 1;
      roundRect(sx + .5, sy + .5, slotW - 1, trayH - 1, 14); ctx.stroke();

      const p = tray[i];
      if (!p || drag && drag.slot === i) continue;
      const mc = Math.min(cell * .52, (trayH - 20) / Math.max(p.w, p.h));
      const pw = p.w * mc, ph = p.h * mc;
      ctx.save();
      ctx.translate(sx + slotW / 2, sy + trayH / 2);
      ctx.scale(popScale, popScale);
      for (const [x, y] of p.cells) drawBlock(x * mc - pw / 2, y * mc - ph / 2, mc, p.cIdx);
      ctx.restore();
    }

    /* 拖拽中的方块 */
    if (drag) {
      const p = drag.piece;
      const pw = p.w * cell, ph = p.h * cell;
      const tlx = drag.px - pw / 2, tly = drag.py - drag.lift;
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 10;
      for (const [x, y] of p.cells) drawBlock(tlx + x * cell, tly + y * cell, cell, p.cIdx);
      ctx.restore();
      if (drag.valid) {
        for (const [x, y] of p.cells) drawBlock(boardX + (drag.gx + x) * cell, boardY + (drag.gy + y) * cell, cell, p.cIdx, .45);
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
    /* clientWidth 含左右 padding(10+10)，必须扣掉，否则画布比内容区宽、右侧被裁 */
    const w = wrap.clientWidth - 20;
    /* 页面隐藏（切 Tab）时跳过：保留上一次的正确布局，用 0 宽度重算会把画布永久算坏 */
    if (w < 40) return;
    cssW = w;
    /* 宽度与可用高度双约束，保证新增的爱心进度条不会把棋盘挤出屏幕 */
    const cellW = Math.floor((cssW - 16) / N);
    const availH = (wrap.clientHeight || Math.round(window.innerHeight * .55)) - 16;
    const cellH = Math.floor((availH - 20) / (N + 3.65));
    cell = Math.max(20, Math.min(cellW, cellH));
    gemCache.clear();
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
      over = false;
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
      score, sessionHearts, running, over, drag: !!drag,
      cell, boardX, boardY, trayY, trayH, cssW,
    }),
  };
  return api;
})();
