/* Seyircinin gördüğü ekran. Durumu kontrol panelinden alır, müziği burada çalar. */
import { ETKINLIK, oku, yaz, taslakOku, dinle, gonder, panikDegis, PANIK_TUSLARI, saatMs, sureYaz, kacir, kapakAdresi, aktifListe, siradakiler, karistir, videoKimligi, resimYerlestir, resimTemizle } from './ortak.js?v=11';

const tuval = document.getElementById('tuval');
// ?taslak: paneldeki taslak önizlemesi (müzik ve istekler her zaman canlıdan gelir)
const TASLAK_MOD = new URLSearchParams(location.search).has('taslak');
const canliMuzik = (d) => { const c = oku(); return { ...d, istekler: c.istekler, muzik: c.muzik }; };
const durumOku = () => TASLAK_MOD ? canliMuzik(taslakOku()) : oku();
let S = durumOku();

/* ---------------------------------------------------------- ölçek, imleç */
/* Genişlik hep 1920; yükseklik perdenin oranına uyar (16:9 -> 1080, 16:10 -> 1200, 4:3 -> 1440).
   Arka planlar perdeyi doldurur, kutular kenarlara yaslı kalır. 16:9'dan geniş ya da 4:3'ten
   dik pencerede kenarda boşluk kalır (çok geniş/dik ekranda tasarım bozulmasın). */
function sigdir() {
  const yukseklik = Math.round(Math.min(1440, Math.max(1080, 1920 * innerHeight / innerWidth)));
  tuval.style.height = yukseklik + 'px';
  tuval.style.setProperty('--olcek', Math.min(innerWidth / 1920, innerHeight / yukseklik));
}
const ONIZLEME_PENCERE = new URLSearchParams(location.search).has('onizleme');
addEventListener('resize', sigdir); sigdir();
let imlecZ;
addEventListener('mousemove', () => { document.body.classList.add('imlec'); clearTimeout(imlecZ); imlecZ = setTimeout(() => document.body.classList.remove('imlec'), 2000); });
addEventListener('keydown', (e) => {
  if (S.sahne !== 'sunum') return;
  const yon = { ArrowRight: 'ileri', PageDown: 'ileri', ' ': 'ileri', ArrowLeft: 'geri', PageUp: 'geri' }[e.key];
  if (yon) { e.preventDefault(); gonder({ tur: 'deste', yon }); }
});
addEventListener('keydown', (e) => { if (e.key === 'f') document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen(); });
// panik tuşu salon ekranının penceresinde de çalışır (panelin önizlemelerinde değil)
addEventListener('keydown', (e) => { if (!ONIZLEME_PENCERE && PANIK_TUSLARI.includes(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); S.panik = panikDegis(); uygula(); } }); // kendi yazdığı mesajı kanaldan almaz, elle uygular
document.querySelector('.serit .yer').textContent = ETKINLIK.tarih;

/* ---------------------------------------------------------- QR */
const qrOnbellek = {};
function qrSvg(url) {
  if (!qrOnbellek[url]) { const q = qrcode(0, 'M'); q.addData(url); q.make(); qrOnbellek[url] = q.createSvgTag({ cellSize: 4, margin: 0, scalable: true }); }
  return qrOnbellek[url];
}
function qrCiz() {
  document.querySelectorAll('[data-qr]').forEach((el) => {
    const url = S.qr[el.dataset.qr];
    if (el.dataset.url === url) return;
    el.dataset.url = url;
    if (!url) { el.classList.add('bos'); el.textContent = 'QR linki ayarlanmadı'; return; }
    el.classList.remove('bos');
    el.innerHTML = qrSvg(url);
  });
}

/* isteğe bağlı görsel: yoksa gizli */
function resim(id, yol) {
  const el = document.getElementById(id);
  el.hidden = !yol;
  if (yol && el.getAttribute('src') !== yol) el.src = yol;
}

// yuvarlak çerçeveli resim; kirp = panelde ayarlanan yer (bkz. ortak.js resimYerlestir)
function yuvarlak(id, yol, kirp, tur) {
  const img = document.getElementById(id);
  document.getElementById(id + '-kutu').hidden = !yol;
  if (yol && img.getAttribute('src') !== yol) img.src = yol;
  resimYerlestir(img, kirp, tur);
}

