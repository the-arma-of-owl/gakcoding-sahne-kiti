/* Sahne ekranları: ortak durum.
   Kontrol paneli durumu değiştirir, ekran uygular. İkisi aynı tarayıcıda
   (aynı adres, aynı profil) açık olmalı: BroadcastChannel + localStorage ile konuşurlar.
   Ekran çalan şarkıyı 'durum' mesajıyla geri bildirir. */

// YouTube 127.0.0.1'den gömülen videoları reddediyor (hata 150), localhost'ta çalıyor
if (location.hostname === '127.0.0.1') location.replace(location.href.replace('//127.0.0.1', '//localhost'));

const ANAHTAR = 'gak-sahne-v1';      // canlı: salon ekranı bunu gösterir
const TASLAK = 'gak-sahne-taslak';   // taslak: panelde düzenlenir, "Yayınla" ile canlıya geçer
const kanal = new BroadcastChannel('gak-sahne');

export const ETKINLIK = {
  ad: 'GakCoding',
  tarih: '1 Kasım 2026',
  yer: 'Kongre Merkezi',
};

export const SAHNELER = [
  { id: 'bekleme', ad: 'Bekleme', tus: '1' },
  { id: 'konusmaci', ad: 'Konuşmacı', tus: '2' },
  { id: 'sunum', ad: 'Sunum', tus: '3' },
  { id: 'kodlama', ad: 'Kodlama + müzik', tus: '4' },
  { id: 'galeri', ad: 'Galeri', tus: '5' },
  { id: 'mola', ad: 'Mola', tus: '6' },
  { id: 'duyuru', ad: 'Duyuru', tus: '7' },
  { id: 'takim', ad: 'Takım sahnede', tus: '8' },
];

const VARSAYILAN = {
  sahne: 'bekleme',
  konusmacilar: [
    { id: 'k1', ad: 'Konuşmacı Adı', unvan: 'Unvan / kurum', konu: '' },
  ],
  aktifKonusmaci: 'k1',
  // kazanan takımlar: { id, ad, proje, derece, odul, uyeler, site, yt, video (dosya yolu), foto, fotoKirp }
  takimlar: [],
  aktifTakim: '',
  takimMod: 'kart', // kart | site | video | yt (salonda anında değişir)
  konusmaciBasladi: 0,
  konusmaciSure: 5,
  konusmaciSureEkranda: false,
  bekleme: { baslik: 'Birazdan başlıyoruz', alt: 'Yerinizi alın, telefonunuzdan şarkı isteyebilirsiniz.' },
  duyuru: { baslik: 'Duyuru', alt: '' },
  kodlamaBitis: '16:00',
  kodlamaSaat: 6, // kalan süre barının %100'ü: bitiş saati uzatılsa da bar bu süreye göre dolar
  molaBitis: 0,
  molaDk: 15,
  sarkiKutusu: true, // temel: QR ve "şimdi çalıyor" kutuları tüm ekranlarda
  // ekran bazlı göster/gizle; her ekranda yalnız o ekranda bulunan öğeler (sarkiKutusu kapalıysa QR/çalar hiçbir yerde görünmez)
  ekran: {
    bekleme: { qr: true, calar: true, logolar: true, arkaVideo: true, kilim: true, serit: true, muzikKis: false },
    konusmaci: { kilim: true, serit: true, muzikKis: true },
    sunum: { muzikKis: true },
    kodlama: { qr: true, calar: true, video: true, sira: true, arkaVideo: true, kilim: true, serit: true, muzikKis: false },
    galeri: { qr: true, etiket: true, kilim: true, serit: true, muzikKis: false },
    mola: { calar: true, arkaVideo: true, kilim: true, serit: true, muzikKis: false },
    duyuru: { arkaVideo: true, kilim: true, serit: true, muzikKis: false },
    takim: { kilim: true, serit: true, muzikKis: true },
  },
  /* müzik: hazır listeler; her liste kendi sırasını ve çalan şarkısını (calanId) tutar.
     calanId'den öncekiler çalındı sayılır, sonrakiler sıradadır. */
  muzik: {
    ses: 70, calsin: true, aktif: 'bekleme', zaman: 0,
    listeler: [
      { id: 'bekleme', ad: 'Bekleme', karisik: true, calanId: '', sarkilar: [] },
      { id: 'kodlama', ad: 'Kodlama', karisik: true, calanId: '', sarkilar: [] },
      { id: 'odul', ad: 'Ödül', karisik: false, calanId: '', sarkilar: [] },
    ],
  },
  istekler: [], // telefondan onaylanıp gelen, henüz listeye konmamış istekler
  qr: { sarki: '', foto: '' },
  galeri: { api: '' },
};

