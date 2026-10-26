/* ============================================================
 * HEARTBLOCK — app.js
 * 页面壳 / Feed / Gallery / 存档 / 双语 / 音效 / 弹窗
 * ============================================================ */

'use strict';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

/* ---------------- 存档 ---------------- */
const SAVE_KEY = 'heartblock_save_v1';
let save;
const loadSave = () => {
  try { save = JSON.parse(localStorage.getItem(SAVE_KEY)) || null; } catch (e) { save = null; }
  if (!save) save = { v: 2, hearts: ECON.starterHearts, best: 0, unlocked: [], lang: 'en', sound: true, seenHint: false };
  /* 旧版经济（照片 5~18 心）迁移到新版（×20，每行 +10 心）：缩放余额，已解锁内容保留 */
  if (!save.v) { save.v = 2; save.hearts = (save.hearts || 0) * 20; persist(); }
};
const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* 隐私模式忽略 */ } };
const lang = () => save.lang;
const t = k => I18N[lang()][k] ?? k;
const gName = g => lang() === 'hi' ? g.nameHi : g.name;
const gText = g => lang() === 'hi' ? g.hi : g.en;

/* ---------------- 音效（WebAudio 合成，零素材） ---------------- */
const Sfx = (() => {
  let ac;
  const ctx0 = () => {
    ac ||= new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === 'suspended') ac.resume();
    return ac;
  };
  const tone = (freq, dur, type = 'sine', vol = .18, delay = 0, slide = 0) => {
    if (!save.sound) return;
    try {
      const a = ctx0(), o = a.createOscillator(), g = a.createGain(), t0 = a.currentTime + delay;
      o.type = type; o.frequency.setValueAtTime(freq, t0);
      if (slide) o.frequency.exponentialRampToValueAtTime(slide, t0 + dur);
      g.gain.setValueAtTime(vol, t0);
      g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
      o.connect(g); g.connect(a.destination);
      o.start(t0); o.stop(t0 + dur + .02);
    } catch (e) { /* 忽略 */ }
  };
  return {
    place: () => tone(170, .09, 'sine', .22),
    clear: m => { [523, 659, 784].slice(0, 2 + (m > 1 ? 1 : 0)).forEach((f, i) => tone(f * m, .14, 'triangle', .15, i * .055)); },
    heart: () => tone(620, .18, 'sine', .16, 0, 980),
    unlock: () => [660, 880, 1320].forEach((f, i) => tone(f, .22, 'sine', .16, i * .09)),
    over: () => { tone(330, .3, 'sine', .14); tone(220, .4, 'sine', .14, .18); },
    tap: () => tone(440, .06, 'sine', .1),
  };
})();

/* ---------------- 提示气泡 ---------------- */
let toastTimer;
const toast = msg => {
  const el = $('#toast');
  el.textContent = msg; el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
};

/* ---------------- 浮动爱心 ---------------- */
const floatHearts = n => {
  const wrap = $('#boardWrap');
  for (let i = 0; i < Math.min(n, 6); i++) {
    const h = document.createElement('span');
    h.className = 'float-heart';
    h.textContent = '♥';
    h.style.left = (30 + Math.random() * 40) + '%';
    h.style.animationDelay = (i * .12) + 's';
    wrap.appendChild(h);
    setTimeout(() => h.remove(), 1600);
  }
};

/* ---------------- 心数 / 解锁进度 ---------------- */
const renderHearts = () => {
  $('#heartCount').textContent = save.hearts;
  renderProgress();
};
/* 顶部 Heart Progress Bar：当前心数 → 下一张照片价格 */
const renderProgress = () => {
  const next = nextGirl();
  const goal = next ? next.cost : Math.max(1, save.hearts);
  const shown = Math.min(save.hearts, goal);
  $('#hbFill').style.width = Math.min(100, (save.hearts / goal) * 100) + '%';
  $('#hbNow').textContent = shown;
  $('#hbGoal').textContent = goal;
  $('#hbRate').textContent = '+' + ECON.heartPerLine;
  $('#hbName').textContent = next ? gName(next) : '♥';
};

