/* Kontrol paneli ↔ sahne sunucusu (../sahne-sunucu, Cloudflare Worker).
   Telefondan gelen şarkı isteklerini ve fotoğrafları buradan onaylarsın.
   Onaylanan şarkı sıraya (S.istekler) girer; ekran onu çalar. Onaylanan fotoğraf
   sunucunun /api/galeri listesine girer; ekran galeriyi oradan çeker. */
import { oku, ikisine, dinle, videoKimligi, kacir, kapakAdresi, siradakiler } from './ortak.js?v=11';

const $ = (id) => document.getElementById(id);
const AYAR = 'gak-sahne-sunucu';
let baglanti = (() => { try { return JSON.parse(localStorage.getItem(AYAR) || '{}'); } catch { return {}; } })();
let bagli = false, sonOzet = null, cekZaman;
const alinan = new Set();           // sıraya aldığımız şarkı kimlikleri (çift eklemeyi önler)
const kucukResim = new Map();       // foto id -> blob adresi

const taban = () => String(baglanti.adres || '').trim().replace(/\/+$/, '');
const disDurum = () => dispatchEvent(new Event('gak-dis-durum')); // kontrol.js kendi kopyasını tazelesin

async function api(yol, govde) {
  const r = await fetch(taban() + '/api/yonetim/' + yol, {
    method: govde ? 'POST' : 'GET',
    headers: { authorization: `Bearer ${baglanti.sifre || ''}`, ...(govde ? { 'content-type': 'application/json' } : {}) },
    body: govde ? JSON.stringify(govde) : undefined,
    cache: 'no-store',
  });
  if (r.status === 401) throw new Error('Şifre yanlış');
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).hata || `Sunucu hatası (${r.status})`);
  return r.headers.get('content-type')?.includes('json') ? r.json() : r.blob();
}

function durumYaz(yazi, iyi) {
  $('sv-durum').textContent = yazi;
  $('sv-durum').style.color = iyi ? 'var(--slate)' : 'var(--clay)';
}

/* ---------------------------------------------------------- bağlan */
$('sv-adres').value = baglanti.adres || ''; // yayındaki sahne sunucusunun adresi (yayinla.sh çıktısı)
$('sv-sifre').value = baglanti.sifre || '';
$('sv-baglan').addEventListener('click', async () => {
  baglanti = { adres: $('sv-adres').value.trim(), sifre: $('sv-sifre').value };
  try { localStorage.setItem(AYAR, JSON.stringify(baglanti)); } catch {}
  if (!taban()) { durumYaz('Sunucu adresini yaz', false); return; }
  durumYaz('Bağlanıyor…', true);
  if (await cek()) {
    // QR'lar ve galeri bu sunucuyu göstersin
    ikisine((S) => { S.qr.sarki = taban() + '/'; S.qr.foto = taban() + '/?s=foto'; S.galeri.api = taban() + '/api/galeri'; });
    disDurum();
  }
});

/* ---------------------------------------------------------- düzenli çekim */
async function cek() {
  clearTimeout(cekZaman);
  if (!taban()) return false;
  try {
    sonOzet = await api('ozet');
    bagli = true;
    durumYaz(`● Bağlı · ${sonOzet.sayi.sarki} istek, ${sonOzet.sayi.foto} fotoğraf geldi, ${sonOzet.sayi.galeri} galeride`, true);
    otomatikSarkilar();
    ciz();
    return true;
  } catch (e) {
    bagli = false;
    durumYaz(`○ ${e.message === 'Failed to fetch' ? 'Sunucuya ulaşılamadı' : e.message}`, false);
    return false;
  } finally {
    cekZaman = setTimeout(cek, 4000);
  }
}

/* sunucunun otomatik onayladığı ('oto') linkli istekleri sıraya al */
function otomatikSarkilar() {
  for (const s of sonOzet.sarkilar) if (s.durum === 'oto' && s.vid) sirayaAl(s);
}

async function sirayaAl(s) {
  if (alinan.has(s.id)) return;
  alinan.add(s.id);
  ikisine((S) => S.istekler.push({ id: 'q' + s.id, vid: s.vid, baslik: s.baslik, kapak: s.kapak || '', kim: s.kim || '' }));
  disDurum();
  try { await api(`sarki/${s.id}`, { durum: 'onay' }); } catch (e) { durumYaz(`Onay kaydedilemedi: ${e.message}`, false); }
}

