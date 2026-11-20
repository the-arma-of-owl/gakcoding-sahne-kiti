/* Kontrol paneli: ekran içerikleri TASLAKTA düzenlenir, "Yayınla" ile salona (canlı) geçer.
   Müzik, şarkı sırası, sunum kumandası ve telefondan gelenler canlı işlerdir, anında uygulanır. */
import { SAHNELER, oku, yaz, taslakOku, taslakYaz, ikisine, dinle, gonder, sureYaz, kacir, kapakAdresi, karistir, yeniKimlik, panikDegis, PANIK_TUSLARI, sesKesDegis, SES_TUSLARI, ozet, yayinHazirla, videoKimligi, resimYerlestir, kirpNormal } from './ortak.js?v=11';

const $ = (id) => document.getElementById(id);
let T = taslakOku();   // taslak
let C = oku();         // canlı (salonda)
let secili = T.sahne;
const taslakKaydet = () => { taslakYaz(T); ciz(); };
const tazele = () => { T = taslakOku(); C = oku(); ciz(); };

/* ---------------------------------------------------------- sol liste */
const LISTE = [...SAHNELER, { id: 'temel', ad: 'Temel ayarlar', tus: '0' }];
$('liste').innerHTML = LISTE.map((s) => (s.id === 'temel' ? '<hr>' : '') +
  `<button data-sahne="${s.id}"><kbd>${s.tus}</kbd><span>${s.ad}</span><i class="r-taslak">TASLAK</i><i class="r-canli">CANLI</i></button>`).join('') +
  '<p class="not">Ekranı seçmek onu taslağa koyar. Salona geçmesi için Yayınla.</p>';
$('liste').addEventListener('click', (e) => { const b = e.target.closest('[data-sahne]'); if (b) sec(b.dataset.sahne); });

function sec(id) {
  secili = id;
  if (id === 'temel') return ciz();
  if (id === 'konusmaci' && T.sahne !== 'konusmaci') T.ekran.konusmaci.muzikKis = true; // konuşmacıya her geçişte müzik kapalı başlar
  T.sahne = id;
  if (id === 'takim' && T.sahne !== 'takim') T.ekran.takim.muzikKis = true; // takım ekranına da müzik kapalı girilir
  if (id === 'mola') T.molaBitis = Date.now() + T.molaDk * 60000; // önizlemede sayaç dolu görünsün
  taslakKaydet();
}

/* ---------------------------------------------------------- yayınla / geri al */
function yayinla() {
  C = oku();
  const y = yayinHazirla(C, T);
  yaz(y); C = y;
  T = structuredClone(y); taslakKaydet();
}
$('yayinla').addEventListener('click', yayinla);
$('geri-al').addEventListener('click', () => { T = structuredClone(oku()); secili = T.sahne; taslakKaydet(); });

/* ---------------------------------------------------------- ekran bazlı göster/gizle */
const ANAHTAR_AD = {
  qr: 'QR kodları', calar: 'Şarkı adı (şimdi çalıyor)', video: 'YouTube videosu', sira: 'Sıradaki şarkılar',
  logolar: 'Kurum logoları', etiket: '"Canlı galeri" yazısı', arkaVideo: 'Robot arka plan videosu',
  kilim: 'Kilim köşeleri', serit: 'Üst şerit (logo, saat)', muzikKis: 'Bu ekranda müzik çalsın',
};
// Temel ayarlardaki şarkı kutusu kapalıyken kilitlenenler (video ve müzik bundan bağımsız)
const KUTUYA_BAGLI = ['qr', 'calar'];
const anahtar = (e, k) => {
  const acik = k === 'muzikKis' ? !e[k] : e[k];
  const kilit = KUTUYA_BAGLI.includes(k) && !T.sarkiKutusu;
  return `<label class="anahtar${acik ? '' : ' kapali'}${kilit ? ' kilitli' : ''}" title="${kilit ? 'Temel ayarlarda kapalı' : ''}"><input type="checkbox" data-k="${k}"${acik ? ' checked' : ''}${kilit ? ' disabled' : ''}> ${ANAHTAR_AD[k]}</label>`;
};
// iki grup: ekranda görünenler ve ses
function anahtarlariCiz() {
  document.querySelectorAll('[data-anahtar]').forEach((kutu) => {
    const e = T.ekran[kutu.dataset.anahtar], gorunen = Object.keys(e).filter((k) => k !== 'muzikKis');
    kutu.innerHTML = (gorunen.length ? `<div class="grup"><span class="grup-ad">Ekranda görünsün</span><div class="cipler">${gorunen.map((k) => anahtar(e, k)).join('')}</div></div>` : '')
      + `<div class="grup"><span class="grup-ad">Ses</span><div class="cipler">${anahtar(e, 'muzikKis')}</div></div>`
      + (!T.sarkiKutusu && gorunen.some((k) => KUTUYA_BAGLI.includes(k)) ? '<span class="not">QR ve şarkı adı Temel ayarlardan kapalı</span>' : '');
  });
}
document.addEventListener('change', (ev) => {
  const k = ev.target.dataset.k, kutu = ev.target.closest('[data-anahtar]');
  if (!k || !kutu) return;
  T.ekran[kutu.dataset.anahtar][k] = k === 'muzikKis' ? !ev.target.checked : ev.target.checked;
  taslakKaydet();
});
$('sarki-kutusu').addEventListener('change', (e) => { T.sarkiKutusu = e.target.checked; taslakKaydet(); });

/* ---------------------------------------------------------- konuşmacılar (taslak) */
function konusmacilariCiz() {
  const kutu = $('konusmacilar');
  // yazarken satırları baştan çizme, imleç kaçar
  if (kutu.contains(document.activeElement) && kutu.children.length === T.konusmacilar.length) {
    [...kutu.children].forEach((r, i) => r.classList.toggle('aktif', T.konusmacilar[i].id === T.aktifKonusmaci));
    return;
  }
  kutu.innerHTML = T.konusmacilar.map((k) => `
    <div class="konusmaci${k.id === T.aktifKonusmaci ? ' aktif' : ''}" data-id="${k.id}">
      <input data-k="ad" value="${kacir(k.ad)}" placeholder="Ad Soyad">
      <input data-k="unvan" value="${kacir(k.unvan)}" placeholder="Unvan / kurum">
      <input data-k="konu" value="${kacir(k.konu)}" placeholder="Konu (isteğe bağlı)">
      <button class="ana" data-eylem="sec">Seç</button>
      <button class="tehlike" data-eylem="sil" title="Listeden çıkar">×</button>
      <div class="yuvalar">${yuva('foto', k.foto)}${yuva('logo', k.logo)}${yuva('arka', k.arka)}</div>
    </div>`).join('');
}

