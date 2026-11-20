/* GakCoding sahne sunucusu (Cloudflare Worker + D1 + R2).
   Katılımcı QR'ı okutur → public/index.html açılır → şarkı ister, fotoğraf ya da kısa video gönderir.
   Fotoğraflar D1'de (BLOB), videolar R2'de (MEDYA) durur.
   Sahne kontrol paneli (localhost) /api/yonetim/* ile onaylar; ekran /api/galeri'yi okur. */

const DK = 60_000;
const SINIR = {
  // salondaki herkes aynı Wi-Fi'dan (tek IP) gelebilir: asıl sınır cihaz başına, IP sınırı geniş
  sarki: { cihaz: 3, ip: 60, sure: 10 * DK },
  foto: { cihaz: 4, ip: 150, sure: 10 * DK },
  video: { cihaz: 2, ip: 40, sure: 10 * DK },
  cerez: { cihaz: 1e9, ip: 300, sure: 10 * DK }, // IP başına yeni cihaz kimliği
  giris: { cihaz: 1e9, ip: 10, sure: 10 * DK },  // yanlış yönetici şifresi denemesi
  juri: { cihaz: 1e9, ip: 20, sure: 10 * DK },   // yanlış jüri linki denemesi
};
const FOTO_EN_BUYUK = 1_900_000; // D1 satır sınırı 2 MB
const VIDEO_EN_BUYUK = 40 * 1024 * 1024;
const BEKLEYEN_EN_COK = 300;
const CIHAZ_BEKLEYEN_EN_COK = 3; // bir telefondan onay bekleyen en fazla gönderi
const TEKRAR_SURE = 45 * DK;
// yönetim uçlarını yalnız sahne kontrol paneli (yerel) çağırabilir
const PANEL_KOKENLERI = ['http://localhost:8765', 'http://127.0.0.1:8765'];

export default {
  async fetch(istek, env, ctx) {
    const url = new URL(istek.url);
    const yol = url.pathname;
    try {
      if (istek.method === 'OPTIONS') return cors(istek, new Response(null, { status: 204 }));
      if (yol.startsWith('/api/yonetim/')) return cors(istek, await yonetim(istek, env, yol.slice(13)));
      if (yol === '/api/ayar' && istek.method === 'GET') return await ayarlarHerkes(istek, env);
      if (yol === '/api/galeri' && istek.method === 'GET') return acik(await galeri(env));
      // gönderimler yalnız bu sitenin sayfasından (başka sitenin formu kullanıcının çerezini kullanamaz)
      if (istek.method === 'POST' && !ayniKoken(istek, url)) return json({ hata: 'Geçersiz istek.' }, 403);
      if (yol === '/api/juri/oku' && istek.method === 'POST') return await juriOku(istek, env);
      if (yol === '/api/juri/oy' && istek.method === 'POST') return await juriOy(istek, env);
      if (yol === '/api/sarki' && istek.method === 'POST') return await sarkiIste(istek, env);
      if (yol === '/api/foto' && istek.method === 'POST') return await fotoGonder(istek, env);
      if (yol === '/api/video' && istek.method === 'POST') return await videoGonder(istek, env);
      if (yol.startsWith('/f/') && istek.method === 'GET') return await fotoVer(istek, env, ctx, yol.slice(3));
      if (yol.startsWith('/api/')) return json({ hata: 'Bulunamadı' }, 404);
      return env.ASSETS.fetch(istek);
    } catch (e) {
      console.error(e);
      return json({ hata: 'Sunucuda bir sorun oldu, birazdan tekrar dene.' }, 500);
    }
  },
};

/* ------------------------------------------------------------------ yardımcılar */

function json(veri, durum = 200, baslik = {}) {
  return new Response(JSON.stringify(veri), {
    status: durum,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...baslik },
  });
}
// ekran ve panel localhost'tan okur
const acik = (veri) => json(veri, 200, { 'access-control-allow-origin': '*' });

function cors(istek, yanit) {
  const r = new Response(yanit.body, yanit);
  const koken = istek.headers.get('origin');
  if (koken && PANEL_KOKENLERI.includes(koken)) r.headers.set('access-control-allow-origin', koken);
  r.headers.set('access-control-allow-headers', 'authorization, content-type');
  r.headers.set('access-control-allow-methods', 'GET, POST, OPTIONS');
  r.headers.set('access-control-max-age', '600');
  r.headers.set('vary', 'origin');
  return r;
}

const ipAl = (istek) => istek.headers.get('cf-connecting-ip') || 'yerel';
const temiz = (s, n) => String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);

function ayniKoken(istek, url) {
  const koken = istek.headers.get('origin');
  return !koken || koken === url.origin;
}

/* telefon sayfasının güvenlik başlıkları (CSP vb.) public/_headers dosyasında: statik dosyalar worker'a uğramaz */

