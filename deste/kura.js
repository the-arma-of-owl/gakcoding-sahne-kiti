/* Kura çarkı: 1-15 arası sayılar, çıkan sayı çarktan düşer. Numaralar kura kartlarıyla aynıdır.
   Boşluk, sağ ok, kumanda ya da tıklama çevirir. Takımlar sırayla gider. R iki kez ya da düğme: sıfırla. Yenilense de çekilenler kalır. */
(() => {
  const KONU = ['Orcik', 'Pestil', 'Çedene Kahvesi', 'Ağın Leblebisi', 'Baskil Kayısısı',
    'Öküzgözü Üzümü', 'Elazığ Vişnesi', 'Keban Alabalığı', 'Harput Köftesi', 'Vişne Mermeri',
    'Kilim', 'Harput Bakırcılığı', 'Harput Kalesi', 'Eğri Minare', 'Badem Şekeri'];
  const TAKIM = ['Kuzey Yıldızı', 'Mavi Kod', 'Bit Avcıları', 'Kod Kervanı', 'Gece Kuşları', 'Piksel Ustaları', 'Sıfır Bir', 'Turbo Kaplumbağa',
    'Kahve ve Kod', 'Döngü', 'Yeni Sürüm', 'Bulut Dokuz', 'Hata Avcıları', 'Kare Kod', 'Son Commit'];
  const kok = document.querySelector('#kura');
  if (!kok) return;
  const ANAHTAR = 'gakcoding-kura-4', SVG = 'http://www.w3.org/2000/svg', TUM = KONU.map((_, i) => i + 1);
  const RENK = ['#c8553d', '#b98a3e', '#4f6d7a', '#7a4a33'];
  const yukle = () => { try { const d = JSON.parse(localStorage.getItem(ANAHTAR)); return Array.isArray(d) ? d.filter((n) => TUM.includes(n)) : []; } catch { return []; } };
  const yaz = (d) => { try { localStorage.setItem(ANAHTAR, JSON.stringify(d)); } catch {} };
  const kanal = 'BroadcastChannel' in window ? new BroadcastChannel('gakcoding-kura-4') : null;
  let cekilen = yukle(), donuyor = false, sifirSure = 0;

  kok.innerHTML = '<div class="kura-cark"><i class="kura-ok"></i><svg viewBox="-500 -500 1000 1000"><g class="kura-g"></g></svg></div>' +
    '<div class="kura-yan"><div class="kura-sonuc"></div><div class="kura-liste"></div><div class="kura-gecmis"></div>' +
    '<div class="kura-dugme"><button data-is="geri">Son kurayı geri al</button><button data-is="sifir">Çarkı sıfırla</button></div></div>';
  const g = kok.querySelector('.kura-g'), sonuc = kok.querySelector('.kura-sonuc'), liste = kok.querySelector('.kura-liste'), gecmis = kok.querySelector('.kura-gecmis');
  const nokta = (a, r) => [r * Math.sin(a * Math.PI / 180), -r * Math.cos(a * Math.PI / 180)];

  function cark() {
    const kalan = TUM.filter((n) => !cekilen.includes(n));
    g.style.transform = ''; g.textContent = '';
    const b = 360 / (kalan.length || 1);
    kalan.forEach((n, i) => {
      const [x0, y0] = nokta(i * b, 490), [x1, y1] = nokta((i + 1) * b, 490);
      const y = document.createElementNS(SVG, kalan.length === 1 ? 'circle' : 'path');
      if (kalan.length === 1) y.setAttribute('r', 490);
      else y.setAttribute('d', `M0 0L${x0} ${y0}A490 490 0 ${b > 180 ? 1 : 0} 1 ${x1} ${y1}Z`);
      y.setAttribute('fill', RENK[i % (kalan.length % 4 === 1 ? 3 : 4)]);
      y.setAttribute('stroke', '#0c0a09'); y.setAttribute('stroke-width', 4);
      const t = document.createElementNS(SVG, 'text');
      const o = i * b + b / 2, [tx, ty] = nokta(o, 400);
      if (kalan.length > 1) t.setAttribute('transform', `translate(${tx} ${ty}) rotate(${o})`);
      t.textContent = n;
      g.append(y, t);
    });
    return kalan;
  }

  function goster(son) {
    liste.innerHTML = KONU.map((m, i) => (cekilen.includes(i + 1) ? '' : `<div><b>${i + 1}</b><span>${m}</span></div>`)).join('');
    gecmis.innerHTML = cekilen.map((n, i) => `<div><b>${TAKIM[i]}</b><span>${KONU[n - 1]}</span></div>`).join('');
    const sira = TAKIM[cekilen.length];
    const ek = sira ? `<small class="kura-sira">Sıradaki: ${sira}</small>` : '';
    sonuc.innerHTML = son ? `<b>${son}</b><div><small>${TAKIM[cekilen.indexOf(son)]}</small><h3>${KONU[son - 1]}</h3>${ek}</div>`
      : `<div><small>İlk takım</small><h3>${TAKIM[0]}</h3></div>`;
  }

  async function cevir(n) {
    donuyor = true;
    const kalan = cark(), b = 360 / kalan.length, i = kalan.indexOf(n);
    const pay = (crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32 - 0.5) * b * 0.7;
    const son = kalan.length === 1 ? 360 * 7 : 360 * 7 - (i * b + b / 2 + pay);
    sonuc.innerHTML = `<div><small>Çark dönüyor</small><h3>${TAKIM[Math.min(cekilen.length, TUM.length - 1)]}</h3></div>`;
    const a = g.animate([{ transform: 'rotate(0deg)' }, { transform: `rotate(${son}deg)` }],
      { duration: window.KURA_SURE || 7000, easing: 'cubic-bezier(.12,.72,.1,1)', fill: 'forwards' });
    await a.finished;
    g.style.transform = `rotate(${son}deg)`; a.cancel();
    if (!cekilen.includes(n)) cekilen.push(n);
    goster(n);
    donuyor = false;
  }

  function baslat() {
    if (donuyor) return;
    cekilen = yukle();
    const kalan = TUM.filter((n) => !cekilen.includes(n));
    if (!kalan.length) return;
    const n = kalan[Math.floor(crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32 * kalan.length)];
    yaz([...cekilen, n]);
    kanal?.postMessage({ tur: 'cevir', n });
    cevir(n);
  }

  function tazele() {
    cekilen = yukle(); cark(); goster(cekilen[cekilen.length - 1] || 0);
  }

  function degistir(yeni) {
    if (donuyor) return;
    yaz(yeni); tazele();
    kanal?.postMessage({ tur: 'tazele' });
  }
  const sifirla = () => degistir([]);

  if (kanal) kanal.onmessage = ({ data }) => {
    if (data.tur === 'cevir') cevir(data.n);
    if (data.tur === 'tazele') tazele();
  };

  /* yanlışlıkla basılmasın: düğme iki kez ister */
  let onay = null;
  function dugme(b) {
    if (donuyor || !cekilen.length) return;
    if (onay !== b) {
      if (onay) onay.textContent = onay.dataset.ad;
      onay = b; b.dataset.ad = b.textContent; b.textContent = 'Emin misin? Tekrar bas';
      setTimeout(() => { if (onay === b) { b.textContent = b.dataset.ad; onay = null; } }, 3000);
      return;
    }
    b.textContent = b.dataset.ad; onay = null;
    if (b.dataset.is === 'sifir') sifirla(); else degistir(cekilen.slice(0, -1));
  }

  const ekranda = () => !!document.querySelector('.slide.is-current #kura');
  /* salon ekranındaki deste iframe içinde çalışır; önizlemeler ise yalnız izler */
  const ara = new URLSearchParams(location.search);
  if (!ara.has('izle') && !ara.has('onizleme')) {
    addEventListener('keydown', (e) => {
      if (!ekranda() || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'r' || e.key === 'R') {
        if (Date.now() - sifirSure < 2500) sifirla();
        sifirSure = Date.now();
        return;
      }
      if (![' ', 'ArrowRight', 'ArrowDown', 'PageDown', 'AudioVolumeUp'].includes(e.key)) return;
      if (!donuyor && cekilen.length >= TUM.length) return;
      e.preventDefault(); e.stopImmediatePropagation();
      baslat();
    }, true);
    kok.addEventListener('click', (e) => {
      e.stopPropagation();
      const b = e.target.closest('button');
      if (b) dugme(b); else baslat();
    });
  }

  cark();
  goster(cekilen[cekilen.length - 1] || 0);
})();