/* ---------------------------------------------------------- konuşmacı görselleri (isteğe bağlı)
   Resim yerel sunucuya yüklenir (yuklenen/ klasörü), durumda yalnız yolu tutulur. */
const YUVA_AD = { foto: 'Fotoğraf', logo: 'Logo', arka: 'Arka görsel' };
function yuva(tur, yol) {
  return `<div class="yuva" data-tur="${tur}" title="Tıkla ya da resmi buraya sürükle">
    <span class="kucuk" style="${yol ? `background-image:url('${kacir(yol)}')` : ''}">${yol ? '' : '+'}</span>${YUVA_AD[tur]}${yol ? '<button data-eylem="kirp" title="Yakınlaştır, kaydır">Kırp</button>' : ''}${yol ? '<button class="tehlike" data-eylem="kaldir" title="Kaldır">×</button>' : ''}</div>`;
}
function genelYuvaCiz() {
  const el = document.querySelector('[data-yuva="genel-arka"]');
  el.outerHTML = yuva('arka', T.konusmaciArka).replace('class="yuva"', 'class="yuva" data-yuva="genel-arka"');
}
// tıklanan/üstüne bırakılan yuva -> taslakta hangi alan
function yuvaYaz(el, yol) {
  // yeni resim eski resmin kırpma ayarını almasın
  if (el.dataset.yuva === 'genel-arka') { T.konusmaciArka = yol; delete T.konusmaciArkaKirp; }
  else { const k = T.konusmacilar.find((x) => x.id === el.closest('[data-id]').dataset.id); if (k) { k[el.dataset.tur] = yol; delete k[el.dataset.tur + 'Kirp']; } }
  document.activeElement?.blur?.(); taslakKaydet();
}
async function resimYukle(el, dosya) {
  if (!dosya?.type.startsWith('image/')) { alanHata('Yalnız resim dosyası seçilebilir.'); return; }
  el.classList.add('yukleniyor');
  try {
    const r = await fetch('/api/yukle', { method: 'POST', headers: { 'content-type': dosya.type }, body: dosya });
    const d = await r.json();
    if (!r.ok) throw new Error(d.hata || r.status);
    yuvaYaz(el, d.yol);
  } catch (err) { alanHata(`Yüklenemedi: ${err.message}. Yerel sunucu (baslat.sh) açık mı?`); el.classList.remove('yukleniyor'); }
}
const alanHata = (m) => { const n = document.querySelector('[data-ayar="konusmaci"] .satir:last-of-type .not'); if (n) { n.textContent = m; n.classList.add('hata'); } };
let hedefYuva = null;
const yuvaBul = (e) => e.target.closest('.yuva');
const konusmaciKutusu = document.querySelector('[data-ayar="konusmaci"]');
konusmaciKutusu.addEventListener('click', (e) => {
  const el = yuvaBul(e); if (!el) return;
  if (e.target.closest('[data-eylem="kaldir"]')) { e.stopPropagation(); yuvaYaz(el, ''); return; }
  if (e.target.closest('[data-eylem="kirp"]')) { e.stopPropagation(); kirpAc(el.closest('[data-id]')?.dataset.id, el.dataset.tur); return; }
  hedefYuva = el; $('dosya-sec').value = ''; $('dosya-sec').click();
}, true);
$('dosya-sec').addEventListener('change', () => { if (hedefYuva && $('dosya-sec').files[0]) resimYukle(hedefYuva, $('dosya-sec').files[0]); });
konusmaciKutusu.addEventListener('dragover', (e) => { const el = yuvaBul(e); if (!el || !e.dataTransfer.types.includes('Files')) return; e.preventDefault(); el.classList.add('ustunde'); });
konusmaciKutusu.addEventListener('dragleave', (e) => yuvaBul(e)?.classList.remove('ustunde'));
konusmaciKutusu.addEventListener('drop', (e) => { const el = yuvaBul(e); if (!el) return; e.preventDefault(); el.classList.remove('ustunde'); resimYukle(el, e.dataTransfer.files[0]); });
$('konusmacilar').addEventListener('input', (e) => {
  const satir = e.target.closest('[data-id]'), k = T.konusmacilar.find((x) => x.id === satir?.dataset.id);
  if (!k || !e.target.dataset.k) return;
  k[e.target.dataset.k] = e.target.value;
  taslakKaydet();
});
$('konusmacilar').addEventListener('click', (e) => {
  const b = e.target.closest('[data-eylem]'); if (!b) return;
  const id = b.closest('[data-id]').dataset.id;
  if (b.dataset.eylem === 'sec') { if (T.aktifKonusmaci !== id || T.sahne !== 'konusmaci') T.ekran.konusmaci.muzikKis = true; T.aktifKonusmaci = id; T.sahne = 'konusmaci'; }
  if (b.dataset.eylem === 'sil') { T.konusmacilar = T.konusmacilar.filter((x) => x.id !== id); document.activeElement.blur(); }
  taslakKaydet();
});
/* kırpma penceresi: fotoğraf/logo yuvarlak, arka görsel ekran oranında; ekrandaki ile aynı transform.
   id yoksa genel arka görsel (T.konusmaciArka) düzenlenir. */