/* ---------------------------------------------------------- çizim */
function ciz() {
  if (!sonOzet) return;
  const a = sonOzet.ayar;
  for (const k of ['sarkiAcik', 'fotoAcik', 'videoAcik', 'otoSarki', 'otoFoto']) if (document.activeElement !== $(`sv-${k}`)) $(`sv-${k}`).checked = a[k];

  const bekleyen = sonOzet.sarkilar.filter((s) => s.durum === 'bekliyor' && !alinan.has(s.id));
  $('sv-sarki-sayi').textContent = bekleyen.length ? `(${bekleyen.length})` : '';
  const kutu = $('sv-sarkilar');
  // link yazılan satır varken baştan çizme
  if (kutu.contains(document.activeElement) && document.activeElement.matches('input')) return fotolariCiz();
  kutu.innerHTML = bekleyen.map((s) => `
    <li data-id="${s.id}">
      ${kapakAdresi(s) ? `<img class="sv-kapak" src="${kacir(kapakAdresi(s))}" alt="">` : ''}
      <span title="${kacir(s.baslik)}"><b>${kacir(s.baslik)}</b>${s.kim ? ` <span class="not">· ${kacir(s.kim)}</span>` : ''}</span>
      ${s.vid ? `<a class="not" href="https://youtu.be/${kacir(s.vid)}" target="_blank" rel="noopener">dinle</a>`
        : `<a class="not" href="https://www.youtube.com/results?search_query=${encodeURIComponent(s.baslik)}" target="_blank" rel="noopener">YouTube'da ara</a><input class="sv-link" placeholder="Bulduğun linki yapıştır">`}
      <button class="ana" data-eylem="onay">Sıraya al</button>
      <button class="tehlike" data-eylem="ret" title="Reddet">×</button>
      <button class="tehlike" data-eylem="engelle" title="Bu telefondan gönderimi kapat (bekleyenleri de reddeder)">⛔</button>
    </li>`).join('') || '<li class="not">Bekleyen istek yok</li>';
  fotolariCiz();
}

function fotolariCiz() {
  const bek = sonOzet.fotolar, gal = sonOzet.galeri;
  $('sv-foto-sayi').textContent = bek.length ? `(${bek.length})` : '';
  $('sv-hepsi').hidden = bek.length < 2;
  kareler($('sv-fotolar'), bek, '<button class="ana" data-eylem="onay">Onayla</button><button class="tehlike" data-eylem="ret">Reddet</button><button class="tehlike" data-eylem="engelle" title="Bu telefondan gönderimi kapat (bekleyenleri de reddeder)">⛔</button>', 'Bekleyen fotoğraf ya da video yok');
  kareler($('sv-galeri'), gal, '<button class="tehlike" data-eylem="ret">Galeriden kaldır</button>', 'Galeri boş');
  // artık listede olmayanların blob adreslerini bırak
  const ids = new Set([...bek, ...gal].map((f) => f.id));
  for (const [id, u] of kucukResim) if (!ids.has(id)) { URL.revokeObjectURL(u); kucukResim.delete(id); }
}

function kareler(kutu, liste, dugmeler, bos) {
  const istenen = liste.map((f) => String(f.id)).join(',');
  if (kutu.dataset.ids === istenen) return; // değişmediyse dokunma, resimler göz kırpmasın
  kutu.dataset.ids = istenen;
  kutu.innerHTML = liste.map((f) => `
    <figure data-id="${f.id}">
      ${f.tur === 'video' ? `<video data-foto="${f.id}" muted loop playsinline autoplay controls></video>` : `<img alt="" data-foto="${f.id}">`}
      <figcaption>${f.tur === 'video' ? '🎥 ' : ''}${f.kim ? kacir(f.kim) : '<span class="not">isimsiz</span>'}${f.yazi ? `<br><i>“${kacir(f.yazi)}”</i>` : ''}</figcaption>
      <div class="satir">${dugmeler}</div>
    </figure>`).join('') || `<p class="not">${bos}</p>`;
  kutu.querySelectorAll('[data-foto]').forEach(async (img) => {
    const id = +img.dataset.foto;
    if (!kucukResim.has(id)) {
      try { kucukResim.set(id, URL.createObjectURL(await api(`foto/${id}`))); } catch { return; }
    }
    img.src = kucukResim.get(id);
  });
}

/* ---------------------------------------------------------- eylemler */
$('sv-sarkilar').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-eylem]'); if (!b) return;
  const li = b.closest('[data-id]'), id = +li.dataset.id;
  const s = sonOzet.sarkilar.find((x) => x.id === id); if (!s) return;
  try {
    if (b.dataset.eylem === 'engelle') { if (!engelOnay(b)) return; await api(`engelle/sarki/${id}`, {}); }
    else if (b.dataset.eylem === 'ret') { await api(`sarki/${id}`, { durum: 'ret' }); }
    else if (s.vid) { await sirayaAl(s); }
    else {
      const link = li.querySelector('.sv-link').value.trim();
      if (!videoKimligi(link)) { durumYaz('Önce YouTube linkini yapıştır', false); li.querySelector('.sv-link').focus(); return; }
      // sunucu linki doğrular ve başlığı getirir; sonra sıraya alırız
      const { sarki } = await api(`sarki/${id}`, { durum: 'onay', vid: link });
      alinan.add(id);
      ikisine((S) => S.istekler.push({ id: 'q' + id, vid: sarki.vid, baslik: sarki.baslik, kapak: sarki.kapak || '', kim: sarki.kim || '' }));
      disDurum();
    }
    document.activeElement?.blur();
    cek();
  } catch (err) { durumYaz(err.message, false); }
});

/* engelleme iki basışla: ilkinde düğme "Emin misin?" olur */
function engelOnay(b) {
  if (b.dataset.emin && Date.now() - b.dataset.emin < 4000) return true;
  b.dataset.emin = Date.now(); b.dataset.eski ??= b.textContent; b.textContent = 'Emin misin?';
  setTimeout(() => { b.textContent = b.dataset.eski; delete b.dataset.emin; }, 4000);
  return false;
}
async function fotoEylem(e) {
  const b = e.target.closest('[data-eylem]'); if (!b) return;
  const id = +b.closest('[data-id]').dataset.id;
  if (b.dataset.eylem === 'engelle' && !engelOnay(b)) return;
  b.disabled = true;
  try { await api(b.dataset.eylem === 'engelle' ? `engelle/foto/${id}` : `foto/${id}`, b.dataset.eylem === 'engelle' ? {} : { durum: b.dataset.eylem }); cek(); }
  catch (err) { durumYaz(err.message, false); b.disabled = false; }
}
$('sv-fotolar').addEventListener('click', fotoEylem);
$('sv-galeri').addEventListener('click', fotoEylem);
$('sv-hepsi').addEventListener('click', async () => {
  for (const f of sonOzet.fotolar) { try { await api(`foto/${f.id}`, { durum: 'onay' }); } catch {} }
  cek();
});

for (const k of ['sarkiAcik', 'fotoAcik', 'videoAcik', 'otoSarki', 'otoFoto']) {
  $(`sv-${k}`).addEventListener('change', async (e) => {
    try { await api('ayar', { [k]: e.target.checked }); cek(); } catch (err) { durumYaz(err.message, false); }
  });
}

/* etkinlik sonu: iki kez basınca her şey silinir */
let silOnay = 0;
$('sv-engel-kaldir').addEventListener('click', async (e) => {
  if (!engelOnay(e.target)) return;
  try { await api('engel-kaldir', {}); durumYaz('Tüm engeller kaldırıldı', true); } catch (err) { durumYaz(err.message, false); }
});
$('sv-temizle').addEventListener('click', async () => {
  if (Date.now() - silOnay > 4000) { silOnay = Date.now(); $('sv-temizle').textContent = 'Emin misin? 4 sn içinde tekrar bas'; setTimeout(() => { $('sv-temizle').textContent = 'Etkinlik bitti: tüm fotoğraf ve istekleri sil'; }, 4000); return; }
  try { await api('temizle', { onay: 'HEPSINI SIL' }); durumYaz('Sunucudaki her şey silindi', true); cek(); } catch (err) { durumYaz(err.message, false); }
});

/* ---------------------------------------------------------- telefondaki "şimdi çalıyor" */
let calanBaslik = '', calanKapak = '', simdiZaman, sonGonderilen = '';
function simdiGonder() {
  clearTimeout(simdiZaman);
  simdiZaman = setTimeout(async () => {
    if (!bagli) return;
    const veri = { calan: calanBaslik, kapak: calanBaslik ? calanKapak : '', sira: siradakiler(oku(), 5).map((r) => r.baslik) };
    const j = JSON.stringify(veri);
    if (j === sonGonderilen) return;
    try { await api('simdi', veri); sonGonderilen = j; } catch {}
  }, 1500);
}
dinle((m) => {
  if (m.tur === 'calar') { if (m.durum === 1 || m.durum === 3) { calanBaslik = m.baslik || ''; calanKapak = m.kapak || ''; } simdiGonder(); }
  if (m.tur === 'durum') simdiGonder();
});
addEventListener('gak-dis-durum', simdiGonder);
setInterval(simdiGonder, 30000);

if (taban()) cek();
