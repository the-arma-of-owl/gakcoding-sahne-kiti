/* Sahne sunumu motoru. Bağımlılık yok, tek dosya.

   Üç kip:
     normal      seyircinin gördüğü pencere
     ?sunucu     sunucu görünümü: şu anki + sonraki slayt, notlar, süre, saat
     ?onizleme   sunucu görünümünün içindeki iframe'ler: tuş dinlemez, yayın yapmaz

   Pencereler BroadcastChannel ile senkron kalır. Kim gezinirse durumu yayınlar,
   diğerleri sessizce uygular. Adres #5 ya da #5.2 (slayt.adım) biçimindedir. */

const params = new URLSearchParams(location.search);
// ?izle: sahne panelindeki küçük önizleme; sunumu dinleyip aynı slaytı gösterir, kendisi yönetmez
const MODE = params.has('sunucu') ? 'presenter' : params.has('onizleme') ? 'preview' : params.has('izle') ? 'follow' : 'normal';
const root = document.documentElement;
root.dataset.mode = MODE;

const deck = document.getElementById('deck');
const slides = [...deck.querySelectorAll('.slide')];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ------------------------------------------------------------- ölçekleme */

function fit() {
  const scale = Math.min(innerWidth / 1920, innerHeight / 1080);
  deck.style.setProperty('--scale', scale);
}
addEventListener('resize', fit);
fit();

/* ---------------------------------------------------------- bölümler */

const chapters = [];
slides.forEach((slide, i) => {
  const name = slide.dataset.chapter || (chapters.at(-1)?.name ?? 'Giriş');
  if (!chapters.length || chapters.at(-1).name !== name) chapters.push({ name, start: i });
  slide.dataset.chapterIndex = chapters.length;
  slide.dataset.chapter = name;
  slide.steps = [...slide.querySelectorAll('.step')];
});

/* görsel yüklenemezse yedek görünüm devreye girer, sunum asla kırık resim göstermez */
for (const art of deck.querySelectorAll('.art')) {
  const slide = art.closest('.slide');
  art.dataset.label ||= String(slide.dataset.chapterIndex).padStart(2, '0');
  const video = art.querySelector('video');
  const img = art.querySelector('img');
  const miss = () => art.classList.add('art-missing');
  if (video) {
    /* video yüklenemezse poster resmi, o da yoksa yedek görünüm */
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = 'none';
    const fail = () => {
      if (!video.poster) { miss(); return; }
      const still = document.createElement('img');
      still.src = video.poster;
      still.alt = '';
      still.addEventListener('error', miss);
      video.replaceWith(still);
    };
    video.addEventListener('error', fail);
    video.querySelector('source')?.addEventListener('error', fail);
    continue;
  }
  if (!img) { miss(); continue; }
  if (img.complete && !img.naturalWidth) miss();
  img.addEventListener('error', miss);
}

/* sadece ekrandaki slaytın videoları oynar, gerisi durur: projektör bilgisayarı yorulmasın */
function syncVideos() {
  slides.forEach((slide, k) => {
    for (const video of slide.querySelectorAll('.art video, .well video')) {
      if (k === index) {
        clearTimeout(video._birak);
        if (video.dataset.kaynak && !video.getAttribute('src')) video.src = video.dataset.kaynak;
        if (root.dataset.paused !== 'true') video.play().catch(() => {});
        else video.pause();
      } else {
        video.pause();
        videoBirak(video);
      }
    }
  });
}

/* tarayıcı bir sunucuya en fazla 6 bağlantı açar; durmuş video bağlantısını bırakmaz.
   bu yüzden ekrandan çıkan videonun kaynağı sökülür, yoksa sonraki video açılmaz */
function videoBirak(video) {
  const src = video.getAttribute('src');
  if (!src) return;
  video.dataset.kaynak = src;
  clearTimeout(video._birak);
  video._birak = setTimeout(() => {
    video.removeAttribute('src');
    video.load();
  }, 800);
}

/* ------------------------------------------------------------ durum çubuğu */

const $ = (sel) => document.querySelector(sel);
const slNum = $('#sl-num');
const slName = $('#sl-name');
const slProg = $('#sl-prog');
const slCount = $('#sl-count');
const bgArt = $('#bg-art');

slProg.replaceChildren(...slides.map(() => document.createElement('i')));

function paintStatus(i) {
  const slide = slides[i];
  slNum.textContent = String(slide.dataset.chapterIndex).padStart(2, '0');
  slName.textContent = slide.dataset.chapter;
  slCount.textContent = `${String(i + 1).padStart(2, '0')}/${String(slides.length).padStart(2, '0')}`;
  [...slProg.children].forEach((cell, k) => {
    cell.className = k < i ? 'on' : k === i ? 'here' : '';
  });
}