/* ---------------------------------------------------------- sahne */
let sunumAcildi = false, sonKonusmaci = '', kGecis;
/* konuşmacı ekranının içeriği (ad, unvan, foto, logo, arka görsel) */
function konusmaciCiz(k) {
  document.getElementById('k-ad').textContent = k.ad || '';
  document.getElementById('k-unvan').textContent = k.unvan || '';
  document.getElementById('k-konu').textContent = k.konu || '';
  yuvarlak('k-foto', k.foto, k.fotoKirp, 'foto'); yuvarlak('k-logo', k.logo, k.logoKirp, 'logo');
  const arka = k.arka || S.konusmaciArka || '';
  const ka = document.getElementById('k-arka'), hedef = arka || 'assets/giris/arka-temiz.webp';
  if (ka.getAttribute('src') !== hedef) ka.src = hedef;
  resim('k-arka-bulanik', arka);
  // yüklenen arka görselin kırpması: konuşmacıya özel görselin kendi ayarı, yoksa genel görselin ayarı
  if (arka) resimYerlestir(ka, k.arka ? k.arkaKirp : S.konusmaciArkaKirp, 'arka'); else resimTemizle(ka);
  document.getElementById('s-konusmaci').classList.toggle('ozel-arka', !!arka);
  document.getElementById('s-konusmaci').classList.toggle('foto-var', !!k.foto);
}

/* ---------------------------------------------------------- takım sahnede */
let sonTakim = '', tGecis, sonMedya = '';
const tMedya = document.getElementById('t-medya');
const aktifTakim = () => S.takimlar.find((x) => x.id === S.aktifTakim) || S.takimlar[0] || {};
const medyaAcik = () => S.sahne === 'takim' && S.takimMod !== 'kart' && !S.panik;
function takimCiz(t) {
  document.getElementById('t-derece').textContent = t.derece || '';
  document.getElementById('t-ad').textContent = t.ad || '';
  document.getElementById('t-proje').textContent = t.proje || '';
  document.getElementById('t-odul').textContent = t.odul || '';
  document.getElementById('t-uyeler').textContent = String(t.uyeler || '').split(',').map((x) => x.trim()).filter(Boolean).join(' · ');
  yuvarlak('t-foto', t.foto, t.fotoKirp, 'foto');
  document.getElementById('t-site-kutu').hidden = !t.site;
  if (t.site) {
    document.getElementById('t-site').textContent = t.site.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
    document.getElementById('t-qr').innerHTML = qrSvg(t.site);
  }
}
const ytKomut = (func, args = []) => tMedya.querySelector('iframe.yt')?.contentWindow.postMessage(JSON.stringify({ event: 'command', func, args }), '*');
function sesKesUygula() {
  const v = tMedya.querySelector('video');
  if (v) v.muted = !!S.sesKes;
  ytKomut(S.sesKes ? 'mute' : 'unMute');
}
/* canlı site, video ya da YouTube salonda tuvali kaplar; panikte kaldırılır. Panel önizlemesi yalnız etiket gösterir. */
function medyaUygula(t) {
  const acik = medyaAcik(), mod = S.takimMod, ad = { site: 'Canlı site', video: 'Video', yt: 'YouTube' }[mod];
  const on = document.getElementById('t-oniz');
  on.hidden = !(ONIZLEME && acik); on.textContent = ad || '';
  const adres = { site: t.site, video: t.video, yt: videoKimligi(t.yt) }[mod] || '';
  const anahtar = acik && !ONIZLEME && adres ? `${mod}|${adres}` : '';
  tuval.classList.toggle('t-medya-acik', !!anahtar);
  if (anahtar === sonMedya) return sesKesUygula();
  sonMedya = anahtar;
  tMedya.innerHTML = ''; tMedya.hidden = !anahtar;
  if (!anahtar) return;
  if (mod === 'video') {
    const v = Object.assign(document.createElement('video'), { src: adres, controls: false, playsInline: true, muted: !!S.sesKes });
    tMedya.append(v);
    v.play().catch(() => { perde.hidden = false; });
    return;
  }
  const f = document.createElement('iframe');
  f.allow = 'autoplay; fullscreen';
  if (mod === 'yt') {
    f.className = 'yt';
    f.src = `https://www.youtube.com/embed/${encodeURIComponent(adres)}?autoplay=1&rel=0&playsinline=1&enablejsapi=1&origin=${encodeURIComponent(location.origin)}`;
    f.addEventListener('load', () => setTimeout(sesKesUygula, 800));
  } else {
    f.className = 'site';
    f.sandbox = 'allow-scripts allow-same-origin allow-forms allow-popups allow-downloads'; // takımın sitesi salon ekranını başka adrese götüremez
    f.src = adres;
  }
  tMedya.append(f);
}