/* Cihaz kimliği: sunucunun imzaladığı çerez (HttpOnly). Telefon kendi kimliğini uyduramaz;
   çerezi silip yenisini almak IP başına sınırlı. Hız sınırı ve engelleme bununla tutulur. */
const CEREZ = 'gak_c';
const b64 = (bayt) => btoa(String.fromCharCode(...new Uint8Array(bayt))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
let imzaAnahtari;
async function imzala(env, id) {
  imzaAnahtari ??= await crypto.subtle.importKey('raw', new TextEncoder().encode(`gak-cihaz:${env.CIHAZ_ANAHTAR || env.ADMIN_SIFRE || 'yerel'}`), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64(await crypto.subtle.sign('HMAC', imzaAnahtari, new TextEncoder().encode(id))).slice(0, 32);
}
async function cihazAl(istek, env) {
  const m = (istek.headers.get('cookie') || '').match(/(?:^|;\s*)gak_c=([0-9a-f]{24})\.([\w-]{32})/);
  if (!m) return null;
  const beklenen = await imzala(env, m[1]);
  let fark = 0;
  for (let i = 0; i < 32; i++) fark |= beklenen.charCodeAt(i) ^ m[2].charCodeAt(i);
  return fark === 0 ? m[1] : null;
}
async function yeniCihaz(env, https) {
  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 24);
  return `${CEREZ}=${id}.${await imzala(env, id)}; Path=/; Max-Age=${3 * 24 * 3600}; HttpOnly; SameSite=Strict${https ? '; Secure' : ''}`;
}

/* gönderim öncesi ortak kontroller: cihaz kimliği, engel, doğrulama, hız. Sorun varsa yanıt döner. */
async function gonderimKontrol(istek, env, tur, ts) {
  const ip = ipAl(istek), cihaz = await cihazAl(istek, env);
  if (!cihaz) return { yanit: json({ hata: 'Sayfayı yenileyip tekrar dene.' }, 403) };
  const engel = await env.DB.prepare('SELECT 1 FROM yasak WHERE anahtar IN (?, ?)').bind(`c:${cihaz}`, `ip:${ip}`).first();
  if (engel) return { yanit: json({ hata: 'Bu cihazdan gönderim kapatıldı.' }, 403) };
  if (!(await turnstileGecti(env, ts, ip))) return { yanit: json({ hata: 'Doğrulama geçmedi, sayfayı yenileyip tekrar dene.' }, 403) };
  if (await sinirda(env, tur, cihaz, ip)) return { yanit: json({ hata: 'Çok hızlı gidiyorsun. Birkaç dakika sonra tekrar dene.' }, 429) };
  return { ip, cihaz };
}

async function ayarOku(env, ad, varsayilan) {
  const r = await env.DB.prepare('SELECT deger FROM ayar WHERE ad = ?').bind(ad).first();
  if (!r) return varsayilan;
  try { return JSON.parse(r.deger); } catch { return varsayilan; }
}
const ayarYaz = (env, ad, deger) =>
  env.DB.prepare('INSERT INTO ayar (ad, deger) VALUES (?, ?) ON CONFLICT(ad) DO UPDATE SET deger = excluded.deger').bind(ad, JSON.stringify(deger)).run();

const AYAR_VARSAYILAN = { sarkiAcik: true, fotoAcik: true, videoAcik: true, otoSarki: false, otoFoto: false };
const ayarlar = async (env) => ({ ...AYAR_VARSAYILAN, ...(await ayarOku(env, 'ayar', {})) });

async function ayarlarHerkes(istek, env) {
  const a = await ayarlar(env);
  const yanit = acik({
    sarkiAcik: a.sarkiAcik, fotoAcik: a.fotoAcik, videoAcik: a.videoAcik && !!env.MEDYA,
    turnstile: env.TURNSTILE_SITE || '',
    simdi: await ayarOku(env, 'simdi', { calan: '', sira: [] }),
  });
  // telefonun henüz geçerli bir cihaz çerezi yoksa ver (IP başına sınırlı)
  if (!(await cihazAl(istek, env))) {
    const ip = ipAl(istek);
    if (!(await sinirda(env, 'cerez', '-', ip))) {
      await hizYaz(env, 'cerez', '-', ip);
      yanit.headers.append('set-cookie', await yeniCihaz(env, new URL(istek.url).protocol === 'https:'));
    }
  }
  return yanit;
}

/* hız sınırı: son pencere içindeki gönderimleri say; geçerse true */
async function sinirda(env, tur, cihaz, ip) {
  const s = SINIR[tur], once = Date.now() - s.sure;
  const [c, i] = await env.DB.batch([
    env.DB.prepare('SELECT COUNT(*) AS n FROM hiz WHERE ip = ? AND tur = ? AND zaman > ?').bind(`c:${cihaz}`, tur, once),
    env.DB.prepare('SELECT COUNT(*) AS n FROM hiz WHERE ip = ? AND tur = ? AND zaman > ?').bind(`ip:${ip}`, tur, once),
  ]);
  return c.results[0].n >= s.cihaz || i.results[0].n >= s.ip;
}
function hizYaz(env, tur, cihaz, ip) {
  const t = Date.now();
  return env.DB.batch([
    env.DB.prepare('INSERT INTO hiz (ip, tur, zaman) VALUES (?, ?, ?), (?, ?, ?)').bind(`c:${cihaz}`, tur, t, `ip:${ip}`, tur, t),
    env.DB.prepare('DELETE FROM hiz WHERE zaman < ?').bind(t - 60 * DK),
  ]);
}

async function turnstileGecti(env, token, ip) {
  if (!env.TURNSTILE_SECRET) return true;
  if (!token) return false;
  const f = new FormData();
  f.append('secret', env.TURNSTILE_SECRET); f.append('response', token); f.append('remoteip', ip);
  const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: f });
  return (await r.json()).success === true;
}

