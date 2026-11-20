/* GakCoding giriş videosu: kâğıt üstüne mürekkep illüstrasyon, kodla.
   ciz(t) saniye cinsinden zamanı alır, her şey t'den hesaplanır (kare kare kayıt için). */
const W = 1920, H = 1080, SURE = 6;
const cv = document.getElementById('c');
cv.width = W; cv.height = H;
const c = cv.getContext('2d');

/* ---------------------------------------------------------- yardımcılar */
let rng = Math.random;
function tohum(s) {
  let a = s >>> 0;
  rng = () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const MUREKKEP = '#2a1d18';
const ZEMIN_Y = 800;

/* ---------------------------------------------------------- kâğıt */
const kagit = (() => {
  const o = document.createElement('canvas'); o.width = W; o.height = H;
  const g = o.getContext('2d');
  g.fillStyle = '#ecebe6'; g.fillRect(0, 0, W, H);
  const id = g.getImageData(0, 0, W, H), d = id.data;
  tohum(7);
  for (let i = 0; i < d.length; i += 4) { const n = (rng() - 0.5) * 9; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  g.putImageData(id, 0, 0);
  // geniş lekeler: kâğıdın düzensiz tonu
  for (let i = 0; i < 40; i++) {
    const x = rng() * W, y = rng() * H, r = 120 + rng() * 260, gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(${rng() < 0.5 ? '255,255,250' : '200,195,185'},.035)`); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  g.lineCap = 'round';
  for (let i = 0; i < 900; i++) {
    const x = rng() * W, y = rng() * H, a = rng() * 6.28, l = 3 + rng() * 9;
    g.strokeStyle = `rgba(80,72,64,${0.08 + rng() * 0.14})`; g.lineWidth = 0.5 + rng() * 0.5;
    g.beginPath(); g.moveTo(x, y);
    g.quadraticCurveTo(x + Math.cos(a + 0.9) * l * 0.6, y + Math.sin(a + 0.9) * l * 0.6, x + Math.cos(a) * l, y + Math.sin(a) * l);
    g.stroke();
  }
  for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(30,26,22,${0.3 + rng() * 0.5})`; g.beginPath(); g.arc(rng() * W, rng() * H, 0.7 + rng() * 1.3, 0, 7); g.fill(); }
  return o;
})();

/* ---------------------------------------------------------- boyama
   Referans dili: temiz koyu kontur, düz dolgu üstüne açık fırça izleri,
   sağ kenarda koyu bant, sağ altta çapraz tarama, altta hafif koyulaşma. */
function yuvarlak(x, y, w, h, r) { c.beginPath(); c.roundRect(x, y, w, h, r); }

function boya(x, y, w, h, r, { renk, acik, koyu, tarama, kontur = 5, bant = 0.11, iz = true, seed = 1 }) {
  const eski = rng; tohum(seed);
  yuvarlak(x, y, w, h, r); c.fillStyle = renk; c.fill();
  c.save(); yuvarlak(x, y, w, h, r); c.clip();
  if (koyu) {
    c.fillStyle = koyu;
    c.fillRect(x + w * (1 - bant), y, w * bant + 2, h);   // sağ bant
    c.globalAlpha = 0.45; c.fillRect(x, y + h * 0.9, w, h * 0.1); c.globalAlpha = 1; // alt koyulaşma
  }
  if (iz && acik) {
    c.strokeStyle = acik; c.lineCap = 'round';
    const n = Math.round(w * h / 1400);
    for (let i = 0; i < n; i++) {
      const sx = x + rng() * w * 0.85, sy = y + 6 + rng() * (h - 12), l = 14 + rng() * 46;
      c.lineWidth = 1.2 + rng() * 1.6; c.globalAlpha = 0.35 + rng() * 0.45;
      c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx + l, sy - l * 0.04); c.stroke();
    }
    c.globalAlpha = 1;
  }
  if (tarama) {
    c.strokeStyle = tarama; c.lineWidth = 1.4; c.lineCap = 'round';
    for (let k = 0; k < Math.round(w / 9); k++) {
      const bx = x + w * 0.45 + rng() * w * 0.6, by = y + h * (0.35 + rng() * 0.65), l = 18 + rng() * 40;
      c.globalAlpha = 0.25 + rng() * 0.35;
      c.beginPath(); c.moveTo(bx, by); c.lineTo(bx + l * 0.45, by - l); c.stroke();
    }
    c.globalAlpha = 1;
  }
  c.restore();
  if (kontur) { c.strokeStyle = MUREKKEP; c.lineWidth = kontur; c.lineJoin = 'round'; yuvarlak(x, y, w, h, r); c.stroke(); }
  rng = eski;
}

// zemindeki taramalı gölge
function golge(cx, y, rx, ry = 14, yogun = 0.35) {
  const eski = rng; tohum(Math.round(cx));
  c.save(); c.beginPath(); c.ellipse(cx, y, rx, ry, 0, 0, 7); c.clip();
  c.strokeStyle = `rgba(70,64,58,${yogun})`; c.lineWidth = 1;
  for (let x = cx - rx - ry * 2; x < cx + rx; x += 3.2) { c.beginPath(); c.moveTo(x + rng() * 2, y + ry); c.lineTo(x + ry * 1.6 + rng() * 2, y - ry); c.stroke(); }
  c.restore();
  rng = eski;
}

function goz(x, y, w, h, { bak = 0, kapali = 0, mutlu = 0 } = {}) {
  x += bak;
  if (mutlu) { c.strokeStyle = MUREKKEP; c.lineWidth = 7; c.lineCap = 'round'; c.beginPath(); c.moveTo(x - w * 0.7, y + h * 0.12); c.quadraticCurveTo(x, y - h * 0.38, x + w * 0.7, y + h * 0.12); c.stroke(); return; }
  const hh = Math.max(5, h * (1 - kapali));
  yuvarlak(x - w / 2, y - hh / 2, w, hh, Math.min(w, hh) * 0.38); c.fillStyle = '#26171a'; c.fill();
  if (kapali < 0.6) { yuvarlak(x + w * 0.02, y - hh / 2 + 6, w * 0.34, w * 0.4, 3); c.fillStyle = '#f4f1ea'; c.fill(); }
}

/* ---------------------------------------------------------- nesneler */
function claude(x, y, o = {}) {
  const w = 330, h = 232, bx = x - w / 2, by = y - h;
  const kol = (s) => boya(x + s * (w / 2 + 2) - 26 + s * 4, y - 70 + (o.kolOyna ? Math.sin(o.t * 26 + s) * 4 : 0), 52, 40, 9,
    { renk: '#d9714e', acik: '#f0a07c', koyu: '#bf5838', kontur: 4.5, seed: 11 + s });
  kol(-1); kol(1);
  for (const lx of [-110, -62, 36, 84]) boya(x + lx, y - 20, 26, ZEMIN_Y - y + 18, 7, { renk: '#d9714e', koyu: '#bf5838', iz: false, kontur: 4.5, seed: 50 + lx, bant: 0.3 });
  boya(bx, by, w, h, 14, { renk: '#d9714e', acik: '#f2a37f', koyu: '#c45a3a', tarama: '#a8432a', seed: 3 });
  goz(x - 78, by + h * 0.38, 32, 62, o.goz); goz(x + 78, by + h * 0.38, 32, 62, o.goz);
}

function bytRobot(x, y, o = {}) {
  // tişörtlü gövde (alt kısmı masanın arkasında kalır)
  const tw = 230;
  for (const s of [-1, 1]) boya(x + s * 52 - 17, y, 34, ZEMIN_Y - y - 2, 8, { renk: '#8e939c', koyu: '#6d717a', iz: false, kontur: 4.5, seed: 60 + s, bant: 0.3 });
  boya(x - tw / 2 - 26, y - 150, 60, 64, 14, { renk: '#f1efe9', acik: '#ffffff', koyu: '#dcd8cf', kontur: 4.5, seed: 21 });
  boya(x + tw / 2 - 34, y - 150, 60, 64, 14, { renk: '#f1efe9', acik: '#ffffff', koyu: '#dcd8cf', kontur: 4.5, seed: 22 });
  boya(x - tw / 2, y - 168, tw, 200, 34, { renk: '#f1efe9', acik: '#ffffff', koyu: '#d9d4ca', tarama: '#b9b2a5', seed: 23 });
  c.fillStyle = '#1d4f91'; c.font = '800 30px "Fira Sans", sans-serif'; c.textAlign = 'center'; c.fillText('LOGO', x, y - 92);
  c.strokeStyle = '#1d4f91'; c.lineWidth = 3; c.beginPath(); c.ellipse(x, y - 102, 64, 38, 0, 0, 7); c.stroke();
  // boyun
  boya(x - 20, y - 196, 40, 34, 6, { renk: '#3b3e46', koyu: '#2b2d33', iz: false, kontur: 4.5, seed: 24 });
  // kafa
  const hw = 250, hh = 182, hx = x - hw / 2, hy = y - 196 - hh + 6;
  boya(x - 40, hy - 26, 80, 34, 12, { renk: '#3b3e46', koyu: '#2b2d33', iz: false, kontur: 4.5, seed: 25 });
  boya(hx + hw - 10, hy + 54, 24, 72, 8, { renk: '#3b3e46', koyu: '#2b2d33', iz: false, kontur: 4.5, seed: 26 });
  boya(hx, hy, hw, hh, 42, { renk: '#33363d', acik: '#4a4e57', koyu: '#25272c', tarama: '#16171a', seed: 27 });
  yuvarlak(hx + 22, hy + 22, hw - 44, hh - 44, 28); c.fillStyle = '#0d0e12'; c.fill();
  // ekrandaki gözler
  const g = o.goz || {}, gx = (g.bak || 0) * 0.8, ey = hy + hh / 2;
  c.save(); c.shadowColor = 'rgba(127,230,240,.8)'; c.shadowBlur = 22;
  for (const s of [-1, 1]) {
    const ex = x + s * 50 + gx;
    if (g.mutlu) { c.strokeStyle = '#86e9f2'; c.lineWidth = 9; c.lineCap = 'round'; c.beginPath(); c.moveTo(ex - 20, ey + 10); c.quadraticCurveTo(ex, ey - 22, ex + 20, ey + 10); c.stroke(); }
    else { const yh = Math.max(6, 70 * (1 - (g.kapali || 0))); c.fillStyle = '#86e9f2'; c.beginPath(); c.ellipse(ex, ey, 16, yh / 2, 0, 0, 7); c.fill(); }
  }
  c.restore();
  // ekran camı parıltısı
  c.save(); c.globalAlpha = 0.08; c.fillStyle = '#fff'; c.beginPath(); c.moveTo(hx + 40, hy + 24); c.lineTo(hx + 110, hy + 24); c.lineTo(hx + 60, hy + hh - 24); c.lineTo(hx - 10, hy + hh - 24); c.closePath(); c.fill(); c.restore();
}

function replitLogo(cx, cy, s, renk = '#f26207') {
  // üç blok: sol üst, sağ orta, sol alt
  c.fillStyle = renk;
  const b = (x, y, w) => { c.beginPath(); c.roundRect(cx + x * s, cy + y * s, w * s, s, s * 0.2); c.fill(); };
  b(-1, -1.5, 1.8); b(0, -0.5, 1.2); b(-1, 0.5, 1.8);
  c.fillRect(cx - s * 0.2, cy - s * 0.5, s * 0.4, s);
}

function dizustu(x, y, logo = true) {
  // arkadan görünen kapak: referanstaki gibi düz, krem, sağda gölge bandı
  boya(x - 150, y - 112, 300, 112, 12, { renk: '#e6e1d5', acik: '#f6f3ec', koyu: '#cfc8b8', kontur: 4.5, seed: 31 + x, bant: 0.24 });
  if (logo) replitLogo(x - 2, y - 58, 13);
  boya(x - 162, y - 6, 324, 14, 5, { renk: '#d2ccbe', koyu: '#b8b1a1', iz: false, kontur: 4, seed: 33 });
}

function masa() {
  const x0 = 470, x1 = 1450, ust = 640;
  // bacaklar ve çekmece
  boya(x0 + 26, ust + 40, 28, ZEMIN_Y - ust - 40, 3, { renk: '#b88f61', koyu: '#9a744b', iz: false, kontur: 4.5, seed: 41 });
  boya(x1 - 54, ust + 40, 28, ZEMIN_Y - ust - 40, 3, { renk: '#b88f61', koyu: '#9a744b', iz: false, kontur: 4.5, seed: 42 });
  boya(x1 - 250, ust + 40, 200, 110, 4, { renk: '#c69c6c', acik: '#d9b585', koyu: '#a87f52', kontur: 4.5, seed: 43 });
  c.strokeStyle = MUREKKEP; c.lineWidth = 3.5;
  c.beginPath(); c.moveTo(x1 - 250, ust + 95); c.lineTo(x1 - 50, ust + 95); c.stroke();
  for (const yy of [ust + 68, ust + 123]) { yuvarlak(x1 - 172, yy - 4, 44, 8, 4); c.stroke(); }
  // üst tabla: derinlikli
  c.beginPath(); c.moveTo(x0 + 20, ust - 20); c.lineTo(x1 - 20, ust - 20); c.lineTo(x1, ust); c.lineTo(x0, ust); c.closePath();
  c.fillStyle = '#d6ae7c'; c.fill();
  c.save(); c.clip(); c.strokeStyle = 'rgba(150,105,60,.35)'; c.lineWidth = 1.2; tohum(44);
  for (let i = 0; i < 26; i++) { const yy = ust - 18 + rng() * 17, xx = x0 + rng() * (x1 - x0); c.beginPath(); c.moveTo(xx, yy); c.lineTo(xx + 60 + rng() * 140, yy); c.stroke(); }
  c.restore();
  c.strokeStyle = MUREKKEP; c.lineWidth = 4.5; c.lineJoin = 'round'; c.stroke();
  boya(x0, ust, x1 - x0, 40, 4, { renk: '#c79d6a', acik: '#ddb889', koyu: '#a77d4f', kontur: 4.5, seed: 45, bant: 0.04 });
}

/* ---------------------------------------------------------- sahne */
function ciz(tt) {
  const t = ((tt % SURE) + SURE) % SURE;
  c.drawImage(kagit, 0, 0);
  c.strokeStyle = 'rgba(42,29,24,.55)'; c.lineWidth = 1.5;
  c.beginPath(); c.moveTo(150, ZEMIN_Y); c.lineTo(W - 150, ZEMIN_Y); c.stroke();
  golge(960, ZEMIN_Y + 4, 560, 16, 0.4);

  const kirp = (t % 3.2) > 3.05 ? 1 : 0;
  claude(760, 612, { t, kolOyna: true, goz: { bak: 6, kapali: kirp } });
  bytRobot(1180, 572, { goz: { bak: -8, kapali: (t % 4.1) > 3.95 ? 1 : 0 } });
  masa();
  dizustu(760, 620);
  dizustu(1180, 620);
}

window.ciz = ciz;
if (!new URLSearchParams(location.search).has('kayit')) {
  document.fonts.ready.then(() => { const bas = performance.now(); const dongu = (n) => { ciz((n - bas) / 1000); requestAnimationFrame(dongu); }; requestAnimationFrame(dongu); });
}