let kirpHedef = null, salonOrani = 16 / 9;
const kirpNesne = () => kirpHedef?.id ? (kirpHedef.takim ? T.takimlar : T.konusmacilar).find((x) => x.id === kirpHedef.id) : T;
const kirpAlan = () => kirpHedef.id ? kirpHedef.tur : 'konusmaciArka';
const kirpDeger = () => kirpNormal(kirpNesne()?.[kirpAlan() + 'Kirp'], $('kirp-resim'), kirpHedef.tur);
function kirpGoster() {
  const d = kirpDeger();
  resimYerlestir($('kirp-resim'), d, kirpHedef.tur);
  $('kirp-z').value = d.z;
}
function kirpYaz(d) {
  const k = kirpNesne(); if (!k) return;
  const v = { ...kirpDeger(), ...d, v: 2 };
  v.z = Math.min(4, Math.max(0.4, +v.z));
  v.x = Math.round(Math.min(400, Math.max(-400, v.x)) * 10) / 10;
  v.y = Math.round(Math.min(400, Math.max(-400, v.y)) * 10) / 10;
  k[kirpAlan() + 'Kirp'] = v;
  kirpGoster(); taslakKaydet();
}
function kirpAc(id, tur, takim) {
  kirpHedef = { id, tur, takim };
  const k = kirpNesne(); if (!k) return;
  $('kirp-baslik').textContent = id ? `${k.ad || 'Konuşmacı'} · ${YUVA_AD[tur]}` : 'Genel arka görsel';
  $('kirp-daire').classList.toggle('logo', tur === 'logo');
  $('kirp-daire').classList.toggle('arka', tur === 'arka');
  // arka görsel penceresi salon ekranının oranında: gördüğün yer salondaki yer olsun
  $('kirp-daire').style.height = tur === 'arka' ? `${328 / salonOrani + 8}px` : ''; // 336 genişlik, 4+4 kenarlık
  $('kirp-resim').addEventListener('load', kirpGoster, { once: true });
  $('kirp-resim').src = $('kirp-bulanik').src = k[kirpAlan()];
  $('kirp-pencere').showModal(); kirpGoster();
}
let kirpTut = null;
$('kirp-daire').addEventListener('pointerdown', (e) => {
  const { x, y } = kirpDeger();
  kirpTut = { px: e.clientX, py: e.clientY, x, y, en: $('kirp-daire').clientWidth, boy: $('kirp-daire').clientHeight };
  $('kirp-daire').setPointerCapture(e.pointerId); $('kirp-daire').classList.add('tutuluyor');
});
$('kirp-daire').addEventListener('pointermove', (e) => {
  if (!kirpTut) return;
  kirpYaz({ x: kirpTut.x + (e.clientX - kirpTut.px) / kirpTut.en * 100, y: kirpTut.y + (e.clientY - kirpTut.py) / kirpTut.boy * 100 });
});
const kirpBirak = () => { kirpTut = null; $('kirp-daire').classList.remove('tutuluyor'); };
$('kirp-daire').addEventListener('pointerup', kirpBirak);
$('kirp-daire').addEventListener('pointercancel', kirpBirak);
$('kirp-daire').addEventListener('wheel', (e) => { e.preventDefault(); kirpYaz({ z: kirpDeger().z * (e.deltaY < 0 ? 1.06 : 1 / 1.06) }); }, { passive: false });
$('kirp-z').addEventListener('input', () => kirpYaz({ z: $('kirp-z').value }));
$('kirp-sifirla').addEventListener('click', () => kirpYaz({ z: 1, x: 0, y: 0 }));
$('kirp-kapat').addEventListener('click', () => $('kirp-pencere').close());

$('k-ekle').addEventListener('click', () => {
  T.konusmacilar.push({ id: 'k' + Date.now().toString(36), ad: '', unvan: '', konu: '' });
  document.activeElement.blur(); taslakKaydet();
  $('konusmacilar').lastElementChild?.querySelector('input')?.focus();
});

/* ---------------------------------------------------------- takım sahnede */
const takimYuva = (t, tur) => `<div class="yuva" data-tur="${tur}" title="Tıkla ya da dosyayı buraya sürükle">
  <span class="kucuk" style="${tur === 'foto' && t.foto ? `background-image:url('${kacir(t.foto)}')` : ''}">${tur === 'video' && t.video ? '🎬' : tur === 'foto' && t.foto ? '' : '+'}</span>${tur === 'foto' ? 'Takım fotoğrafı' : 'Video dosyası'}${tur === 'foto' && t.foto ? '<button data-eylem="kirp" title="Yakınlaştır, kaydır">Kırp</button>' : ''}${t[tur] ? '<button class="tehlike" data-eylem="kaldir" title="Kaldır">×</button>' : ''}</div>`;