function birlestir(d) {
  const V = VARSAYILAN, ekran = {};
  for (const k of Object.keys(V.ekran)) ekran[k] = { ...V.ekran[k], ...d.ekran?.[k] };
  // eski kayıtlardan geçiş: sessizSahneler -> ekran.*.muzikKis, beklemeKartlari -> sarkiKutusu
  if (!d.ekran && d.muzik?.sessizSahneler) for (const k of Object.keys(ekran)) ekran[k].muzikKis = d.muzik.sessizSahneler.includes(k);
  const sonuc = { ...structuredClone(V), ...d, ekran, muzik: { ...V.muzik, ...d.muzik }, qr: { ...V.qr, ...d.qr }, galeri: { ...V.galeri, ...d.galeri } };
  if (d.sarkiKutusu === undefined && d.beklemeKartlari === false) sonuc.sarkiKutusu = false;
  delete sonuc.beklemeKartlari; delete sonuc.muzik.sessizSahneler; delete sonuc.muzik.liste; delete sonuc.muzik.karisik;
  return sonuc;
}
const ham = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } };

export function oku() { const d = ham(ANAHTAR); return d ? birlestir(d) : structuredClone(VARSAYILAN); }
export function yaz(durum) {
  try { localStorage.setItem(ANAHTAR, JSON.stringify(durum)); } catch {}
  kanal.postMessage({ tur: 'durum', durum });
}

/* taslak yoksa canlının kopyasıyla başlar */
export function taslakOku() { const d = ham(TASLAK); return d ? birlestir(d) : oku(); }
export function taslakYaz(durum) {
  try { localStorage.setItem(TASLAK, JSON.stringify(durum)); } catch {}
  kanal.postMessage({ tur: 'taslak', durum });
}
/* canlı işlemler (istek sırası, müzik, sunucu adresleri) ikisine birden yazılır */
export function ikisine(f) {
  const c = oku(); f(c); yaz(c);
  const t = taslakOku(); f(t); taslakYaz(t);
}

// taslak ile canlıyı karşılaştırırken canlıda kendiliğinden değişen alanlar sayılmaz
export const ozet = (d) => JSON.stringify({ ...d, panik: 0, sesKes: 0, panikTaslak: 0, istekler: 0, muzik: 0, konusmaciBasladi: 0, molaBitis: 0, molaYeniden: 0 });

/* Yayınla: taslağı canlıya çevirir. Anında işleyen alanlar (panik, müzik, istekler, sayaç başlangıçları) canlıdan alınır. */
export function yayinHazirla(C, T) {
  const y = structuredClone(T);
  y.panik = C.panik; y.sesKes = C.sesKes;
  y.panikTaslak = C.panik ? ozet(T) : undefined; // panikte yayınlanan taslak, panik kapanınca yeniden sayılmasın
  y.istekler = C.istekler;
  y.muzik = C.muzik; // müzik anında işler, taslaktaki kopyası eski olabilir
  y.konusmaciBasladi = C.konusmaciBasladi;
  if (y.sahne === 'konusmaci' && (C.sahne !== 'konusmaci' || C.aktifKonusmaci !== y.aktifKonusmaci)) y.konusmaciBasladi = Date.now();
  y.molaBitis = C.molaBitis;
  if (y.sahne === 'mola' && (C.sahne !== 'mola' || C.molaDk !== y.molaDk || y.molaYeniden)) y.molaBitis = Date.now() + y.molaDk * 60000;
  delete y.molaYeniden;
  return y;
}

/* panik: ses ve ekran anında kesilir, salonda etkinlik posteri kalır. Taslağı beklemez.
   Tuş: B ya da nokta (sunum tıklayıcılarının "siyah ekran" düğmesi bunları gönderir).
   Panik sürerken taslak düzenlenebilir: panik kapanınca taslak paniğin başındakinden farklıysa
   salona o gelir (ilk açılışta ne görüneceği seçilir); taslağa dokunulmadıysa kaldığı yerden devam eder. */
export const PANIK_TUSLARI = ['b', 'B', '.'];
/* acil ses kıs: yalnız müzik anında susar, ekran olduğu gibi kalır; tekrar basınca ses yavaşça geri gelir */
export const SES_TUSLARI = ['m', 'M'];
export function sesKesDegis() {
  const yeni = !oku().sesKes;
  ikisine((S) => { S.sesKes = yeni; });
  return yeni;
}

export function panikDegis(acik) {
  const C = oku(), yeni = acik ?? !C.panik;
  if (yeni === !!C.panik) return yeni;
  if (yeni) {
    const iz = ozet(taslakOku());
    ikisine((S) => { S.panik = true; S.panikTaslak = iz; });
    return yeni;
  }
  const T = taslakOku();
  if (C.panikTaslak && ozet(T) !== C.panikTaslak) {
    const y = yayinHazirla(C, T);
    y.panik = false; delete y.panikTaslak;
    yaz(y); taslakYaz(structuredClone(y));
  } else ikisine((S) => { S.panik = false; delete S.panikTaslak; });
  return yeni;
}

export function gonder(mesaj) { kanal.postMessage(mesaj); }
export function dinle(f) { kanal.addEventListener('message', (e) => f(e.data)); }