function uygula() {
  const onceki = tuval.dataset.sahne;
  tuval.dataset.sahne = S.sahne;
  const e = S.ekran?.[S.sahne] || {};
  tuval.classList.toggle('qr-yok', !S.sarkiKutusu || e.qr === false);
  tuval.classList.toggle('calar-yok', !S.sarkiKutusu || e.calar === false);
  // panelde kapatılan öğeler: yok-<anahtar> sınıfı (video kapalıyken müzik çalmaya devam eder, yalnız görüntü gizlenir)
  for (const k of ['video', 'sira', 'logolar', 'arkaVideo', 'kilim', 'serit', 'etiket']) tuval.classList.toggle('yok-' + k, e[k] === false);
  document.querySelectorAll('.sahne').forEach((s) => s.classList.toggle('acik', s.id === `s-${S.sahne}`));
  // sunumda arka video görünmez; boşuna çözülmesin
  const av = document.getElementById('arka-video');
  if (S.panik || S.sahne === 'sunum' || S.sahne === 'konusmaci' || medyaAcik()) av.pause(); else if (av.paused) av.play().catch(() => {});
  document.getElementById('panik').hidden = !S.panik || TASLAK_MOD; // taslak önizlemesi panikte de taslağı gösterir
  document.querySelectorAll('[data-alan]').forEach((el) => {
    const [a, b] = el.dataset.alan.split('.');
    el.textContent = S[a]?.[b] ?? '';
  });
  const k = S.konusmacilar.find((x) => x.id === S.aktifKonusmaci) || S.konusmacilar[0] || {};
  const kAnahtar = JSON.stringify([k, S.konusmaciArka, S.konusmaciArkaKirp]);
  // salonda konuşmacı ekranı açıkken kişi değişirse eskisi solup yenisi gelir; diğer durumlarda hemen yazılır
  if (kAnahtar !== sonKonusmaci) {
    sonKonusmaci = kAnahtar;
    clearTimeout(kGecis);
    const kutu = document.getElementById('s-konusmaci');
    if (onceki === 'konusmaci' && S.sahne === 'konusmaci' && !ONIZLEME) {
      kutu.classList.add('degisiyor');
      kGecis = setTimeout(() => { konusmaciCiz(k); kutu.classList.remove('degisiyor'); }, 650);
    } else { kutu.classList.remove('degisiyor'); konusmaciCiz(k); }
  }
  const t = aktifTakim(), tAnahtar = JSON.stringify(t);
  if (tAnahtar !== sonTakim) {
    sonTakim = tAnahtar;
    clearTimeout(tGecis);
    const kutu = document.getElementById('s-takim');
    if (onceki === 'takim' && S.sahne === 'takim' && !ONIZLEME) {
      kutu.classList.add('degisiyor');
      tGecis = setTimeout(() => { takimCiz(t); kutu.classList.remove('degisiyor'); }, 650);
    } else { kutu.classList.remove('degisiyor'); takimCiz(t); }
  }
  medyaUygula(t);
  if (S.sahne === 'sunum' && !sunumAcildi) {
    sunumAcildi = true;
    // panel önizlemesi desteyi yalnız izler (?izle): salondaki slaytı gösterir, komut uygulamaz
    document.getElementById('s-sunum').innerHTML = `<iframe src="../deste/index.html?${ONIZLEME ? 'izle&' : ''}tema=gece&v=14" allow="autoplay; fullscreen"></iframe>`;
  }
  const sira = document.getElementById('sira');
  const sonraki = siradakiler(S, 4);
  sira.innerHTML = sonraki.length
    ? sonraki.map((r) => `<li>${kapakAdresi(r) ? `<img src="${kacir(kapakAdresi(r))}" alt="">` : ''}${kacir(r.baslik || 'İstek')}${r.kim ? ` · <span style="color:var(--fg-mute)">${kacir(r.kim)}</span>` : ''}</li>`).join('')
    : '<li class="bos">Şarkı iste, QR\'ı okut.</li>';
  qrCiz();
  galeriKaynakDegisti();
  muzikUygula(onceki !== S.sahne);
}