function takimlariCiz() {
  const kutu = $('takimlar');
  if (kutu.contains(document.activeElement) && kutu.children.length === T.takimlar.length) {
    [...kutu.children].forEach((r, i) => r.classList.toggle('aktif', T.takimlar[i].id === T.aktifTakim));
    return;
  }
  kutu.innerHTML = T.takimlar.map((t) => `
    <div class="konusmaci takim${t.id === T.aktifTakim ? ' aktif' : ''}" data-id="${t.id}">
      <input data-k="ad" value="${kacir(t.ad)}" placeholder="Takım adı">
      <input data-k="proje" value="${kacir(t.proje)}" placeholder="Proje adı">
      <input data-k="derece" value="${kacir(t.derece)}" placeholder="Derece (1. oldu)">
      <button class="ana" data-eylem="sec">Seç</button>
      <button class="tehlike" data-eylem="sil" title="Listeden çıkar">×</button>
      <div class="genis"><input data-k="odul" value="${kacir(t.odul)}" placeholder="Ödül"><input data-k="uyeler" value="${kacir(t.uyeler)}" placeholder="Üyeler (virgülle ayır)"><input data-k="site" type="url" value="${kacir(t.site)}" placeholder="Site linki (https://…)"><input data-k="yt" value="${kacir(t.yt)}" placeholder="YouTube linki"></div>
      <div class="yuvalar">${takimYuva(t, 'foto')}${takimYuva(t, 'video')}</div>
    </div>`).join('') || '<p class="not">Henüz takım yok.</p>';
}
const takimNot = (m, hata) => { $('t-not').textContent = m; $('t-not').classList.toggle('hata', !!hata); };
async function takimDosya(el, dosya) {
  const tur = el.dataset.tur;
  if (!dosya?.type.startsWith(tur === 'foto' ? 'image/' : 'video/')) return takimNot(tur === 'foto' ? 'Buraya resim dosyası koy.' : 'Buraya video dosyası koy.', true);
  const id = el.closest('[data-id]').dataset.id;
  el.classList.add('yukleniyor'); takimNot('Yükleniyor…');
  try {
    const r = await fetch('/api/yukle', { method: 'POST', headers: { 'content-type': dosya.type }, body: dosya });
    const d = await r.json();
    if (!r.ok) throw new Error(d.hata || r.status);
    const t = T.takimlar.find((x) => x.id === id);
    if (t) { t[tur] = d.yol; if (tur === 'foto') delete t.fotoKirp; }
    document.activeElement?.blur?.(); takimNot('Yüklendi. Salona geçmesi için Yayınla.'); taslakKaydet();
  } catch (err) { takimNot(`Yüklenemedi: ${err.message}. Yerel sunucu (baslat.sh) açık mı?`, true); el.classList.remove('yukleniyor'); }
}
let takimHedef = null;
$('takimlar').addEventListener('click', (e) => {
  const b = e.target.closest('[data-eylem]'), el = e.target.closest('.yuva');
  const id = e.target.closest('[data-id]')?.dataset.id, t = T.takimlar.find((x) => x.id === id);
  if (el && b?.dataset.eylem === 'kaldir') { t[el.dataset.tur] = ''; if (el.dataset.tur === 'foto') delete t.fotoKirp; document.activeElement?.blur?.(); return taslakKaydet(); }
  if (el && b?.dataset.eylem === 'kirp') return kirpAc(id, 'foto', true);
  if (el) { takimHedef = el; $('t-dosya').accept = el.dataset.tur === 'foto' ? 'image/*' : 'video/*'; $('t-dosya').value = ''; $('t-dosya').click(); return; }
  if (!b) return;
  if (b.dataset.eylem === 'sec') takimSec(id);
  if (b.dataset.eylem === 'sil') { T.takimlar = T.takimlar.filter((x) => x.id !== id); document.activeElement?.blur?.(); taslakKaydet(); }
});
function takimSec(id) {
  if (T.aktifTakim !== id || T.sahne !== 'takim') { T.ekran.takim.muzikKis = true; T.takimMod = 'kart'; }
  T.aktifTakim = id; T.sahne = 'takim'; secili = 'takim';
  document.activeElement?.blur?.(); taslakKaydet();
}
addEventListener('gak-takim-sec', (e) => takimSec(e.detail));
$('t-dosya').addEventListener('change', () => { if (takimHedef && $('t-dosya').files[0]) takimDosya(takimHedef, $('t-dosya').files[0]); });
$('takimlar').addEventListener('dragover', (e) => { const el = e.target.closest('.yuva'); if (!el || !e.dataTransfer.types.includes('Files')) return; e.preventDefault(); el.classList.add('ustunde'); });
$('takimlar').addEventListener('dragleave', (e) => e.target.closest('.yuva')?.classList.remove('ustunde'));
$('takimlar').addEventListener('drop', (e) => { const el = e.target.closest('.yuva'); if (!el) return; e.preventDefault(); el.classList.remove('ustunde'); takimDosya(el, e.dataTransfer.files[0]); });
$('takimlar').addEventListener('input', (e) => {
  const t = T.takimlar.find((x) => x.id === e.target.closest('[data-id]')?.dataset.id);
  if (!t || !e.target.dataset.k) return;
  t[e.target.dataset.k] = e.target.value;
  taslakKaydet();
});
$('t-ekle').addEventListener('click', () => {
  T.takimlar.push({ id: 't' + Date.now().toString(36), ad: '', proje: '', derece: '', odul: '', uyeler: '', site: '', yt: '', video: '', foto: '' });
  document.activeElement?.blur?.(); taslakKaydet();
  $('takimlar').lastElementChild?.querySelector('input')?.focus();
});
// takim-aktar.py'nin yazdığı listeyi katar: yalnız boş alanları doldurur, elle yazılanı ezmez
const adKey = (s) => (s || '').trim().toLocaleLowerCase('tr');
$('t-cms').addEventListener('click', async () => {
  let liste;
  try {
    const r = await fetch('yuklenen/takimlar-cms.json', { cache: 'no-store' });
    if (!r.ok) throw new Error(r.status);
    liste = await r.json();
  } catch { return takimNot('CMS listesi yok: önce takim-aktar.py çalışmalı.', true); }
  let yeni = 0, dolan = 0;
  for (const g of liste) {
    const t = T.takimlar.find((x) => x.id === g.id || adKey(x.ad) === adKey(g.ad));
    if (!t) { T.takimlar.push({ derece: '', odul: '', video: '', ...g }); yeni++; continue; }
    for (const k of ['ad', 'proje', 'uyeler', 'site', 'yt', 'foto']) if (!t[k] && g[k]) { t[k] = g[k]; dolan++; }
  }
  document.activeElement?.blur?.(); taslakKaydet();
  takimNot(`${yeni} takım eklendi, ${dolan} boş alan dolduruldu. Salona geçmesi için Yayınla.`);
});
/* salondaki takımın görünümü anında değişir */
const salonTakimi = () => C.sahne === 'takim' ? C.takimlar.find((x) => x.id === C.aktifTakim) || C.takimlar[0] : null;
const siteAdresi = (t) => t?.site && /^https?:\/\//i.test(t.site) ? t.site : '';
const modYaz = (mod) => { ikisine((S) => { S.takimMod = mod; }); tazele(); };
const modNot = (m, hata) => { $('t-mod-not').textContent = m; $('t-mod-not').classList.toggle('hata', !!hata); };
const sitePencere = (t) => window.open(t.site, 'gak-takim-site');
$('t-modlar').addEventListener('click', async (e) => {
  const mod = e.target.dataset.mod, t = salonTakimi(); if (!mod) return;
  if (!t) return modNot('Önce takımı seçip yayınla.', true);
  if (mod === 'site') {
    if (!siteAdresi(t)) return modNot('Bu takımın site linki yok (https:// ile başlamalı).', true);
    modNot('Site kontrol ediliyor…');
    let d = {};
    try { d = await (await fetch(`/api/cerceve?adres=${encodeURIComponent(t.site)}`)).json(); } catch {}
    if (d.gomulur === false) { modYaz('kart'); sitePencere(t); return modNot('Bu site başka sayfaya gömülmeyi yasaklıyor. Ayrı pencerede açıldı: pencereyi projeksiyona sürükle, F11 ile tam ekran yap.', true); }
    modNot(d.gomulur === null ? `Siteye bakılamadı (${d.neden || 'bilinmiyor'}). Salonda boş görünürse "Siteyi pencerede aç"a bas.` : 'Canlı site salonda açık. Demoyu salon ekranı penceresinde fareyle kullan.', d.gomulur === null);
  } else if (mod === 'video' && !t.video) return modNot('Bu takıma video dosyası yüklenmedi.', true);
  else if (mod === 'yt' && !videoKimligi(t.yt)) return modNot('Bu takımın YouTube linki tanınmadı.', true);
  else if (mod !== 'kart') modNot('Salonda oynuyor. Ses açılmazsa salon ekranına bir kez tıkla.');
  else modNot('Salonda takım kartı var.');
  modYaz(mod);
});
$('t-pencere').addEventListener('click', () => { const t = salonTakimi() || T.takimlar.find((x) => x.id === T.aktifTakim); if (siteAdresi(t)) sitePencere(t); else modNot('Takımın site linki yok.', true); });
document.querySelector('[data-ayar="takim"]').addEventListener('click', (e) => { if (e.target.dataset.video) gonder({ tur: 'takim-video', eylem: e.target.dataset.video }); });