/* oda rengi: bu slaytın ya da aynı bölümde önceki slaytın görseli */
function paintRoom(i) {
  let src = '';
  for (let k = i; k >= 0 && slides[k].dataset.chapter === slides[i].dataset.chapter; k -= 1) {
    const art = slides[k].querySelector('.art:not(.art-missing)');
    const media = art?.querySelector('img, video');
    if (media) { src = media.poster || media.currentSrc || media.src; }
    if (src) break;
  }
  if (src) bgArt.style.backgroundImage = `url("${src}")`;
  bgArt.dataset.on = src ? 'true' : 'false';
}

/* ------------------------------------------------------------ piksel geçiş */

const wipeCanvas = $('#wipe');
const wipeCtx = wipeCanvas.getContext('2d');

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function animate(duration, step) {
  return new Promise((resolve) => {
    const start = performance.now();
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(guard);
      step(1);
      resolve();
    };
    /* sekme yavaşlarsa bile geçiş takılı kalmaz */
    const guard = setTimeout(finish, duration + 500);
    const run = (now) => {
      if (done) return;
      const t = Math.min(1, (now - start) / duration);
      step(t);
      if (t < 1) requestAnimationFrame(run); else finish();
    };
    requestAnimationFrame(run);
  });
}

const css = (name) => getComputedStyle(root).getPropertyValue(name).trim();

async function runWipe(swap) {
  if (reducedMotion || MODE !== 'normal') { swap(); return; }
  wipeCanvas.width = 1920;
  wipeCanvas.height = 1080;
  const cell = 32;
  const list = [];
  for (let y = 0; y < 1080; y += cell) for (let x = 0; x < 1920; x += cell) list.push([x, y]);
  const random = rng(0x5eed);
  for (let k = list.length - 1; k > 0; k -= 1) {
    const j = Math.floor(random() * (k + 1));
    [list[k], list[j]] = [list[j], list[k]];
  }
  const base = css('--bg-deep');
  const a = css('--clay');
  const b = css('--gold');
  wipeCanvas.dataset.active = 'true';
  let drawn = 0;
  await animate(220, (t) => {
    const target = Math.floor(list.length * (t * t * (3 - 2 * t)));
    for (; drawn < target; drawn += 1) {
      const [x, y] = list[drawn];
      wipeCtx.fillStyle = drawn % 23 === 0 ? a : drawn % 37 === 0 ? b : base;
      wipeCtx.fillRect(x, y, cell, cell);
    }
  });
  swap();
  let left = list.length;
  await animate(260, (t) => {
    const target = Math.floor(list.length * (1 - t * t * (3 - 2 * t)));
    for (; left > target; left -= 1) {
      const [x, y] = list[left - 1];
      wipeCtx.clearRect(x, y, cell, cell);
    }
  });
  wipeCtx.clearRect(0, 0, 1920, 1080);
  wipeCanvas.dataset.active = 'false';
}

/* ------------------------------------------------------------ yönlendirme */

let index = -1;
let step = 0;
let busy = false;
let pending = null;
const channel = MODE === 'preview' || !('BroadcastChannel' in window) ? null : new BroadcastChannel('sahne-sunumu');

function paintSteps() {
  slides[index].steps.forEach((el, k) => {
    el.classList.toggle('is-on', k < step);
    el.classList.toggle('is-last', k === step - 1);
  });
}

async function show(i, s = 0, { broadcast = true } = {}) {
  i = Math.max(0, Math.min(slides.length - 1, i));
  s = Math.max(0, Math.min(slides[i].steps.length, s));
  if (i === index && s === step) return;
  /* geçiş sürerken gelen istek kaybolmaz, geçiş bitince uygulanır */
  if (busy) { pending = [i, s, { broadcast }]; return; }

  const from = slides[index];
  const to = slides[i];
  const wipe = from && from !== to && (from.dataset.chapter !== to.dataset.chapter || to.dataset.layout === 'opener');

  const swap = () => {
    from?.classList.remove('is-current');
    to.classList.add('is-current');
    deck.dataset.layout = to.dataset.layout || 'stack';
    index = i;
    step = s;
    paintSteps();
    paintStatus(i);
    paintRoom(i);
    syncVideos();
  };

  if (from === to) {
    step = s;
    paintSteps();
  } else if (wipe) {
    busy = true;
    await runWipe(swap);
    busy = false;
    if (pending) { const args = pending; pending = null; show(...args); }
  } else {
    swap();
  }

  history.replaceState(null, '', `#${index + 1}${step ? '.' + step : ''}`);
  if (broadcast) channel?.postMessage({ type: 'state', i: index, s: step });
  document.dispatchEvent(new CustomEvent('deck:change', { detail: { i: index, s: step } }));
}