/* ---------------------------------------------------------- saat ve sayaçlar */
// piksel fontta rakam genişlikleri farklı: her karakter sabit kutuda, saniye değişince yazı kaymaz
const rakamKutu = (t) => [...t].map((c) => `<span class="${c === ':' ? 'ayr' : 'r'}">${c}</span>`).join('');
const htmlYaz = (id, html) => { const el = document.getElementById(id); if (el.innerHTML !== html) el.innerHTML = html; };
function tik() {
  const simdi = Date.now();
  document.getElementById('saat').textContent = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  const bitis = saatMs(S.kodlamaBitis), kalan = bitis - simdi;
  document.getElementById('kod-sol').classList.toggle('bitti', bitis > 0 && kalan <= 0);
  htmlYaz('kod-geri', !bitis ? rakamKutu('--:--:--') : kalan > 0 ? rakamKutu(sureYaz(kalan)) : 'Süre doldu');
  // bar: kalan süre / paneldeki toplam süre; bitiş uzatılıp toplamı aşarsa dolu kalır
  const toplam = Math.max(0.25, +S.kodlamaSaat || 6) * 3600000;
  const oran = bitis ? Math.min(1, Math.max(0, kalan / toplam)) : 0;
  document.getElementById('kod-bar-dolu').style.width = (oran * 100).toFixed(2) + '%';
  document.getElementById('kod-bar').hidden = !bitis;
  document.getElementById('kod-alt').textContent = bitis ? `Teslim saati ${S.kodlamaBitis} · kalan %${Math.round(oran * 100)}` : '';
  const mk = S.molaBitis - simdi;
  htmlYaz('mola-geri', S.molaBitis ? rakamKutu(mk > 0 ? sureYaz(mk, false) : '00:00') : '');
  document.getElementById('mola-alt').textContent = S.molaBitis ? (mk > 0 ? 'sonra devam ediyoruz' : 'Yerlerinize lütfen') : '';
}
setInterval(tik, 250);

/* ---------------------------------------------------------- galeri
   Kaynak: ayarlardaki API (JSON dizi: ["url", ...] ya da [{url}, ...]) ya da yerel galeri/ klasörü
   (python http.server klasör listesinden resim linkleri okunur). */