/* ---------------------------------------------------------- diğer taslak alanları */
$('kodlama-bitis').addEventListener('change', (e) => { T.kodlamaBitis = e.target.value; taslakKaydet(); });
$('kodlama-saat').addEventListener('change', (e) => { T.kodlamaSaat = Math.max(0.5, +e.target.value || 6); taslakKaydet(); });
$('mola-dk').addEventListener('change', (e) => { T.molaDk = Math.max(1, +e.target.value || 15); T.molaBitis = Date.now() + T.molaDk * 60000; taslakKaydet(); });
$('mola-yeniden').addEventListener('click', () => { T.molaYeniden = true; T.sahne = 'mola'; T.molaBitis = Date.now() + T.molaDk * 60000; taslakKaydet(); });
document.querySelectorAll('input[data-alan]').forEach((el) => el.addEventListener('input', () => {
  const [a, b] = el.dataset.alan.split('.');
  T[a][b] = el.value;
  taslakKaydet();
}));

/* ---------------------------------------------------------- sunum kumandası (anında) */
const desteYon = (yon) => {
  if (C.sahne !== 'sunum') { $('d-not').textContent = 'Salonda sunum açık değil: önce Sunum\'u seçip yayınla.'; $('d-not').classList.add('hata'); return; }
  $('d-not').classList.remove('hata'); $('d-not').textContent = 'Tıklayıcı da çalışır: panel ya da sunucu görünümü seçiliyken ← → / PageUp PageDown / ses tuşları. Telefondan: KDE Connect → Sunum kumandası (ses tuşlarıyla, ekran kilitliyken de).';
  gonder({ tur: 'deste', yon });
};
$('d-ileri').addEventListener('click', () => desteYon('ileri'));
$('d-geri').addEventListener('click', () => desteYon('geri'));
$('d-bas').addEventListener('click', () => desteYon('bas'));

/* ---------------------------------------------------------- tuşlar */
const ILERI = ['ArrowRight', 'PageDown', 'AudioVolumeUp'], GERI = ['ArrowLeft', 'PageUp', 'AudioVolumeDown'];
addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); yayinla(); return; }
  if (e.target.matches('input, textarea, select') || e.ctrlKey || e.metaKey || e.altKey) return;
  if (PANIK_TUSLARI.includes(e.key)) { e.preventDefault(); panikDegis(); tazele(); return; }
  if (SES_TUSLARI.includes(e.key)) { e.preventDefault(); sesKesDegis(); tazele(); return; }
  if (ILERI.includes(e.key) || GERI.includes(e.key)) { e.preventDefault(); desteYon(ILERI.includes(e.key) ? 'ileri' : 'geri'); return; }
  const s = LISTE.find((x) => x.tus === e.key);
  if (s) sec(s.id);
});

/* ---------------------------------------------------------- müzik (anında, temel)
   Hazır listeler: sekmeye tıklamak listeyi açar, ▶ o listeye geçer (ses yumuşakça değişir).
   Liste sırası sürükle bırakla değişir; calanId'den öncekiler çalındı sayılır. */
let bakilan = C.muzik.aktif;
const bakilanListe = (S) => S.muzik.listeler.find((l) => l.id === bakilan) || S.muzik.listeler[0];
// liste değişiklikleri: canlı ve taslağa yazılır, zaman damgası dosyaya kayıtta kullanılır
const muzikDegis = (f) => { ikisine((S) => { f(S); S.muzik.zaman = Date.now(); }); tazele(); };

$('m-oynat').addEventListener('click', () => { const c = !C.muzik.calsin; ikisine((S) => { S.muzik.calsin = c; }); tazele(); });
$('m-gec').addEventListener('click', () => gonder({ tur: 'muzik', eylem: 'gec' }));
$('m-ses').addEventListener('input', (e) => { const v = +e.target.value; ikisine((S) => { S.muzik.ses = v; }); tazele(); });

$('m-sekmeler').addEventListener('click', (e) => {
  const b = e.target.closest('[data-liste]');
  if (b) {
    bakilan = b.dataset.liste;
    if (e.target.closest('[data-gec]')) muzikDegis((S) => { S.muzik.aktif = bakilan; });
    else ciz();
  }
  if (e.target.closest('#m-yeni')) {
    const id = yeniKimlik();
    muzikDegis((S) => { S.muzik.listeler.push({ id, ad: 'Yeni liste', karisik: true, calanId: '', sarkilar: [] }); });
    bakilan = id; ciz(); $('m-ad').select();
  }
});
$('m-ad').addEventListener('input', (e) => { const v = e.target.value; muzikDegis((S) => { bakilanListe(S).ad = v; }); });
$('m-karisik').addEventListener('change', (e) => { const v = e.target.checked; muzikDegis((S) => { bakilanListe(S).karisik = v; }); });
$('m-karistir').addEventListener('click', () => muzikDegis((S) => {
  const L = bakilanListe(S), i = L.sarkilar.findIndex((x) => x.id === L.calanId) + 1;
  L.sarkilar = [...L.sarkilar.slice(0, i), ...karistir(L.sarkilar.slice(i))];
}));
let silOnayi = 0;
$('m-liste-sil').addEventListener('click', () => {
  if (C.muzik.listeler.length < 2) { $('m-onizle').textContent = 'Son liste silinemez.'; return; }
  if (bakilan === C.muzik.aktif) { $('m-onizle').textContent = 'Çalan liste silinemez; önce başka listeye geç.'; return; }
  if (Date.now() - silOnayi > 4000) { silOnayi = Date.now(); $('m-liste-sil').textContent = 'Emin misin? Tekrar bas'; setTimeout(() => { $('m-liste-sil').textContent = 'Listeyi sil'; }, 4000); return; }
  const id = bakilan;
  muzikDegis((S) => { S.muzik.listeler = S.muzik.listeler.filter((l) => l.id !== id); });
  bakilan = C.muzik.aktif; $('m-liste-sil').textContent = 'Listeyi sil'; ciz();
});