/* youtube.com/watch?v=, youtu.be/, music.youtube.com, shorts ya da çıplak kimlik (sahne-ekranlari/ortak.js ile aynı) */
function videoKimligi(s) {
  s = String(s || '').trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  const m0 = s.match(/https?:\/\/\S+/);
  if (!m0) return null;
  try {
    const u = new URL(m0[0]);
    if (!/(^|\.)(youtube\.com|youtu\.be)$/.test(u.hostname)) return null;
    if (u.hostname.endsWith('youtu.be')) return /^\/[\w-]{11}/.test(u.pathname) ? u.pathname.slice(1, 12) : null;
    const v = u.searchParams.get('v');
    if (v && /^[\w-]{11}/.test(v)) return v.slice(0, 11);
    const m = u.pathname.match(/\/(shorts|embed|live)\/([\w-]{11})/);
    if (m) return m[2];
  } catch {}
  return null;
}

/* Eski veritabanına sonradan eklenen sütun ve tablolar (schema.sql CREATE IF NOT EXISTS mevcut tabloyu değiştirmez) */
let semaHazir = false;
async function kapakSutunu(env) {
  if (semaHazir) return;
  for (const q of [
    'ALTER TABLE sarki ADD COLUMN kapak TEXT',
    "ALTER TABLE sarki ADD COLUMN cihaz TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE foto ADD COLUMN yazi TEXT NOT NULL DEFAULT ''", // polaroidin altındaki not
    "ALTER TABLE foto ADD COLUMN cihaz TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE foto ADD COLUMN tur TEXT NOT NULL DEFAULT 'foto'", // foto | video (video R2'de, anahtar adıyla)
    'ALTER TABLE foto ADD COLUMN izin INTEGER NOT NULL DEFAULT 0', // gönderenin paylaşım izni verdiği an (ms)
  ]) { try { await env.DB.prepare(q).run(); } catch { /* zaten var */ } }
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS yasak (anahtar TEXT PRIMARY KEY, zaman INTEGER NOT NULL)').run();
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS juri_uye (anahtar TEXT PRIMARY KEY, ad TEXT NOT NULL, zaman INTEGER NOT NULL)').run();
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS juri_oy (uye TEXT NOT NULL, takim TEXT NOT NULL, puan INTEGER NOT NULL, zaman INTEGER NOT NULL, PRIMARY KEY (uye, takim))').run();
  semaHazir = true;
}

const ytKapak = (vid) => `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`;
/* yalnız iTunes görsel sunucusundan gelen kapak kabul edilir; büyük boy istenir */
function itunesKapak(u) {
  try {
    const x = new URL(String(u || ''));
    if (x.protocol !== 'https:' || !/(^|\.)mzstatic\.com$/.test(x.hostname)) return null;
    return x.href.replace(/\/\d+x\d+bb\.(jpg|png|webp)$/, '/600x600bb.jpg');
  } catch { return null; }
}

/* Şarkı adından YouTube videosu bul: arama sayfasındaki ilk sonuçlardan gömülebilen ilki.
   API anahtarı gerekmez; YouTube sayfayı değiştirirse boş döner, istek panelde elle eşleştirilir. */