/* youtube.com/watch?v=, youtu.be/, music.youtube.com, shorts ya da çıplak kimlik */
export function videoKimligi(s) {
  s = String(s || '').trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  try {
    const u = new URL(s);
    if (u.hostname.endsWith('youtu.be')) return u.pathname.slice(1, 12) || null;
    if (u.searchParams.get('v')) return u.searchParams.get('v').slice(0, 11);
    const m = u.pathname.match(/\/(shorts|embed|live)\/([\w-]{11})/);
    if (m) return m[2];
  } catch {}
  return null;
}

export function listeKimligi(s) {
  s = String(s || '').trim();
  if (/^(PL|OL|RD|UU|FL)[\w-]{10,}$/.test(s)) return s;
  try { return new URL(s).searchParams.get('list'); } catch {}
  return null;
}

/* "17:00" -> bugünün o saati (ms) */
export function saatMs(hhmm) {
  const [h, m] = String(hhmm || '').split(':').map(Number);
  if (Number.isNaN(h)) return 0;
  const d = new Date(); d.setHours(h, m || 0, 0, 0);
  return d.getTime();
}

export function sureYaz(ms, saatli = true) {
  const t = Math.max(0, Math.round(ms / 1000));
  const s = Math.floor(t / 3600), d = Math.floor((t % 3600) / 60), sn = t % 60;
  const p = (n) => String(n).padStart(2, '0');
  return saatli || s ? `${p(s)}:${p(d)}:${p(sn)}` : `${p(d)}:${p(sn)}`;
}

/* Kırpma: panel penceresi ve salon aynı hesabı kullanır, yer CSS'e bırakılmaz.
   kirp = { z: yakınlık, x, y: kutu genişliği/yüksekliğinin yüzdesi kadar kayma, v: 2 }
   foto kutuyu doldurur (taşan kısmı kaydırılır), logo kutuya sığar, arka görsel sığar ve sağa yaslanır. */
function resimDikdortgen(nw, nh, kw, kh, kirp, tur) {
  const s = tur === 'foto' ? Math.max(kw / nw, kh / nh) : Math.min(kw / nw, kh / nh);
  const w = nw * s, h = nh * s;
  const l = tur === 'arka' ? kw - w : (kw - w) / 2, t = (kh - h) / 2;
  const { z = 1, x = 0, y = 0 } = kirp || {};
  // yakınlaştırma kutunun ortasına göre, kayma kutuya göre
  return { sol: kw / 2 + (l - kw / 2) * z + x * kw / 100, ust: kh / 2 + (t - kh / 2) * z + y * kh / 100, en: w * z, boy: h * z };
}
/* eski kayıtlarda fotoğrafın kayması resmin kendi boyutunun yüzdesiydi */
export function kirpNormal(kirp, img, tur) {
  const k = { z: 1, x: 0, y: 0, ...kirp };
  if (k.v === 2 || tur !== 'foto' || !img.naturalWidth || !img.parentElement.clientWidth) return k;
  const b = img.parentElement, r = resimDikdortgen(img.naturalWidth, img.naturalHeight, b.clientWidth, b.clientHeight, null, tur);
  return { ...k, x: k.x * r.en / b.clientWidth, y: k.y * r.boy / b.clientHeight, v: 2 };
}
const YERLER = new WeakMap();
function yerlestir(img) {
  const d = YERLER.get(img), b = img.parentElement;
  if (!d || !img.naturalWidth || !b.clientWidth || !b.clientHeight) return;
  const r = resimDikdortgen(img.naturalWidth, img.naturalHeight, b.clientWidth, b.clientHeight, kirpNormal(d.kirp, img, d.tur), d.tur);
  Object.assign(img.style, { left: r.sol + 'px', top: r.ust + 'px', width: r.en + 'px', height: r.boy + 'px', right: 'auto', bottom: 'auto', maxWidth: 'none', transform: '' });
}
export function resimYerlestir(img, kirp, tur) {
  if (!img.dataset.izli) {
    img.dataset.izli = 1;
    img.addEventListener('load', () => yerlestir(img));
    new ResizeObserver(() => yerlestir(img)).observe(img.parentElement);
  }
  YERLER.set(img, { kirp, tur });
  yerlestir(img);
}
export function resimTemizle(img) {
  YERLER.delete(img);
  for (const k of ['left', 'top', 'width', 'height', 'right', 'bottom', 'maxWidth', 'transform']) img.style[k] = '';
}

export const kacir = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/* istek kapağı: telefondan gelen iTunes kapağı, yoksa YouTube küçük resmi */
export const kapakAdresi = (r) => r?.kapak || (r?.vid ? `https://i.ytimg.com/vi/${r.vid}/hqdefault.jpg` : '');

/* müzik listesi yardımcıları */
export const aktifListe = (S) => S.muzik.listeler.find((l) => l.id === S.muzik.aktif) || null;
export const yeniKimlik = () => 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
export function siradakiler(S, n) {
  const L = aktifListe(S); if (!L) return [];
  const i = L.sarkilar.findIndex((x) => x.id === L.calanId);
  return L.sarkilar.slice(i + 1, i + 1 + n);
}
export function karistir(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