/* ekleme: tek link yazılınca adı ve kapağı hemen görünür; "Ekle" listenin sonuna koyar */
let onizleme = null; // { metin, sonuc }
async function coz(metin) {
  const r = await fetch('/api/coz', { method: 'POST', body: JSON.stringify({ metin }) });
  if (!r.ok) throw new Error(`yerel sunucu ${r.status}`);
  return r.json();
}
function sonucCiz(sonuc, eklendi) {
  const kartlar = sonuc.sarkilar.length === 1 && !eklendi
    ? `<div class="kart"><img src="${kacir(kapakAdresi(sonuc.sarkilar[0]))}" alt=""><span><b>${kacir(sonuc.sarkilar[0].baslik)}</b>${kacir(sonuc.sarkilar[0].kanal || '')}</span></div>`
    : `${sonuc.kaynaklar.map(kacir).join(' · ')}${sonuc.sarkilar.length ? ` · ${sonuc.sarkilar.length} şarkı ${eklendi ? 'eklendi' : 'bulundu'}` : ''}`;
  $('m-onizle').innerHTML = kartlar + sonuc.hatalar.map((h) => `<div class="hata-satir">${kacir(h.girdi || '')}: ${kacir(h.hata)}</div>`).join('');
}
let onizZaman;
$('m-girdi').addEventListener('input', () => {
  clearTimeout(onizZaman); onizleme = null;
  const metin = $('m-girdi').value.trim();
  if (!metin) { $('m-onizle').textContent = ''; return; }
  // tek satırlık linkte önizleme; toplu girişte "Ekle"ye basınca çözülür
  if (metin.includes('\n') || !/^https?:\/\//.test(metin)) { $('m-onizle').textContent = metin.includes('\n') ? `${metin.split('\n').filter((x) => x.trim()).length} satır: Ekle'ye bas` : ''; return; }
  onizZaman = setTimeout(async () => {
    $('m-onizle').textContent = 'Bakılıyor…';
    try {
      const sonuc = await coz(metin);
      if ($('m-girdi').value.trim() !== metin) return;
      onizleme = { metin, sonuc }; sonucCiz(sonuc, false);
    } catch (err) { $('m-onizle').textContent = `Bakılamadı: ${err.message}`; }
  }, 500);
});
$('m-girdi').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !$('m-girdi').value.includes('\n')) { e.preventDefault(); ekle(); } });
$('m-ekle').addEventListener('click', ekle);
async function ekle() {
  const metin = $('m-girdi').value.trim();
  if (!metin) return;
  $('m-ekle').disabled = true;
  $('m-onizle').textContent = 'Şarkılar bulunuyor… (uzun Spotify listesi yarım dakika sürebilir)';
  try {
    const sonuc = onizleme?.metin === metin ? onizleme.sonuc : await coz(metin);
    const yeni = sonuc.sarkilar.map((x) => ({ id: yeniKimlik(), vid: x.vid, baslik: x.baslik, kapak: x.kapak || '' }));
    const hedef = bakilan;
    muzikDegis((S) => { S.muzik.listeler.find((l) => l.id === hedef)?.sarkilar.push(...yeni); });
    sonucCiz(sonuc, true);
    if (!sonuc.hatalar.length) $('m-girdi').value = '';
    onizleme = null;
  } catch (err) { $('m-onizle').textContent = `Eklenemedi: ${err.message}. Yerel sunucu (baslat.sh) açık mı?`; }
  $('m-ekle').disabled = false;
}

/* satır düğmeleri: şimdi çal, dinle (QR), çıkar */
function dinleQR(r) {
  const q = qrcode(0, 'M'); q.addData(`https://youtu.be/${r.vid}`); q.make();
  $('qr-svg').innerHTML = q.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
  $('qr-baslik').textContent = r.baslik || '';
  $('qr-pencere').showModal();
}
$('qr-kapat').addEventListener('click', () => $('qr-pencere').close());
$('m-sarkilar').addEventListener('click', (e) => {
  const b = e.target.closest('[data-eylem]'); if (!b) return;
  const id = b.closest('[data-id]').dataset.id, L = bakilanListe(C), r = L.sarkilar.find((x) => x.id === id);
  if (!r) return;
  if (b.dataset.eylem === 'dinle') return dinleQR(r);
  if (b.dataset.eylem === 'duraklat') return $('m-oynat').click();
  if (b.dataset.eylem === 'gec') return $('m-gec').click();
  const hedef = L.id;
  if (b.dataset.eylem === 'cal') muzikDegis((S) => { S.muzik.aktif = hedef; S.muzik.listeler.find((l) => l.id === hedef).calanId = id; });
  if (b.dataset.eylem === 'sil') muzikDegis((S) => {
    const l = S.muzik.listeler.find((x) => x.id === hedef), i = l.sarkilar.findIndex((x) => x.id === id);
    // çalan şarkı çıkarılırsa başa değil sıradakine geçilsin
    if (l.calanId === id) l.calanId = (l.sarkilar[i + 1] || l.sarkilar[0])?.id;
    l.sarkilar = l.sarkilar.filter((x) => x.id !== id);
    if (l.calanId === id) l.calanId = undefined;
  });
});
$('istekler').addEventListener('click', (e) => {
  const b = e.target.closest('[data-eylem]'); if (!b) return;
  const id = b.closest('[data-id]').dataset.id, r = C.istekler.find((x) => x.id === id);
  if (!r) return;
  if (b.dataset.eylem === 'dinle') return dinleQR(r);
  if (b.dataset.eylem === 'sil') muzikDegis((S) => { S.istekler = S.istekler.filter((x) => x.id !== id); });
  if (b.dataset.eylem === 'siradaki') istegiTasi(id, C.muzik.aktif, null);
});