function next() {
  if (step < slides[index].steps.length) show(index, step + 1);
  else if (index < slides.length - 1) show(index + 1, 0);
}
function prev() {
  if (step > 0) show(index, step - 1);
  else if (index > 0) show(index - 1, slides[index - 1].steps.length);
}

function readHash() {
  const m = location.hash.match(/^#(\d+)(?:\.(\d+))?/);
  return m ? [Number(m[1]) - 1, Number(m[2] || 0)] : [0, 0];
}

addEventListener('hashchange', () => {
  const [i, s] = readHash();
  show(i, s, { broadcast: MODE === 'normal' });
});

channel?.addEventListener('message', ({ data }) => {
  if (data?.type === 'state') show(data.i, data.s, { broadcast: false });
  if (data?.type === 'hello' && (MODE === 'normal' || MODE === 'presenter')) channel.postMessage({ type: 'state', i: index, s: step });
});

/* ------------------------------------------------------------- yardımcılar */

const toast = $('#toast');
let toastTimer = 0;
function flash(text) {
  toast.textContent = text;
  toast.dataset.on = 'true';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.dataset.on = 'false'; }, 1800);
}

function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen();
  else root.requestFullscreen?.().catch(() => flash('Tam ekran açılamadı'));
}

function togglePause() {
  root.dataset.paused = root.dataset.paused === 'true' ? 'false' : 'true';
  syncVideos();
  flash(root.dataset.paused === 'true' ? 'Animasyonlar durdu' : 'Animasyonlar devam');
}

/* ------------------------------------------------------------ bölüm listesi */

const palette = $('#palette');
const paletteInput = $('#palette-input');
const paletteList = $('#palette-list');
let rows = [];
let cursor = 0;

function slideTitle(slide) {
  return (slide.dataset.title || slide.querySelector('.title, .quote, .big-num')?.textContent || '').replace(/\s+/g, ' ').trim();
}

function renderPalette() {
  const q = paletteInput.value.toLocaleLowerCase('tr').replace(/^\//, '').trim();
  rows = slides
    .map((slide, i) => ({ i, chapter: slide.dataset.chapter, title: slideTitle(slide) }))
    .filter((r) => !q || String(r.i + 1) === q || `${r.chapter} ${r.title}`.toLocaleLowerCase('tr').includes(q));
  cursor = Math.max(0, Math.min(cursor, rows.length - 1));
  paletteList.replaceChildren(...rows.map((r, k) => {
    const li = document.createElement('li');
    li.setAttribute('role', 'option');
    li.setAttribute('aria-selected', String(k === cursor));
    li.innerHTML = '<b></b><span></span><i></i>';
    li.children[0].textContent = String(r.i + 1).padStart(2, '0');
    li.children[1].textContent = r.chapter;
    li.children[2].textContent = r.title;
    li.addEventListener('click', () => choose(k));
    return li;
  }));
  paletteList.children[cursor]?.scrollIntoView({ block: 'nearest' });
}
function openPalette() {
  palette.hidden = false;
  paletteInput.value = '';
  cursor = index;
  renderPalette();
  paletteInput.focus();
}
function closePalette() {
  palette.hidden = true;
  paletteInput.blur();
}
function choose(k) {
  const r = rows[k];
  closePalette();
  if (r) show(r.i, 0);
}
paletteInput.addEventListener('input', () => { cursor = 0; renderPalette(); });
paletteInput.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown') { cursor = Math.min(rows.length - 1, cursor + 1); renderPalette(); e.preventDefault(); }
  else if (e.key === 'ArrowUp') { cursor = Math.max(0, cursor - 1); renderPalette(); e.preventDefault(); }
  else if (e.key === 'Enter') { choose(cursor); e.preventDefault(); }
  else if (e.key === 'Escape') { closePalette(); e.preventDefault(); }
  e.stopPropagation();
});

/* ------------------------------------------------------------------ tuşlar */

let digits = '';
let digitTimer = 0;

function onKey(e) {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key;
  if (/^\d$/.test(k)) {
    digits += k;
    clearTimeout(digitTimer);
    digitTimer = setTimeout(() => { digits = ''; }, 1400);
    flash(`Slayt ${digits}, Enter ile git`);
    return;
  }
  switch (k) {
    // ses tuşları: Bluetooth selfie kumandası ya da telefonun ses tuşu (tarayıcıya ulaşırsa)
    case 'ArrowRight': case 'ArrowDown': case 'PageDown': case ' ': case 'AudioVolumeUp':
      e.preventDefault(); next(); break;
    case 'ArrowLeft': case 'ArrowUp': case 'PageUp': case 'Backspace': case 'AudioVolumeDown':
      e.preventDefault(); prev(); break;
    case 'Home': show(0, 0); break;
    case 'End': show(slides.length - 1, 0); break;
    case 'Enter':
      if (digits) { show(Number(digits) - 1, 0); digits = ''; } else next();
      break;
    case 'f': case 'F': toggleFullscreen(); break;
    case 'b': case 'B': case '.':
      root.dataset.black = root.dataset.black === 'true' ? 'false' : 'true'; break;
    case 'p': case 'P': togglePause(); break;
    case '/': case 'o': case 'O': openPalette(); break;
    case 's': case 'S':
      if (MODE === 'normal') window.open(`${location.pathname}?sunucu${location.hash}`, 'sahne-sunucu', 'width=1400,height=860');
      break;
    case 'h': case 'H':
      flash('→ ileri · ← geri · F tam ekran · S sunucu · B karart · / bölümler · P duraklat');
      break;
    default: return;
  }
  e.preventDefault();
}