async function youtubeAra(sorgu) {
  try {
    const r = await fetch(`https://www.youtube.com/results?hl=tr&gl=TR&search_query=${encodeURIComponent(sorgu)}`, {
      headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36', 'accept-language': 'tr-TR,tr;q=0.9', cookie: 'SOCS=CAI; CONSENT=YES+1' },
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) return null;
    const html = await r.text();
    const adaylar = [...new Set([...html.matchAll(/"videoRenderer":\{"videoId":"([\w-]{11})"/g)].map((m) => m[1]))].slice(0, 4);
    for (const vid of adaylar) {
      const b = await videoBilgisi(vid);
      if (!b.hata && b.baslik) return { vid, ...b };
    }
  } catch { /* zaman aşımı ya da ağ */ }
  return null;
}

/* oEmbed: başlığı getirir, gömülemeyen videoyu (401) ve olmayanı (404) ayıklar */
async function videoBilgisi(vid) {
  try {
    const r = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${vid}`)}`, { signal: AbortSignal.timeout(4000) });
    if (r.status === 401 || r.status === 403) return { hata: 'Bu video başka sitelerde çalınamıyor (sahibi kapatmış). Aynı şarkının başka bir yüklemesini dene.' };
    if (r.status === 404 || r.status === 400) return { hata: 'Bu video bulunamadı. Linki kontrol et.' };
    if (!r.ok) return { baslik: '' };
    const d = await r.json();
    return { baslik: temiz(d.title, 120), kanal: temiz(d.author_name, 60) };
  } catch { return { baslik: '' }; } // YouTube'a ulaşılamazsa yine de al, panelde görünür
}

/* ------------------------------------------------------------------ katılımcı */

async function sarkiIste(istek, env) {
  const a = await ayarlar(env);
  if (!a.sarkiAcik) return json({ hata: 'Şarkı istekleri şu an kapalı.' }, 403);
  let g; try { g = await istek.json(); } catch { return json({ hata: 'Geçersiz istek.' }, 400); }
  const metin = temiz(g.metin, 200), kim = temiz(g.kim, 40);
  if (metin.length < 2) return json({ hata: 'Şarkı adını ya da YouTube linkini yaz.' }, 400);
  await kapakSutunu(env);
  const k = await gonderimKontrol(istek, env, 'sarki', g.ts);
  if (k.yanit) return k.yanit;
  const { ip, cihaz } = k;

  const bekleyen = await env.DB.prepare("SELECT COUNT(*) AS n FROM sarki WHERE durum IN ('bekliyor','oto')").first();
  if (bekleyen.n >= BEKLEYEN_EN_COK) return json({ hata: 'Sıra çok doldu, biraz sonra tekrar dene.' }, 429);

  // Telefonda listeden seçilen şarkı (iTunes): ad ve kapak oradan, video YouTube aramasından
  const secim = g.secim && typeof g.secim === 'object' ? { ad: temiz(g.secim.ad, 100), sanatci: temiz(g.secim.sanatci, 80), kapak: itunesKapak(g.secim.kapak) } : null;
  let vid = videoKimligi(metin), baslik = metin, kapak = null;
  if (vid) {
    const b = await videoBilgisi(vid);
    if (b.hata) return json({ hata: b.hata }, 400);
    baslik = b.baslik || 'YouTube isteği';
    kapak = ytKapak(vid);
  } else if (/https?:\/\//i.test(metin)) {
    return json({ hata: 'Yalnız YouTube linki kabul ediliyor. Ya da şarkının adını yaz.' }, 400);
  } else {
    if (secim?.ad) { baslik = secim.sanatci ? `${secim.sanatci} – ${secim.ad}` : secim.ad; kapak = secim.kapak; }
    const bulunan = await youtubeAra(secim?.ad ? `${secim.sanatci} ${secim.ad}` : metin);
    if (bulunan) {
      vid = bulunan.vid;
      if (!secim?.ad) baslik = bulunan.baslik;
      kapak = kapak || ytKapak(vid);
    }
  }
  if (vid) {
    const ayni = await env.DB.prepare("SELECT 1 FROM sarki WHERE vid = ? AND durum != 'ret' AND zaman > ?").bind(vid, Date.now() - TEKRAR_SURE).first();
    if (ayni) return json({ hata: 'Bu şarkı zaten sırada. Başka bir şey iste.' }, 409);
  }
  // otomatik onay yalnız videosu bulunan isteklerde: bulunamayana panelde link eklenir
  const durum = vid && a.otoSarki ? 'oto' : 'bekliyor';
  await env.DB.prepare('INSERT INTO sarki (vid, baslik, kapak, kim, durum, ip, cihaz, zaman) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(vid, baslik, kapak, kim, durum, ip, cihaz, Date.now()).run();
  await hizYaz(env, 'sarki', cihaz, ip);
  return json({ tamam: true, baslik, kapak, mesaj: durum === 'oto' ? 'Sıraya eklendi!' : 'İsteğin alındı, DJ masası onaylayınca sıraya girecek.' });
}

function resimTipi(b) {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp';
  return null;
}

/* mp4/mov (ftyp kutusu) ya da webm (EBML başlığı) */
function videoTipi(b) {
  if (b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) return b[8] === 0x71 && b[9] === 0x74 ? 'video/quicktime' : 'video/mp4';
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return 'video/webm';
  return null;
}

/* fotoğraf ve video ortak: dosyayı al, doğrula, kaydet */
async function medyaGonder(istek, env, tur) {
  const a = await ayarlar(env);
  const video = tur === 'video';
  if (!a.fotoAcik || (video && (!a.videoAcik || !env.MEDYA))) return json({ hata: video ? 'Video gönderimi şu an kapalı.' : 'Fotoğraf gönderimi şu an kapalı.' }, 403);
  const enBuyuk = video ? VIDEO_EN_BUYUK : FOTO_EN_BUYUK;
  const uzunluk = +istek.headers.get('content-length') || 0;
  if (!uzunluk || uzunluk > enBuyuk + 20_000) return json({ hata: video ? 'Video çok büyük (en fazla 40 MB, ~20 sn).' : 'Fotoğraf çok büyük.' }, 413);
  let f; try { f = await istek.formData(); } catch { return json({ hata: 'Geçersiz istek.' }, 400); }
  const dosya = f.get('dosya');
  if (!dosya || typeof dosya === 'string') return json({ hata: 'Dosya seçilmedi.' }, 400);
  if (dosya.size > enBuyuk) return json({ hata: video ? 'Video çok büyük (en fazla 40 MB, ~20 sn).' : 'Fotoğraf çok büyük.' }, 413);
  if (f.get('izin') !== '1') return json({ hata: 'Göndermek için paylaşım iznini işaretle.' }, 400);
  await kapakSutunu(env);
  const k = await gonderimKontrol(istek, env, tur, f.get('ts'));
  if (k.yanit) return k.yanit;
  const { ip, cihaz } = k;

  const bayt = new Uint8Array(await dosya.arrayBuffer());
  const tip = video ? videoTipi(bayt) : resimTipi(bayt);
  if (!tip) return json({ hata: video ? 'Bu bir video dosyası değil (MP4, MOV ya da WebM olmalı).' : 'Bu bir fotoğraf dosyası değil (JPEG, PNG ya da WebP olmalı).' }, 400);
  const [hepsi, benim] = await env.DB.batch([
    env.DB.prepare("SELECT COUNT(*) AS n FROM foto WHERE durum = 'bekliyor'"),
    env.DB.prepare("SELECT COUNT(*) AS n FROM foto WHERE durum = 'bekliyor' AND cihaz = ?").bind(cihaz),
  ]);
  if (hepsi.results[0].n >= BEKLEYEN_EN_COK) return json({ hata: 'Çok fazla gönderi bekliyor, biraz sonra tekrar dene.' }, 429);
  if (benim.results[0].n >= CIHAZ_BEKLEYEN_EN_COK) return json({ hata: 'Önceki gönderilerin onay bekliyor. Onaylanınca yenisini gönderebilirsin.' }, 429);

  const anahtar = crypto.randomUUID().replace(/-/g, '').slice(0, 20);
  const durum = a.otoFoto && !video ? 'onay' : 'bekliyor'; // video her zaman elle onaylanır
  if (video) await env.MEDYA.put(`video/${anahtar}`, bayt, { httpMetadata: { contentType: tip } });
  const simdi = Date.now();
  await env.DB.prepare('INSERT INTO foto (anahtar, tip, veri, boyut, kim, yazi, durum, ip, cihaz, tur, izin, zaman) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(anahtar, tip, video ? new Uint8Array(0) : bayt, bayt.length, temiz(f.get('kim'), 40), temiz(f.get('yazi'), 80), durum, ip, cihaz, tur, simdi, simdi).run();
  await hizYaz(env, tur, cihaz, ip);
  return json({ tamam: true, mesaj: durum === 'onay' ? 'Gönderildi! Birazdan ekranda.' : 'Gönderildi! Onaylanınca ekranda görünecek.' });
}
const fotoGonder = (istek, env) => medyaGonder(istek, env, 'foto');
const videoGonder = (istek, env) => medyaGonder(istek, env, 'video');

async function galeri(env) {
  await kapakSutunu(env);
  const { results } = await env.DB.prepare("SELECT anahtar, kim, yazi, tur FROM foto WHERE durum = 'onay' ORDER BY id").all();
  return results.map((r) => ({ url: `/f/${r.anahtar}`, kim: r.kim, yazi: r.yazi, tur: r.tur }));
}

async function fotoVer(istek, env, ctx, anahtar) {
  if (!/^[0-9a-f]{20}$/.test(anahtar)) return new Response('Bulunamadı', { status: 404 });
  const onbellek = caches.default;
  const hazir = await onbellek.match(istek);
  if (hazir) return hazir;
  await kapakSutunu(env);
  const r = await env.DB.prepare("SELECT tip, veri, tur FROM foto WHERE anahtar = ? AND durum = 'onay'").bind(anahtar).first();
  if (!r) return new Response('Bulunamadı', { status: 404, headers: { 'cache-control': 'no-store' } });
  if (r.tur === 'video') return await videoAkit(istek, env, anahtar, 'public, max-age=600');
  const yanit = new Response(new Uint8Array(r.veri), {
    headers: { 'content-type': r.tip, 'cache-control': 'public, max-age=600', 'access-control-allow-origin': '*', 'x-content-type-options': 'nosniff' },
  });
  ctx.waitUntil(onbellek.put(istek, yanit.clone()));
  return yanit;
}

/* R2'den video; tarayıcının parça (Range) isteklerini karşılar, video ileri sarılabilir */
async function videoAkit(istek, env, anahtar, onbellek) {
  if (!env.MEDYA) return new Response('Bulunamadı', { status: 404 });
  const yer = `video/${anahtar}`;
  const bas0 = await env.MEDYA.head(yer);
  if (!bas0) return new Response('Bulunamadı', { status: 404 });
  const boy = bas0.size;
  const h = new Headers({ 'content-type': bas0.httpMetadata?.contentType || 'video/mp4', 'accept-ranges': 'bytes', 'cache-control': onbellek, 'access-control-allow-origin': '*', 'x-content-type-options': 'nosniff' });
  // "bytes=a-b", "bytes=a-" ya da "bytes=-n"
  const m = (istek.headers.get('range') || '').match(/^bytes=(\d*)-(\d*)$/);
  if (m && (m[1] || m[2])) {
    let bas = m[1] ? +m[1] : Math.max(0, boy - +m[2]);
    let son = m[1] && m[2] ? Math.min(+m[2], boy - 1) : boy - 1;
    if (bas >= boy || bas > son) return new Response(null, { status: 416, headers: { 'content-range': `bytes */${boy}` } });
    const o = await env.MEDYA.get(yer, { range: { offset: bas, length: son - bas + 1 } });
    h.set('content-range', `bytes ${bas}-${son}/${boy}`); h.set('content-length', String(son - bas + 1));
    return new Response(o.body, { status: 206, headers: h });
  }
  const o = await env.MEDYA.get(yer);
  h.set('content-length', String(boy));
  return new Response(o.body, { headers: h });
}

/* ------------------------------------------------------------------ jüri
   Her üyenin gizli linki var (/juri#anahtar). Üye yalnız kendi puanını görür; panel yalnız ortalamayı görür,
   tek tek puan hiçbir yanıtta dönmez. */

const juriAyar = async (env) => ({ acik: false, takimlar: [], ...(await ayarOku(env, 'juri', {})) });

async function juriUye(istek, env) {
  await kapakSutunu(env);
  const g = await istek.json().catch(() => ({}));
  const ip = ipAl(istek);
  if (await sinirda(env, 'juri', '-', ip)) return { yanit: json({ hata: 'Çok fazla yanlış deneme. 10 dakika sonra tekrar dene.' }, 429) };
  const k = /^[0-9a-f]{32}$/.test(g.k || '') ? g.k : '';
  const uye = k && await env.DB.prepare('SELECT anahtar, ad FROM juri_uye WHERE anahtar = ?').bind(k).first();
  if (!uye) { await hizYaz(env, 'juri', '-', ip); return { yanit: json({ hata: 'Bu jüri linki geçersiz.' }, 403) }; }
  return { uye, g };
}

async function juriOku(istek, env) {
  const { yanit, uye } = await juriUye(istek, env);
  if (yanit) return yanit;
  const a = await juriAyar(env);
  const { results } = await env.DB.prepare('SELECT takim, puan FROM juri_oy WHERE uye = ?').bind(uye.anahtar).all();
  return json({ ad: uye.ad, acik: a.acik, takimlar: a.takimlar, oylarim: Object.fromEntries(results.map((r) => [r.takim, r.puan])) });
}

async function juriOy(istek, env) {
  const { yanit, uye, g } = await juriUye(istek, env);
  if (yanit) return yanit;
  const a = await juriAyar(env);
  if (!a.acik) return json({ hata: 'Oylama şu an kapalı.' }, 403);
  const puan = +g.puan;
  if (!Number.isInteger(puan) || puan < 1 || puan > 10) return json({ hata: 'Puan 1 ile 10 arasında olmalı.' }, 400);
  if (!a.takimlar.some((t) => t.id === g.takim)) return json({ hata: 'Takım bulunamadı.' }, 404);
  await env.DB.prepare('INSERT INTO juri_oy (uye, takim, puan, zaman) VALUES (?, ?, ?, ?) ON CONFLICT(uye, takim) DO UPDATE SET puan = excluded.puan, zaman = excluded.zaman')
    .bind(uye.anahtar, g.takim, puan, Date.now()).run();
  return json({ tamam: true });
}

async function juriOzet(env) {
  const a = await juriAyar(env);
  const [u, o] = await env.DB.batch([
    env.DB.prepare('SELECT anahtar, ad FROM juri_uye ORDER BY zaman'),
    env.DB.prepare('SELECT uye, takim, puan FROM juri_oy'),
  ]);
  // listeden çıkarılan takımın oyu sayılmaz
  const ids = new Set(a.takimlar.map((t) => t.id)), oylar = o.results.filter((r) => ids.has(r.takim));
  const sira = a.takimlar.map((t) => {
    const p = oylar.filter((r) => r.takim === t.id).map((r) => r.puan);
    return { id: t.id, ad: t.ad, oy: p.length, ort: p.length ? p.reduce((x, y) => x + y, 0) / p.length : 0 };
  }).sort((x, y) => y.ort - x.ort || y.oy - x.oy);
  return { ...a, uyeler: u.results.map((r) => ({ ...r, oy: oylar.filter((x) => x.uye === r.anahtar).length })), sira };
}

const siteTemiz = (s) => { const x = temiz(s, 300); return /^https?:\/\//i.test(x) ? x : ''; };

/* ------------------------------------------------------------------ yönetim (sahne kontrol paneli) */

function yetkili(istek, env) {
  const beklenen = env.ADMIN_SIFRE || '';
  const gelen = (istek.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!beklenen || gelen.length !== beklenen.length) return false;
  let fark = 0;
  for (let i = 0; i < gelen.length; i++) fark |= gelen.charCodeAt(i) ^ beklenen.charCodeAt(i);
  return fark === 0;
}

async function yonetim(istek, env, alt) {
  if (!env.ADMIN_SIFRE) return json({ hata: 'Sunucuda ADMIN_SIFRE ayarlı değil.' }, 503);
  const koken = istek.headers.get('origin');
  if (koken && !PANEL_KOKENLERI.includes(koken)) return json({ hata: 'Yalnız sahne kontrol panelinden.' }, 403);
  const ip = ipAl(istek);
  if (!yetkili(istek, env)) {
    // şifre tahmini: IP başına 10 dakikada 10 yanlış deneme
    if (await sinirda(env, 'giris', '-', ip)) return json({ hata: 'Çok fazla yanlış deneme. 10 dakika sonra tekrar dene.' }, 429);
    await hizYaz(env, 'giris', '-', ip);
    return json({ hata: 'Şifre yanlış.' }, 401);
  }
  const post = istek.method === 'POST';
  const govde = post ? await istek.json().catch(() => ({})) : {};
  let m;

  await kapakSutunu(env);
  if (alt === 'ozet' && !post) {
    const [s, f, o, sayi] = await env.DB.batch([
      env.DB.prepare("SELECT id, vid, baslik, kapak, kim, durum, zaman FROM sarki WHERE durum IN ('bekliyor','oto') ORDER BY id LIMIT 100"),
      env.DB.prepare("SELECT id, kim, yazi, tur, boyut, zaman FROM foto WHERE durum = 'bekliyor' ORDER BY id LIMIT 60"),
      env.DB.prepare("SELECT id, anahtar, kim, yazi, tur, zaman FROM foto WHERE durum = 'onay' ORDER BY id DESC LIMIT 24"),
      // panel 4 sn'de bir sorar: toplamlar MAX(id) ile (tek satır okur; D1 ücretsiz katmanı okunan satırı sayar)
      env.DB.prepare("SELECT COALESCE((SELECT MAX(id) FROM sarki), 0) AS sarki, (SELECT COUNT(*) FROM foto WHERE durum = 'onay') AS galeri, COALESCE((SELECT MAX(id) FROM foto), 0) AS foto"),
    ]);
    return json({ sarkilar: s.results, fotolar: f.results, galeri: o.results, sayi: sayi.results[0], ayar: await ayarlar(env) });
  }
  if ((m = alt.match(/^foto\/(\d+)$/)) && !post) {
    const r = await env.DB.prepare('SELECT anahtar, tip, veri, tur FROM foto WHERE id = ?').bind(+m[1]).first();
    if (!r) return json({ hata: 'Yok' }, 404);
    if (r.tur === 'video') return await videoAkit(istek, env, r.anahtar, 'private, max-age=3600');
    return new Response(new Uint8Array(r.veri), { headers: { 'content-type': r.tip, 'cache-control': 'private, max-age=3600' } });
  }
  if ((m = alt.match(/^sarki\/(\d+)$/)) && post) {
    const durum = govde.durum === 'onay' ? 'onay' : 'ret';
    if (govde.vid !== undefined) {
      const vid = videoKimligi(govde.vid);
      if (!vid) return json({ hata: 'YouTube linki tanınmadı.' }, 400);
      const b = await videoBilgisi(vid);
      if (b.hata) return json({ hata: b.hata }, 400);
      await env.DB.prepare('UPDATE sarki SET vid = ?, baslik = COALESCE(NULLIF(?, \'\'), baslik), kapak = COALESCE(kapak, ?), durum = ? WHERE id = ?').bind(vid, b.baslik || '', ytKapak(vid), durum, +m[1]).run();
    } else {
      await env.DB.prepare('UPDATE sarki SET durum = ? WHERE id = ?').bind(durum, +m[1]).run();
    }
    return json({ tamam: true, sarki: await env.DB.prepare('SELECT id, vid, baslik, kapak, kim FROM sarki WHERE id = ?').bind(+m[1]).first() });
  }
  if ((m = alt.match(/^foto\/(\d+)$/)) && post) {
    const durum = govde.durum === 'onay' ? 'onay' : 'ret';
    const r = await env.DB.prepare('UPDATE foto SET durum = ? WHERE id = ? RETURNING anahtar').bind(durum, +m[1]).first();
    if (r && durum === 'ret') await caches.default.delete(new URL(`/f/${r.anahtar}`, istek.url).href);
    return json({ tamam: true });
  }
  // gönderenin cihazını engelle: bekleyen gönderileri reddedilir, yenisini gönderemez
  if ((m = alt.match(/^engelle\/(foto|sarki)\/(\d+)$/)) && post) {
    const r = await env.DB.prepare(`SELECT cihaz FROM ${m[1]} WHERE id = ?`).bind(+m[2]).first();
    if (!r?.cihaz) return json({ hata: 'Bu gönderinin cihazı bilinmiyor (eski kayıt).' }, 400);
    await env.DB.batch([
      env.DB.prepare('INSERT OR IGNORE INTO yasak (anahtar, zaman) VALUES (?, ?)').bind(`c:${r.cihaz}`, Date.now()),
      env.DB.prepare("UPDATE foto SET durum = 'ret' WHERE cihaz = ? AND durum = 'bekliyor'").bind(r.cihaz),
      env.DB.prepare("UPDATE sarki SET durum = 'ret' WHERE cihaz = ? AND durum IN ('bekliyor','oto')").bind(r.cihaz),
    ]);
    return json({ tamam: true });
  }
  if (alt === 'engel-kaldir' && post) {
    await env.DB.prepare('DELETE FROM yasak').run();
    return json({ tamam: true });
  }
  if (alt === 'ayar' && post) {
    const a = await ayarlar(env);
    for (const k of Object.keys(AYAR_VARSAYILAN)) if (typeof govde[k] === 'boolean') a[k] = govde[k];
    await ayarYaz(env, 'ayar', a);
    return json({ tamam: true, ayar: a });
  }
  if (alt === 'simdi' && post) {
    const kapakUrl = (u) => { const x = String(u || ''); return /^https:\/\/(i\.ytimg\.com|[\w-]+\.mzstatic\.com)\//.test(x) ? x.slice(0, 300) : ''; };
    await ayarYaz(env, 'simdi', { calan: temiz(govde.calan, 120), kapak: kapakUrl(govde.kapak), sira: (Array.isArray(govde.sira) ? govde.sira : []).slice(0, 5).map((x) => temiz(x, 120)) });
    return json({ tamam: true });
  }
  if (alt === 'juri' && !post) return json(await juriOzet(env));
  if (alt === 'juri/ayar' && post) {
    const a = await juriAyar(env);
    if (typeof govde.acik === 'boolean') a.acik = govde.acik;
    if (Array.isArray(govde.takimlar)) a.takimlar = govde.takimlar.slice(0, 60).map((t) => ({ id: temiz(t.id, 30), ad: temiz(t.ad, 80), proje: temiz(t.proje, 120), site: siteTemiz(t.site) })).filter((t) => t.id && t.ad);
    await ayarYaz(env, 'juri', a);
    return json(await juriOzet(env));
  }
  if (alt === 'juri/uye' && post) {
    const ad = temiz(govde.ad, 60);
    if (!ad) return json({ hata: 'Jüri adını yaz.' }, 400);
    await env.DB.prepare('INSERT INTO juri_uye (anahtar, ad, zaman) VALUES (?, ?, ?)').bind(crypto.randomUUID().replace(/-/g, ''), ad, Date.now()).run();
    return json(await juriOzet(env));
  }
  if (alt === 'juri/uye-sil' && post) {
    await env.DB.batch([
      env.DB.prepare('DELETE FROM juri_oy WHERE uye = ?').bind(String(govde.anahtar)),
      env.DB.prepare('DELETE FROM juri_uye WHERE anahtar = ?').bind(String(govde.anahtar)),
    ]);
    return json(await juriOzet(env));
  }
  if (alt === 'juri/sifirla' && post && govde.onay === 'OYLARI SIL') {
    await env.DB.prepare('DELETE FROM juri_oy').run();
    return json(await juriOzet(env));
  }
  if (alt === 'temizle' && post && govde.onay === 'HEPSINI SIL') {
    // R2'deki video dosyaları burada silinmez; kayıtları gidince hiçbir adresten açılamazlar
    await env.DB.batch(['DELETE FROM foto', 'DELETE FROM sarki', 'DELETE FROM hiz', 'DELETE FROM yasak', "DELETE FROM ayar WHERE ad = 'simdi'"].map((q) => env.DB.prepare(q)));
    return json({ tamam: true });
  }
  return json({ hata: 'Bulunamadı' }, 404);
}