/* sürükle bırak: liste içinde sıra, istekten listeye, sekmeye bırakınca o listenin sonuna */
let suruklenen = null; // { kaynak: 'liste' | 'istek', id }
function istegiTasi(id, listeId, onceId) {
  muzikDegis((S) => {
    const i = S.istekler.findIndex((x) => x.id === id), L = S.muzik.listeler.find((l) => l.id === listeId);
    if (i < 0 || !L) return;
    const [r] = S.istekler.splice(i, 1);
    const x = { id: yeniKimlik(), vid: r.vid, baslik: r.baslik, kapak: r.kapak || '', kim: r.kim || '' };
    // yer verilmediyse çalanın hemen arkasına
    const j = onceId === null ? L.sarkilar.findIndex((z) => z.id === L.calanId) + 1 : onceId === '' ? L.sarkilar.length : L.sarkilar.findIndex((z) => z.id === onceId);
    L.sarkilar.splice(j < 0 ? L.sarkilar.length : j, 0, x);
  });
}
for (const ol of [$('m-sarkilar'), $('istekler')]) {
  ol.addEventListener('dragstart', (e) => {
    const li = e.target.closest('li[data-id]'); if (!li) return;
    suruklenen = { kaynak: ol.id === 'istekler' ? 'istek' : 'liste', id: li.dataset.id };
    e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', li.dataset.id);
    setTimeout(() => li.classList.add('tasiniyor'));
  });
  ol.addEventListener('dragend', () => { suruklenen = null; isaretTemizle(); ciz(); });
}
const isaretTemizle = () => document.querySelectorAll('.ust, .alt, .surukle-ustu, .bos-hedef').forEach((x) => x.classList.remove('ust', 'alt', 'surukle-ustu', 'bos-hedef'));
// imlecin altındaki satır ve üst/alt yarısı -> önüne konacak şarkının kimliği ('' = sona)
function birakmaYeri(e) {
  const satirlar = [...$('m-sarkilar').querySelectorAll('li[data-id]')];
  for (const li of satirlar) {
    const k = li.getBoundingClientRect();
    if (e.clientY < k.top + k.height / 2) return { li, onceId: li.dataset.id, yon: 'ust' };
  }
  const son = satirlar.at(-1);
  return { li: son, onceId: '', yon: 'alt' };
}
$('m-sarkilar').addEventListener('dragover', (e) => {
  if (!suruklenen) return;
  e.preventDefault(); isaretTemizle();
  const y = birakmaYeri(e);
  if (y.li) y.li.classList.add(y.yon); else $('m-sarkilar').classList.add('bos-hedef');
});
$('m-sarkilar').addEventListener('drop', (e) => {
  if (!suruklenen) return;
  e.preventDefault();
  const { onceId } = birakmaYeri(e), s = suruklenen, hedef = bakilan;
  if (s.kaynak === 'istek') istegiTasi(s.id, hedef, onceId);
  else if (s.id !== onceId) muzikDegis((S) => {
    const L = S.muzik.listeler.find((l) => l.id === hedef), i = L.sarkilar.findIndex((x) => x.id === s.id);
    if (i < 0) return;
    const [x] = L.sarkilar.splice(i, 1);
    const j = onceId ? L.sarkilar.findIndex((z) => z.id === onceId) : L.sarkilar.length;
    L.sarkilar.splice(j < 0 ? L.sarkilar.length : j, 0, x);
  });
  suruklenen = null; isaretTemizle();
});
$('m-sekmeler').addEventListener('dragover', (e) => {
  const b = e.target.closest('[data-liste]'); if (!suruklenen || !b || b.dataset.liste === bakilan) return;
  e.preventDefault(); isaretTemizle(); b.classList.add('surukle-ustu');
});
$('m-sekmeler').addEventListener('drop', (e) => {
  const b = e.target.closest('[data-liste]'); if (!suruklenen || !b) return;
  e.preventDefault();
  const s = suruklenen, hedef = b.dataset.liste, kaynakListe = bakilan;
  if (s.kaynak === 'istek') istegiTasi(s.id, hedef, '');
  else muzikDegis((S) => { // başka listeye kopyala
    const x = S.muzik.listeler.find((l) => l.id === kaynakListe)?.sarkilar.find((z) => z.id === s.id);
    if (x) S.muzik.listeler.find((l) => l.id === hedef).sarkilar.push({ ...x, id: yeniKimlik() });
  });
  suruklenen = null; isaretTemizle();
});

/* listeler proje klasöründeki dosyada (muzik-listeleri.json, yerel sunucu yazar) */
let kayitHazir = false, sonKayit = '', kayitZaman;
(async () => {
  try {
    const d = await (await fetch('/api/listeler', { cache: 'no-store' })).json();
    if (d?.listeler?.length && (d.zaman || 0) > (C.muzik.zaman || 0)) {
      ikisine((S) => { S.muzik.listeler = d.listeler; S.muzik.aktif = d.aktif || d.listeler[0].id; S.muzik.zaman = d.zaman; });
      tazele(); bakilan = C.muzik.aktif;
    }
  } catch { /* dosya yok ya da sunucu eski: tarayıcıdaki listelerle devam */ }
  kayitHazir = true; listeleriKaydet();
})();
function listeleriKaydet() {
  if (!kayitHazir) return;
  const j = JSON.stringify({ zaman: C.muzik.zaman, aktif: C.muzik.aktif, listeler: C.muzik.listeler });
  if (j === sonKayit) return;
  clearTimeout(kayitZaman);
  kayitZaman = setTimeout(async () => {
    try { const r = await fetch('/api/listeler', { method: 'PUT', body: j }); if (r.ok) sonKayit = j; } catch {}
  }, 800);
}

function muzikCiz() {
  $('m-oynat').textContent = C.muzik.calsin ? 'Durdur ⏸' : 'Çal ▶';
  $('m-oynat').classList.toggle('ana', !C.muzik.calsin);
  deger($('m-ses'), C.muzik.ses);
  if (!C.muzik.listeler.some((l) => l.id === bakilan)) bakilan = C.muzik.aktif;
  $('m-sekmeler').innerHTML = C.muzik.listeler.map((l) => `<button data-liste="${l.id}" class="${l.id === bakilan ? 'bakilan' : ''}">
      ${kacir(l.ad)} <small>${l.sarkilar.length}</small>${l.id === C.muzik.aktif ? '<i>ÇALIYOR</i>' : '<span data-gec title="Bu listeye geç">▶</span>'}</button>`).join('') +
    '<button id="m-yeni" title="Yeni liste">+ Yeni liste</button>';
  const L = bakilanListe(C);
  deger($('m-ad'), L.ad);
  $('m-karisik').checked = L.karisik;
  listeleriKaydet();
  if (suruklenen) return; // sürüklerken satırları baştan çizme, sürükleme kopar
  const ci = L.sarkilar.findIndex((x) => x.id === L.calanId);
  const aktif = L.id === C.muzik.aktif;
  $('m-sarkilar').innerHTML = L.sarkilar.map((r, i) => {
    const calan = aktif && i === ci;
    return `<li draggable="true" data-id="${r.id}" class="${calan ? 'calan' : i < ci ? 'calindi' : ''}">
      <span class="no"><span>${i + 1}</span></span><img src="${kacir(kapakAdresi(r))}" alt="" loading="lazy">
      <span>${kacir(r.baslik)}${r.kim ? ` · <span class="not">${kacir(r.kim)}</span>` : ''}</span>
      ${calan
        // çalan satırda da düğmeler olsun: durdur/devam, geç, dinle, çıkar
        ? `<button data-eylem="duraklat" title="${C.muzik.calsin ? 'Müziği durdur' : 'Müziği çal'}">${C.muzik.calsin ? '⏸' : '▶'}</button><button data-eylem="gec" title="Sıradakine geç">⏭</button>`
        : '<button data-eylem="cal" title="Şimdi çal">▶</button>'}<button data-eylem="dinle" title="Telefonda dinle (QR)">🎧</button><button class="tehlike" data-eylem="sil" title="${calan ? 'Listeden çıkar, sıradakine geç' : 'Çıkar'}">×</button></li>`;
  }).join('') || '<li class="not">Liste boş: yukarıya link ya da şarkı adı yaz.</li>';
  $('i-sayi').textContent = C.istekler.length ? `(${C.istekler.length})` : '';
  $('istekler').innerHTML = C.istekler.map((r) => `<li draggable="true" data-id="${r.id}">
      <img src="${kacir(kapakAdresi(r))}" alt="" loading="lazy"><span>${kacir(r.baslik)}${r.kim ? ` · <span class="not">${kacir(r.kim)}</span>` : ''}</span>
      <button data-eylem="dinle" title="Telefonda dinle (QR)">🎧 Dinle</button><button data-eylem="siradaki" title="Çalan listede çalanın arkasına koy">Sıradaki yap</button><button class="tehlike" data-eylem="sil" title="Reddet">×</button></li>`).join('') || '<li class="not">Bekleyen istek yok</li>';
}