/* fare: tıklama ileri, sağ tık geri; 2 saniye kıpırdamazsa imleç gizlenir */
let idle = 0;
function wake() {
  document.body.style.cursor = '';
  clearTimeout(idle);
  idle = setTimeout(() => { document.body.style.cursor = 'none'; }, 2000);
}

/* ------------------------------------------------------------ sunucu kipi */

function mountPresenter() {
  const target = Number(document.querySelector('meta[name="sure"]')?.content || 0) * 60;
  const wrap = document.createElement('div');
  wrap.className = 'presenter';
  wrap.innerHTML = `
    <div class="presenter-bar">
      <span class="presenter-timer" id="p-timer">00:00</span>
      <span class="presenter-clock" id="p-clock"></span>
      <span>← → gezin · T süreyi sıfırla</span>
      <span class="presenter-count" id="p-count"></span>
    </div>
    <div class="presenter-frame"><span class="presenter-label">şu an</span><iframe id="p-now" tabindex="-1"></iframe></div>
    <div class="presenter-side">
      <div class="presenter-frame"><span class="presenter-label">sonraki</span><iframe id="p-next" tabindex="-1"></iframe></div>
      <div class="presenter-notes" id="p-notes"></div>
    </div>`;
  document.body.append(wrap);
  $('.viewport').style.display = 'none';

  const base = `${location.pathname}?onizleme`;
  const now = $('#p-now');
  const nxt = $('#p-next');
  /* iframe yüklenmeden hash değiştirilemez: yüklenene kadar adresi src ile ver */
  const setFrame = (frame, hash) => {
    if (frame.dataset.ready) frame.contentWindow.location.hash = hash;
    else frame.src = base + hash;
  };
  for (const frame of [now, nxt]) frame.addEventListener('load', () => { frame.dataset.ready = 'true'; }, { once: true });

  let started = 0;
  let booted = false;
  const pad = (n) => String(n).padStart(2, '0');
  setInterval(() => {
    const d = new Date();
    $('#p-clock').textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    const sec = started ? Math.floor((Date.now() - started) / 1000) : 0;
    const timer = $('#p-timer');
    timer.textContent = `${pad(Math.floor(sec / 60))}:${pad(sec % 60)}${target ? ` / ${pad(target / 60)}:00` : ''}`;
    timer.dataset.over = String(Boolean(target) && sec > target);
  }, 250);

  document.addEventListener('deck:change', ({ detail }) => {
    /* süre, açılıştan sonraki ilk gezinmede başlar */
    if (booted && !started) started = Date.now();
    booted = true;
    const slide = slides[detail.i];
    setFrame(now, `#${detail.i + 1}.${detail.s}`);
    const [ni, ns] = detail.s < slide.steps.length ? [detail.i, detail.s + 1] : [detail.i + 1, 0];
    setFrame(nxt, ni < slides.length ? `#${ni + 1}.${ns}` : `#${slides.length}.${slide.steps.length}`);
    $('#p-count').textContent = `${detail.i + 1}/${slides.length} · ${slide.dataset.chapter}`;
    const notes = slide.querySelector('.notes');
    const left = slide.steps.length - detail.s;
    $('#p-notes').innerHTML = (left ? `<p class="steps-left">bu slaytta ${left} adım daha var</p>` : '') +
      (notes ? notes.innerHTML : '<p style="opacity:.5">Not yok.</p>');
  });
  addEventListener('keydown', (e) => {
    if (e.key === 't' || e.key === 'T') { started = Date.now(); flash('Süre sıfırlandı'); }
  });
}

/* ------------------------------------------------------------------ başlat */

if (MODE === 'normal' || MODE === 'presenter') {
  addEventListener('keydown', onKey);
  addEventListener('mousemove', wake);
  deck.addEventListener('click', (e) => {
    if (e.target.closest('a, button, input, .palette')) return;
    next();
  });
  deck.addEventListener('contextmenu', (e) => { e.preventDefault(); prev(); });
}
if (MODE === 'presenter') mountPresenter();

{
  const [i, s] = readHash();
  show(i, s, { broadcast: false });
}
channel?.postMessage({ type: 'hello' });