let fotolar = [], gorulmedi = [], gIndeks = 0, gKaynak = null, gZaman, gCek, gKat = 10;
const fotoBilgi = new Map(); // url -> { kim, yazi, tur }
const RESIM = /\.(jpe?g|png|webp|avif|gif)$/i;
async function galeriCek() {
  try {
    const r = await fetch(gKaynak, { cache: 'no-store' });
    const tip = r.headers.get('content-type') || '';
    let liste = [];
    if (tip.includes('json')) liste = (await r.json()).map((x) => {
      const url = new URL(typeof x === 'string' ? x : x.url, r.url).href;
      if (typeof x === 'object') fotoBilgi.set(url, { kim: x.kim || '', yazi: x.yazi || '', tur: x.tur || 'foto' });
      return url;
    });
    else {
      const d = new DOMParser().parseFromString(await r.text(), 'text/html');
      liste = [...d.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')).filter((h) => RESIM.test(decodeURIComponent(h))).map((h) => new URL(h, r.url).href);
    }
    const yeni = liste.filter((u) => !fotolar.includes(u));
    fotolar = liste; gorulmedi = gorulmedi.filter((u) => liste.includes(u)).concat(yeni);
    // panelden kaldırılan fotoğraf duvardaysa hemen gider; ortadaki kaldırıldıysa sıradakine geçilir
    let ortaGitti = false;
    document.querySelectorAll('#g-duvar .pola:not(.gidiyor)').forEach((p) => {
      if (liste.includes(p.dataset.url)) return;
      if (p.classList.contains('orta')) ortaGitti = true;
      polaKaldir(p);
    });
    if (ortaGitti) { if (liste.length) galeriSonraki(); else document.getElementById('g-arka').style.backgroundImage = ''; }
    document.getElementById('g-sayi').textContent = `${fotolar.length} fotoğraf`;
    document.getElementById('g-bos').hidden = fotolar.length > 0;
    if (!document.querySelector('#g-duvar .pola.orta') && fotolar.length) galeriSonraki();
  } catch { /* ağ yoksa son liste ile devam */ }
}
function galeriKaynakDegisti() {
  const k = S.galeri.api || 'galeri/';
  if (k === gKaynak) return;
  gKaynak = k; fotolar = []; gorulmedi = [];
  clearInterval(gCek); galeriCek(); gCek = setInterval(galeriCek, 8000);
}

/* duvardaki yerler (1920×1080 tuvalde yüzde): ortadaki büyük fotoğrafın iki yanında 3 sütun × 2 sıra */
const YERLER = [6, 17.5, 29, 71, 82.5, 94].flatMap((x) => [[x, 37], [x, 71]]);
const rastgele = (a, b) => a + Math.random() * (b - a);
function polaYerlestir(p, x, y, r, s) {
  p.style.setProperty('--x', x + '%'); p.style.setProperty('--y', y + '%');
  p.style.setProperty('--r', r + 'deg'); p.style.setProperty('--s', s);
}
function polaKaldir(p) {
  p.classList.add('gidiyor'); p.classList.remove('orta');
  p.style.setProperty('--y', `calc(${p.style.getPropertyValue('--y')} + 40px)`);
  setTimeout(() => p.remove(), 900);
}
/* ortadaki fotoğraf duvara iner: boş yer yoksa en eski fotoğrafın yeri alınır */
function duvaraIndir(p) {
  const duvardakiler = [...document.querySelectorAll('#g-duvar .pola:not(.orta):not(.gidiyor)')];
  const dolu = new Set(duvardakiler.map((o) => +o.dataset.yer));
  // boş yerlerden rastgele biri: duvar iki yandan dengeli dolar
  const bos = YERLER.map((_, i) => i).filter((i) => !dolu.has(i));
  let yer = bos.length ? bos[Math.floor(Math.random() * bos.length)] : -1;
  if (yer < 0) { const eski = duvardakiler[0]; yer = +eski.dataset.yer; polaKaldir(eski); }
  const [x, y] = YERLER[yer];
  p.dataset.yer = yer; p.classList.remove('orta'); p.style.zIndex = ++gKat;
  p.querySelector('video')?.pause(); // duvarda video durur, son karesi kalır
  polaYerlestir(p, x + rastgele(-1.2, 1.2), y + rastgele(-2, 2), rastgele(-9, 9), 0.62);
}
function galeriSonraki() {
  clearTimeout(gZaman);
  if (!fotolar.length) return;
  // önce yeni gelenler, sonra sırayla tümü
  const url = gorulmedi.length ? gorulmedi.shift() : fotolar[gIndeks++ % fotolar.length];
  const orta = document.querySelector('#g-duvar .pola.orta');
  if (orta?.dataset.url === url) { gZaman = setTimeout(galeriSonraki, 7000); return; }
  const b = fotoBilgi.get(url) || {}, video = b.tur === 'video';
  // video sessiz oynar (salonda müzik çalıyor); ortada sonuna kadar kalır (en fazla 20 sn)
  const medya = video ? Object.assign(document.createElement('video'), { muted: true, playsInline: true, preload: 'auto' }) : new Image();
  const hazir = () => {
    medya.onloadeddata = medya.onload = medya.onerror = null;
    const duvar = document.getElementById('g-duvar');
    duvar.querySelectorAll('.pola:not(.gidiyor)').forEach((o) => { if (o.dataset.url === url && !o.classList.contains('orta')) polaKaldir(o); });
    const simdiki = duvar.querySelector('.pola.orta');
    if (simdiki) duvaraIndir(simdiki);
    const p = document.createElement('figure');
    p.className = 'pola orta'; p.dataset.url = url; p.style.zIndex = 500;
    p.innerHTML = '<div class="pf"></div><figcaption><span class="py"></span><span class="pk"></span></figcaption>';
    p.querySelector('.pf').append(medya);
    p.querySelector('.py').textContent = b.yazi ? `“${b.yazi}”` : '';
    p.querySelector('.pk').textContent = b.kim ? `— ${b.kim}` : '';
    // yukarıdan hafif büyük ve eğik düşer, ortada durur
    const r = rastgele(-2.5, 2.5);
    polaYerlestir(p, 50, 46, r * 3, 2.05);
    duvar.append(p);
    requestAnimationFrame(() => requestAnimationFrame(() => { p.classList.add('gor'); polaYerlestir(p, 50, 53, r, 1.78); }));
    if (video) {
      medya.play().catch(() => {});
      gZaman = setTimeout(galeriSonraki, Math.max(7000, Math.min(20, medya.duration || 7) * 1000 + 800));
    } else {
      document.getElementById('g-arka').style.backgroundImage = `url("${url}")`;
      gZaman = setTimeout(galeriSonraki, 7000);
    }
  };
  if (video) medya.onloadeddata = hazir; else medya.onload = hazir;
  medya.onerror = () => { medya.onloadeddata = medya.onload = medya.onerror = null; gZaman = setTimeout(galeriSonraki, 500); };
  medya.src = url;
}

/* ---------------------------------------------------------- müzik (YouTube IFrame API)
   Paneldeki aktif listenin calanId'si çalınır. Şarkı bitince sıradakine geçilir (calanId ilerler);
   liste bitince başa dönülür, listede "karıştır" açıksa önce karıştırılır.
   Panel calanId'yi ya da aktif listeyi değiştirirse ses yumuşakça kısılıp yeni şarkı açılır. */
let oyn = null, hazir = false, calan = null, sonDurum = -1, hedefSes = 0, solma;
const perde = document.getElementById('perde');

// Panelin içindeki önizleme müzik çalmaz, yoksa iki çalar aynı anda konuşur
const ONIZLEME = new URLSearchParams(location.search).has('onizleme');
if (ONIZLEME) document.body.classList.add('onizleme');
else {
  const yt = document.createElement('script');
  yt.src = 'https://www.youtube.com/iframe_api';
  document.head.append(yt);
}
window.onYouTubeIframeAPIReady = () => {
  oyn = new YT.Player('yt', {
    width: 600, height: 330,
    playerVars: { autoplay: 1, controls: 0, rel: 0, playsinline: 1, iv_load_policy: 3, origin: location.origin },
    events: {
      onReady: () => { hazir = true; oyn.setVolume(0); muzikUygula(true); },
      onStateChange: durumDegisti,
      onError: (e) => { durumYayinla(`çalınamadı (kod ${e.data}), atlanıyor`); setTimeout(sonraki, 800); },
      onAutoplayBlocked: () => { perde.hidden = false; },
    },
  });
};
perde.addEventListener('click', () => { perde.hidden = true; oyn?.playVideo(); tMedya.querySelector('video')?.play().catch(() => {}); });

const sessizMi = () => !!S.panik || !!S.sesKes || !S.muzik.calsin || !!S.ekran?.[S.sahne]?.muzikKis || medyaAcik(); // takımın videosu/sitesi açıkken müzik üstüne binmez

/* adim: 80 ms'de bir değişen ses birimi (4 ≈ 70'ten 0'a 1,4 sn) */
function sesSol(hedef, sonra, adim = 4) {
  clearInterval(solma); hedefSes = hedef;
  solma = setInterval(() => {
    const v = oyn.getVolume();
    const y = v < hedef ? Math.min(hedef, v + adim) : Math.max(hedef, v - adim);
    oyn.setVolume(y);
    if (y === hedef) { clearInterval(solma); sonra?.(); }
  }, 80);
}

/* panelin istediği şarkı: aktif listenin calanId'si (boşsa ilk şarkı) */
let sonHedef = '', yukleniyor = false, panikteydi = false;
function muzikUygula(sahneDegisti) {
  if (!hazir) return;
  // panik: ses yumuşatmadan anında kesilir; panik kalkınca aşağıdaki akış müziği sessizden açar
  if (S.panik || S.sesKes) { clearInterval(solma); hedefSes = 0; oyn.setVolume(0); oyn.pauseVideo(); panikteydi = true; return; }
  // panik bitti: yarıda kalan geçiş/kısma bayrakları sıfırlanır (yoksa ses 0'da takılı kalıyordu), şarkı sessizden açılır
  if (panikteydi) {
    panikteydi = false; kisiliyor = false;
    if (calan && !sessizMi()) {
      if (yukleniyor) { yukleniyor = false; sonVid = null; oyn.loadVideoById(calan.vid); } else oyn.playVideo();
      oyn.setVolume(0); sesSol(S.muzik.ses, null, 2);
    }
  }
  const L = aktifListe(S);
  // calanId boşsa ilk şarkı hedeftir (boş listeye şarkı eklenince de başlasın)
  const hedefAnahtar = L ? `${L.id}/${L.calanId || L.sarkilar[0]?.id || ''}` : '';
  // yalnız hedef değiştiğinde yükle: çalan şarkı listede taşınsa ya da silinse de kesilmez
  if (hedefAnahtar !== sonHedef) {
    sonHedef = hedefAnahtar;
    const x = L && (L.sarkilar.find((z) => z.id === L.calanId) || L.sarkilar[0]);
    if (!x) { if (calan) { calan = null; sesSol(0, () => oyn.stopVideo(), 6); durumYayinla(); } }
    else {
      if (L.calanId !== x.id) konumYaz(L.id, x.id); // calanId boştu: ilk şarkıyı işaretle
      if (!calan || calan.listeId !== L.id || calan.id !== x.id) yukle(L.id, x);
    }
  }
  if (sessizMi()) { if (oyn.getPlayerState() === 1) sesSol(0, () => oyn.pauseVideo()); }
  else {
    if (calan && !yukleniyor && ![1, 3].includes(oyn.getPlayerState())) oyn.playVideo();
    if (!kisiliyor && (sahneDegisti || hedefSes !== S.muzik.ses)) sesSol(S.muzik.ses);
  }
  setTimeout(() => { if (!sessizMi() && calan && ![1, 3].includes(oyn.getPlayerState())) perde.hidden = false; }, 4000);
}

function yukle(listeId, x) {
  calan = { listeId, ...x };
  const ac = () => { yukleniyor = false; kisiliyor = false; sonVid = null; oyn.loadVideoById(x.vid); };
  // çalan bir şarkı varsa önce sesi yumuşakça kıs
  if (oyn.getPlayerState() === 1 && !sessizMi() && oyn.getVolume() > 0) { yukleniyor = true; kisiliyor = true; sesSol(0, ac, 5); }
  else ac();
  durumYayinla();
}

function konumYaz(listeId, id) {
  const s = oku(), L = s.muzik.listeler.find((l) => l.id === listeId);
  if (!L) return;
  L.calanId = id; s.muzik.zaman = Date.now();
  yaz(s); S.muzik = s.muzik;
}

/* sıradaki şarkı; liste bittiyse başa dön (karıştır açıksa önce karıştır) */
function sonraki() {
  const s = oku(), L = aktifListe(s);
  if (!L || !L.sarkilar.length) return;
  let i = L.sarkilar.findIndex((z) => z.id === L.calanId) + 1;
  if (i >= L.sarkilar.length) { if (L.karisik) karistir(L.sarkilar); i = 0; }
  L.calanId = L.sarkilar[i].id; s.muzik.zaman = Date.now();
  if (calan?.id === L.calanId) { calan = null; sonHedef = ''; } // tek şarkılık liste: aynı şarkı yeniden
  yaz(s); S = s;
  uygula();
}

function gec() {
  if (!hazir) return;
  // çalarken geçilirse önce ses yumuşakça kısılır, sonra sıradakine geçilir
  if (oyn.getPlayerState() === 1 && !sessizMi() && !kisiliyor) { kisiliyor = true; sesSol(0, sonraki, 6); }
  else sonraki();
}

/* Şarkı geçişi: bitişe GECIS_SN kala ses yavaşça kısılır, yeni şarkı sessiz başlayıp açılır.
   Tek çalar olduğu için iki şarkı üst üste binmez; arada kısa bir sessizlik olur. */
const GECIS_SN = 6;
let kisiliyor = false, sonVid = null;
setInterval(() => {
  if (!hazir || kisiliyor || sessizMi() || oyn.getPlayerState() !== 1) return;
  const sure = oyn.getDuration(), t = oyn.getCurrentTime();
  if (sure > 30 && sure - t < GECIS_SN) { kisiliyor = true; sesSol(0, null, Math.max(1, Math.round(S.muzik.ses / (GECIS_SN * 12.5)))); }
}, 400);

function durumDegisti(e) {
  const d = e.data;
  if (d === 0) { sonVid = null; sonraki(); } // bitti
  if (d === 1) {
    perde.hidden = true;
    // yeni şarkı başladı: sessizden açılarak gelsin
    const vid = oyn.getVideoData?.().video_id;
    if (vid && vid !== sonVid) {
      sonVid = vid; kisiliyor = false;
      if (!sessizMi()) { oyn.setVolume(0); sesSol(S.muzik.ses, null, 2); }
    }
    if (sessizMi()) sesSol(0, () => oyn.pauseVideo());
  }
  sonDurum = d;
  durumYayinla();
}

/* Salon ekranında şarkı kapağı: şimdilik kapalı (kapaklar yönetim panelinde görünür).
   Açmak için true yap; kod duruyor. */
const EKRANDA_KAPAK = false;
document.body.classList.toggle('kapakli', EKRANDA_KAPAK);

function kapakGoster(kapak) {
  document.querySelectorAll('.calan-kapak').forEach((el) => { el.hidden = !kapak; if (kapak && el.getAttribute('src') !== kapak) el.src = kapak; });
}

function durumYayinla(hata) {
  const v = oyn?.getVideoData?.() || {};
  const baslik = calan ? calan.baslik || v.title || 'Şarkı' : '';
  const kapak = baslik ? calan?.kapak || (v.video_id ? kapakAdresi({ vid: v.video_id }) : '') : '';
  document.querySelectorAll('.calan-ad').forEach((el) => { el.textContent = baslik || '—'; });
  kapakGoster(kapak);
  document.body.classList.toggle('durgun', sonDurum !== 1);
  document.body.classList.toggle('sessiz', !baslik);
  gonder({ tur: 'calar', oran: tuval.offsetWidth / tuval.offsetHeight, baslik, kapak, vid: v.video_id, liste: calan?.listeId || '', id: calan?.id || '', durum: sonDurum, kim: calan?.kim || '', hata: hata || '' });
}

/* ---------------------------------------------------------- dinleme */
dinle((m) => {
  if (m.tur === 'durum') { S = TASLAK_MOD ? durumOku() : m.durum; uygula(); }
  else if (m.tur === 'taslak' && TASLAK_MOD) { S = canliMuzik(m.durum); uygula(); }
  else if (m.tur === 'muzik' && m.eylem === 'gec') gec();
  else if (m.tur === 'takim-video' && !ONIZLEME) {
    const v = tMedya.querySelector('video');
    if (m.eylem === 'bas') { if (v) v.currentTime = 0; ytKomut('seekTo', [0, true]); }
    if (m.eylem === 'dur') { v?.pause(); ytKomut('pauseVideo'); } else { v?.play().catch(() => {}); ytKomut('playVideo'); }
  }
  else if (m.tur === 'calar-sor' && !ONIZLEME) durumYayinla();
  else if (m.tur === 'calar' && ONIZLEME) {
    document.querySelectorAll('.calan-ad').forEach((el) => { el.textContent = m.baslik || '—'; });
    kapakGoster(m.kapak);
    document.body.classList.toggle('durgun', m.durum !== 1);
    document.body.classList.toggle('sessiz', !m.baslik);
  }
});
addEventListener('storage', (e) => { if (e.key === 'gak-sahne-v1' || (TASLAK_MOD && e.key === 'gak-sahne-taslak')) { S = durumOku(); uygula(); } });

uygula(); tik();