let sonSinyal = 0;
dinle((m) => {
  if (m.tur === 'durum') { C = m.durum; ciz(); }
  if (m.tur === 'taslak') { T = m.durum; ciz(); } // başka sekmedeki panel
  if (m.tur === 'calar') {
    sonSinyal = Date.now();
    if (m.oran) salonOrani = m.oran;
    $('m-calan').textContent = m.baslik || '—';
    const l = C.muzik.listeler.find((x) => x.id === m.liste);
    $('m-mod').textContent = `${l ? `Liste: ${l.ad}` : 'Liste boş'}${m.kim ? ` · ${m.kim} istedi` : ''}${m.durum === 2 ? ' · duraklatıldı' : ''}`;
    if (m.hata) $('m-hata').textContent = m.hata;
  }
});
setInterval(() => {
  gonder({ tur: 'calar-sor' });
  const bagli = Date.now() - sonSinyal < 7000;
  $('baglanti').textContent = bagli ? '● Salon ekranı bağlı' : '○ Salon ekranı açık değil';
  $('baglanti').style.color = bagli ? 'var(--slate)' : 'var(--clay)';
}, 3000);
gonder({ tur: 'calar-sor' });

/* ---------------------------------------------------------- sayaçlar (salondaki duruma göre) */
setInterval(() => {
  const m = C.molaBitis - Date.now();
  $('mola-durum').textContent = C.sahne === 'mola' && C.molaBitis ? (m > 0 ? `Salonda molanın bitmesine ${sureYaz(m, false)}` : 'Salonda mola bitti') : '';
}, 250);

/* ---------------------------------------------------------- pencereler */
$('oniz-yenile').addEventListener('click', () => { const v = Date.now(); $('oniz-taslak').src = `ekran.html?onizleme&taslak&v=${v}`; $('oniz-canli').src = `ekran.html?onizleme&v=${v}`; });
$('panik').addEventListener('click', () => { panikDegis(); tazele(); });
$('ses-kes').addEventListener('click', () => { sesKesDegis(); tazele(); });
$('ekran-ac').addEventListener('click', () => window.open('ekran.html?v=36', 'gak-ekran'));
$('sunucu-ac').addEventListener('click', () => window.open('../deste/index.html?sunucu&tema=gece&v=14', 'gak-sunucu'));

// sunucu.js (telefondan gelenler) durumu değiştirdi
addEventListener('gak-dis-durum', tazele);
// başka sekme localStorage'ı değiştirdiyse
addEventListener('storage', (e) => { if (e.key === 'gak-sahne-v1' || e.key === 'gak-sahne-taslak') tazele(); });

/* ---------------------------------------------------------- çizim */
function deger(el, v) { if (document.activeElement !== el) el.value = v; }
function ciz() {
  $('panik').classList.toggle('acik', !!C.panik);
  $('panik').firstChild.textContent = C.panik ? 'PANİK AÇIK · kapat ' : 'PANİK ';
  document.body.classList.toggle('panik-acik', !!C.panik);
  $('ses-kes').classList.toggle('acik', !!C.sesKes);
  $('ses-kes').firstChild.textContent = C.sesKes ? 'SES KAPALI · aç ' : 'SESİ KES ';
  document.querySelectorAll('#liste [data-sahne]').forEach((b) => {
    const id = b.dataset.sahne;
    b.classList.toggle('secili', id === secili);
    b.classList.toggle('canli', id === C.sahne);
    b.classList.toggle('taslak', id === T.sahne && T.sahne !== C.sahne);
  });
  document.querySelectorAll('[data-ayar]').forEach((s) => s.classList.toggle('acik', s.dataset.ayar === secili));
  anahtarlariCiz();
  $('sarki-kutusu').checked = T.sarkiKutusu;
  konusmacilariCiz();
  genelYuvaCiz();
  takimlariCiz();
  const st = salonTakimi();
  $('t-durum').textContent = st ? `Salonda: ${st.ad || 'adsız takım'}` : 'Salonda takım yok. Aşağıdan takımı seçip yayınla.';
  document.querySelectorAll('#t-modlar [data-mod]').forEach((b) => b.classList.toggle('acik', !!st && C.takimMod === b.dataset.mod));
  deger($('kodlama-bitis'), T.kodlamaBitis);
  deger($('kodlama-saat'), T.kodlamaSaat);
  deger($('mola-dk'), T.molaDk);
  document.querySelectorAll('input[data-alan]').forEach((el) => { const [a, b] = el.dataset.alan.split('.'); deger(el, T[a]?.[b] ?? ''); });

  const degisti = ozet(T) !== ozet(C) || !!T.molaYeniden;
  $('degisiklik').textContent = C.panik
    ? (ozet(T) !== C.panikTaslak ? '● Panik açık: paniği kapatınca taslaktaki ekran salona gelir' : 'Panik açık: taslağı düzenle; dokunmazsan kaldığı yerden devam eder')
    : degisti ? '● Yayınlanmamış değişiklik var' : 'Salon taslakla aynı';
  $('degisiklik').classList.toggle('var', degisti);
  $('yayinla').classList.toggle('bekliyor', degisti);
  $('yayinla').disabled = $('geri-al').disabled = !degisti;

  muzikCiz();
}
// panel ilk açıldığında taslak yoksa canlıdan oluşur
taslakYaz(T);
ciz();