/* ---------------- 游戏回调接线 ---------------- */
const onScore = s => {
  $('#score').textContent = s;
  $('#bestScore').textContent = save.best;
};
const onHearts = (amount, session) => {
  save.hearts += amount; persist(); renderHearts();
  $('#sessionHearts').textContent = '+' + session;
  floatHearts(Math.min(6, Math.max(3, Math.round(amount / 3))));
  Sfx.heart();
};
const onCombo = (combo, mult) => {
  const el = $('#comboPop');
  el.textContent = `${t('combo')} ×${mult}`;
  el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
};
const onPlace = (score, gained, x, y, lines, mult) => {
  Sfx.place();
  if (gained > 0) {
    const wrap = $('#boardWrap');
    const pop = document.createElement('span');
    pop.className = 'score-pop';
    pop.textContent = '+' + gained;
    pop.style.left = Math.min(Math.max(x, 30), wrap.clientWidth - 40) + 'px';
    pop.style.top = Math.max(y - 20, 8) + 'px';
    wrap.appendChild(pop);
    setTimeout(() => pop.remove(), 900);
  }
  if (!save.seenHint) { save.seenHint = true; persist(); $('#hintOverlay').classList.add('hide'); }
};
const onClear = (lines, mult) => Sfx.clear(mult);
const onGameOver = ({ score, sessionHearts }) => {
  Sfx.over();
  const isBest = score > save.best;
  if (isBest) { save.best = score; persist(); }
  $('#goFinal').textContent = score;
  $('#goBest').textContent = save.best;
  $('#goHearts').textContent = '+' + sessionHearts;
  $('#goNewBest').style.display = isBest && score > 0 ? '' : 'none';
  $('#gameOverModal').classList.add('open');
};

/* ---------------- Feed ---------------- */
/* 金色大锁（渐变在 index.html 的全局 defs 里定义一次） */
const GOLD_LOCK = `<svg class="gold-lock" viewBox="0 0 24 24" aria-hidden="true">
  <path d="M7.2 10.4V7.6a4.8 4.8 0 019.6 0v2.8" fill="none" stroke="url(#goldGrad)" stroke-width="2.2" stroke-linecap="round"/>
  <rect x="4.6" y="9.8" width="14.8" height="11.4" rx="3.2" fill="url(#goldGrad)"/>
  <circle cx="12" cy="14.6" r="1.5" fill="#5b3a0c"/>
  <path d="M12 15.8v2.9" stroke="#5b3a0c" stroke-width="1.6" stroke-linecap="round"/>
</svg>`;

const nextGirl = () => GIRLS.find(g => !save.unlocked.includes(g.id));

const renderFeed = () => {
  const list = $('#feedList');
  const next = nextGirl();
  list.innerHTML = '';
  GIRLS.forEach((g, i) => {
    const unlocked = save.unlocked.includes(g.id);
    const isNext = next && g.id === next.id;
    const card = document.createElement('article');
    card.className = 'card' + (unlocked ? ' open' : '') + (isNext ? ' next' : '');
    card.style.animationDelay = (i * 45) + 'ms';

    card.innerHTML = `
      <div class="card-head">
        <img class="avatar" src="${girlThumb(g.id)}" alt="${gName(g)}" loading="lazy">
        <div class="card-id"><b>${gName(g)}</b><span>${g.age}</span></div>
        ${unlocked ? `<span class="badge done">✓</span>` : isNext ? `<span class="badge next-badge">${t('feedNext')}</span>` : `<span class="badge lock">🔒</span>`}
      </div>
      <div class="card-photo ${unlocked ? '' : 'blurred'}">
        <img src="${girlThumb(g.id)}" alt="${gName(g)}" loading="lazy">
        ${unlocked ? '' : `<div class="lock-veil">${GOLD_LOCK}<span class="lock-name">${gName(g)}</span></div>`}
      </div>
      <div class="card-foot">
        <p class="quote">“${gText(g)}”</p>
        ${unlocked
          ? `<button class="btn ghost view-btn" data-id="${g.id}">${t('tapToView')}</button>`
          : isNext
            ? `<button class="btn primary unlock-btn" data-id="${g.id}">
                 <span class="hearts-ico">♥</span> ${t('unlockFor')} ${g.cost}
               </button>`
            : `<div class="seq-num">${t('unlockAt')} ${g.cost} ♥</div>`}
      </div>`;
    list.appendChild(card);

    if (unlocked) card.querySelector('.view-btn').addEventListener('click', () => openLightbox(g.id));
    if (isNext) card.querySelector('.unlock-btn').addEventListener('click', () => askUnlock(g));
  });

  if (!next) {
    const done = document.createElement('div');
    done.className = 'feed-done';
    done.textContent = t('feedDone');
    list.appendChild(done);
  }
};

