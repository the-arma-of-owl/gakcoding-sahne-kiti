/* Sunucu görünümü ↔ sahne ekranları köprüsü.
   ?sunucu açıkken Shift+1…8 salondaki ekranı değiştirir (kontrol panelindeki 1–8 ile aynı).
   Düz rakamlar destede slayt atlamak için kullanılıyor, o yüzden Shift.
   sahne-ekranlari/ klasörü yoksa bu dosya sessizce hiçbir şey yapmaz; deste etkilenmez. */
import { SAHNELER, oku, ikisine, dinle, panikDegis, PANIK_TUSLARI } from '../../sahne-ekranlari/ortak.js?v=11';

/* Panik (B ya da nokta, tıklayıcının siyah ekran düğmesi): sunucu görünümünde ve salondaki destede
   destenin kendi karartması yerine salonun panik ekranını açar/kapatır. Önizlemelerde çalışmaz. */
const ara = new URLSearchParams(location.search);
if (!ara.has('onizleme') && !ara.has('izle') && (ara.has('sunucu') || window.parent !== window)) {
  addEventListener('keydown', (e) => {
    if (!PANIK_TUSLARI.includes(e.key) || e.ctrlKey || e.metaKey || e.altKey) return;
    e.preventDefault(); e.stopImmediatePropagation();
    panikDegis();
  }, true);
}

/* Uzaktan ilerletme: kontrol panelinden ya da salon ekranına basılan tıklayıcıdan gelen
   ileri/geri komutunu yalnız salon ekranının içindeki deste uygular (sunucu görünümü
   onu zaten senkron izler; ikisi de uygulasa iki slayt atlanırdı). */
const params = new URLSearchParams(location.search);
if (window.parent !== window && !params.has('sunucu') && !params.has('onizleme') && !params.has('izle')) {
  const TUS = { ileri: 'ArrowRight', geri: 'ArrowLeft', bas: 'Home' };
  dinle((m) => {
    if (m.tur === 'deste' && TUS[m.yon]) dispatchEvent(new KeyboardEvent('keydown', { key: TUS[m.yon] }));
  });
}

if (new URLSearchParams(location.search).has('sunucu')) {
  const rozet = document.createElement('span');
  rozet.className = 'presenter-salon';
  rozet.style.cssText = 'padding:2px 10px;border-radius:999px;border:1px solid currentColor;opacity:.85;white-space:nowrap';
  const ciz = (S) => {
    const s = SAHNELER.find((x) => x.id === S.sahne);
    rozet.textContent = `Salonda: ${s ? s.ad : '—'} · ⇧1–8`;
    rozet.style.color = S.sahne === 'sunum' ? '' : '#ff9f6a'; // sunum dışındaysa göze batsın
  };
  const yerlestir = () => {
    const bar = document.querySelector('.presenter-bar');
    if (!bar) return requestAnimationFrame(yerlestir);
    bar.append(rozet); ciz(oku());
  };
  yerlestir();

  dinle((m) => { if (m.tur === 'durum') ciz(m.durum); });
  addEventListener('storage', (e) => { if (e.key === 'gak-sahne-v1') ciz(oku()); });

  addEventListener('keydown', (e) => {
    if (!e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return;
    const m = /^Digit([1-8])$/.exec(e.code);
    const s = m && SAHNELER.find((x) => x.tus === m[1]);
    if (!s) return;
    e.preventDefault(); e.stopImmediatePropagation();
    // sunucu görünümünden geçiş anında canlıya gider; paneldeki taslak da aynı sahneye geçer
    ikisine((S) => { S.sahne = s.id; if (s.id === 'konusmaci' && !S.konusmaciBasladi) S.konusmaciBasladi = Date.now(); });
    ciz(oku());
  }, true);
}