/* ---------------- 解锁流程 ---------------- */
let pendingGirl = null;
const askUnlock = g => {
  if (save.hearts < g.cost) {
    toast(t('needMore'));
    Sfx.tap();
    return;
  }
  pendingGirl = g;
  $('#umAvatar').src = girlThumb(g.id);
  $('#umName').textContent = gName(g);
  $('#umQuote').textContent = '“' + gText(g) + '”';
  $('#umCost').textContent = '♥ ' + g.cost;
  $('#umBalance').textContent = t('heartsBalance') + ': ♥ ' + save.hearts;
  $('#unlockModal').classList.add('open');
};
const confirmUnlock = () => {
  const g = pendingGirl; if (!g || save.hearts < g.cost) return;
  save.hearts -= g.cost;
  save.unlocked.push(g.id);
  persist(); renderHearts(); Sfx.unlock();
  $('#unlockModal').classList.remove('open');
  renderFeed(); renderGallery();

  /* 找到该卡片，播放 shimmer 揭示动画 */
  const target = [...$$('#feedList .card.open')].pop();
  if (target) {
    target.classList.add('just-unlocked');
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  floatHearts(5);
  const um = $('#unlockedModal');
  um.querySelector('.um-ok-name').textContent = gName(g);
  um.querySelector('.um-ok-quote').textContent = '“' + gText(g) + '”';
  um.classList.add('open');
  pendingGirl = null;
};

/* ---------------- Gallery ---------------- */
const renderGallery = () => {
  const grid = $('#galleryGrid');
  const count = save.unlocked.length;
  $('#galleryCount').textContent = `${count} / 20 ${t('galleryCount')}`;
  grid.innerHTML = '';
  const firstId = count ? Math.min(...save.unlocked) : null;

  /* 不解锁也全部铺满：模糊轮廓 + 金锁 = 饥饿营销 */
  GIRLS.forEach(g => {
    const unlocked = save.unlocked.includes(g.id);
    const isFirst = g.id === firstId;
    const tile = document.createElement('button');
    tile.className = 'tile' + (unlocked ? '' : ' locked') + (isFirst ? ' first' : '');
    tile.innerHTML = `
      <img class="tile-img" src="${girlThumb(g.id)}" alt="${unlocked ? gName(g) : ''}" loading="lazy">
      ${unlocked
        ? `<span class="tile-name">${gName(g)}</span>`
        : `<div class="tile-veil">${GOLD_LOCK}<span class="tile-req">${t('unlockAt')} ${g.cost} ♥</span></div>`}
      ${isFirst ? '<span class="tile-shine"></span><span class="tile-spark"></span>' : ''}`;
    if (unlocked) tile.addEventListener('click', () => openLightbox(g.id));
    grid.appendChild(tile);
  });
};

/* ---------------- Lightbox ---------------- */
let lbList = [], lbIdx = 0;
const openLightbox = id => {
  lbList = save.unlocked.slice().sort((a, b) => a - b);
  lbIdx = Math.max(0, lbList.indexOf(id));
  showLb();
  $('#lightbox').classList.add('open');
};
const showLb = () => {
  const id = lbList[lbIdx], g = GIRLS.find(x => x.id === id);
  $('#lbImg').src = girlImg(id);
  $('#lbName').textContent = gName(g);
  $('#lbQuote').textContent = '“' + gText(g) + '”';
  $('#lbCounter').textContent = `${lbIdx + 1} / ${lbList.length}`;
  $('#lbPrev').style.visibility = lbIdx > 0 ? '' : 'hidden';
  $('#lbNext').style.visibility = lbIdx < lbList.length - 1 ? '' : 'hidden';
};

/* ---------------- Tab 导航 ---------------- */
const switchTab = name => {
  $$('#tabbar .tab').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  $$('.page').forEach(p => p.classList.toggle('active', p.id === 'page-' + name));
  Sfx.tap();
};

/* ---------------- 设置 ---------------- */
const applyLang = () => {
  document.documentElement.lang = lang() === 'hi' ? 'hi' : 'en';
  $$('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  $('#langSegEn').classList.toggle('on', lang() === 'en');
  $('#langSegHi').classList.toggle('on', lang() === 'hi');
  renderFeed(); renderGallery(); renderProgress();
};

/* ---------------- 启动 ---------------- */
loadSave();
renderHearts();

document.addEventListener('DOMContentLoaded', () => {
  Game.init($('#board'), {
    onScore, onHearts, onCombo, onPlace, onClear, onGameOver,
    onFirstGrab: () => { if (!save.seenHint) { save.seenHint = true; persist(); $('#hintOverlay').classList.add('hide'); } },
  });

  applyLang();
  onScore(0);
  if (save.seenHint) $('#hintOverlay').classList.add('hide');

  /* Tab */
  $$('#tabbar .tab').forEach(b => b.addEventListener('click', () => {
    switchTab(b.dataset.tab);
    /* 画布尺寸必须在 play 页可见时重算：隐藏页 clientWidth=0 会把布局算坏 */
    if (b.dataset.tab === 'play') Game.resize();
  }));

  /* Game Over */
  $('#playAgainBtn').addEventListener('click', () => {
    $('#gameOverModal').classList.remove('open');
    $('#sessionHearts').textContent = '+0';
    Game.start(); Sfx.tap();
  });

  /* 解锁 */
  $('#umConfirm').addEventListener('click', confirmUnlock);
  $('#umCancel').addEventListener('click', () => { $('#unlockModal').classList.remove('open'); Sfx.tap(); });
  $('#unlockedModal').addEventListener('click', () => $('#unlockedModal').classList.remove('open'));

  /* Lightbox */
  $('#lbPrev').addEventListener('click', e => { e.stopPropagation(); if (lbIdx > 0) { lbIdx--; showLb(); Sfx.tap(); } });
  $('#lbNext').addEventListener('click', e => { e.stopPropagation(); if (lbIdx < lbList.length - 1) { lbIdx++; showLb(); Sfx.tap(); } });
  $('#lbClose').addEventListener('click', () => $('#lightbox').classList.remove('open'));
  $('#lightbox').addEventListener('click', e => { if (e.target.id === 'lightbox') $('#lightbox').classList.remove('open'); });

  /* 设置面板 */
  $('#settingsBtn').addEventListener('click', () => { $('#settingsSheet').classList.add('open'); Sfx.tap(); });
  $('#settingsClose').addEventListener('click', () => $('#settingsSheet').classList.remove('open'));
  $('#settingsSheet').addEventListener('click', e => { if (e.target.id === 'settingsSheet') $('#settingsSheet').classList.remove('open'); });
  $('#langSegEn').addEventListener('click', () => { save.lang = 'en'; persist(); applyLang(); Sfx.tap(); });
  $('#langSegHi').addEventListener('click', () => { save.lang = 'hi'; persist(); applyLang(); Sfx.tap(); });
  $('#soundToggle').addEventListener('click', () => {
    save.sound = !save.sound; persist();
    $('#soundToggle').classList.toggle('on', save.sound);
    Sfx.tap();
  });
  $('#soundToggle').classList.toggle('on', save.sound);
  $('#resetBtn').addEventListener('click', () => { $('#settingsSheet').classList.remove('open'); $('#resetModal').classList.add('open'); });
  $('#resetYes').addEventListener('click', () => { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} location.reload(); });
  $('#resetNo').addEventListener('click', () => $('#resetModal').classList.remove('open'));

  /* Hint */
  $('#hintGo').addEventListener('click', () => {
    save.seenHint = true; persist();
    $('#hintOverlay').classList.add('hide'); Sfx.tap();
  });
});
