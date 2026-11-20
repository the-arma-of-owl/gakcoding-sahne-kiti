/* Kontrol paneli ↔ jüri oylaması (sahne sunucusu). Takımları jüriye gönderir, üye linklerini verir,
   ortalamaya göre sıralamayı gösterir. Tek tek puanlar panele hiç gelmez. */
import { taslakOku, kacir } from './ortak.js?v=11';

const $ = (id) => document.getElementById(id);
let veri = null, siraAcik = false, silOnay = 0;

const baglanti = () => { try { return JSON.parse(localStorage.getItem('gak-sahne-sunucu') || '{}'); } catch { return {}; } };
const taban = () => String(baglanti().adres || '').trim().replace(/\/+$/, '');

async function api(yol, govde) {
  const r = await fetch(`${taban()}/api/yonetim/${yol}`, {
    method: govde ? 'POST' : 'GET',
    headers: { authorization: `Bearer ${baglanti().sifre || ''}`, ...(govde ? { 'content-type': 'application/json' } : {}) },
    body: govde ? JSON.stringify(govde) : undefined,
    cache: 'no-store',
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.hata || `Sunucu hatası (${r.status})`);
  return d;
}
const durum = (m, iyi) => { $('j-durum').textContent = m; $('j-durum').style.color = iyi ? 'var(--slate)' : 'var(--clay)'; };

function ciz() {
  if (!veri) return;
  const verilen = veri.uyeler.reduce((a, u) => a + u.oy, 0), beklenen = veri.uyeler.length * veri.takimlar.length;
  durum(`● ${veri.takimlar.length} takım jüride, ${verilen}/${beklenen} oy verildi · oylama ${veri.acik ? 'açık' : 'kapalı'}`, true);
  $('j-acik').checked = veri.acik;
  $('j-uyeler').innerHTML = veri.uyeler.map((u) => `<li data-k="${u.anahtar}"><span>${kacir(u.ad)} <span class="not">· ${u.oy}/${veri.takimlar.length} oy</span></span>
    <button data-eylem="kopya">Linki kopyala</button><button class="tehlike" data-eylem="sil" title="Jüriyi ve oylarını sil">×</button></li>`).join('') || '<li class="not">Henüz jüri eklenmedi</li>';
  $('j-goster').textContent = siraAcik ? 'Sıralamayı gizle' : 'Sıralamayı göster';
  $('j-sira').hidden = !siraAcik;
  let derece = 0, onceki = null;
  $('j-sira').innerHTML = veri.sira.map((s, i) => {
    if (s.ort !== onceki) { derece = i + 1; onceki = s.ort; }
    return `<li data-id="${kacir(s.id)}"><span><b>${derece}.</b> ${kacir(s.ad)} <span class="not">· ${s.oy ? s.ort.toFixed(2) : '–'} (${s.oy}/${veri.uyeler.length} oy)</span></span><button class="ana" data-eylem="sahne">Taslağa al</button></li>`;
  }).join('') || '<li class="not">Takım yok</li>';
}

async function cek() {
  if (!taban()) return;
  try { veri = await api('juri'); ciz(); } catch (e) { durum(`○ ${e.message === 'Failed to fetch' ? 'Sunucuya ulaşılamadı' : e.message}`, false); }
}
async function yap(yol, govde) { try { veri = await api(yol, govde); ciz(); } catch (e) { durum(e.message, false); } }

$('j-acik').addEventListener('change', (e) => yap('juri/ayar', { acik: e.target.checked }));
$('j-gonder').addEventListener('click', () => yap('juri/ayar', { takimlar: taslakOku().takimlar }));
$('j-ekle').addEventListener('click', async () => { const ad = $('j-ad').value.trim(); if (!ad) return; await yap('juri/uye', { ad }); $('j-ad').value = ''; });
$('j-ad').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('j-ekle').click(); });
$('j-goster').addEventListener('click', () => { siraAcik = !siraAcik; ciz(); });
$('j-uyeler').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-eylem]'); if (!b) return;
  const k = b.closest('[data-k]').dataset.k;
  if (b.dataset.eylem === 'kopya') {
    await navigator.clipboard.writeText(`${taban()}/juri#${k}`);
    b.textContent = 'Kopyalandı'; setTimeout(() => { b.textContent = 'Linki kopyala'; }, 1500);
  } else if (b.dataset.emin) yap('juri/uye-sil', { anahtar: k });
  else { b.dataset.emin = 1; b.textContent = 'Emin misin?'; setTimeout(() => { delete b.dataset.emin; b.textContent = '×'; }, 4000); }
});
$('j-sira').addEventListener('click', (e) => {
  if (e.target.closest('[data-eylem]')) dispatchEvent(new CustomEvent('gak-takim-sec', { detail: e.target.closest('[data-id]').dataset.id }));
});
$('j-sifirla').addEventListener('click', () => {
  if (Date.now() - silOnay > 4000) { silOnay = Date.now(); $('j-sifirla').textContent = 'Emin misin? Tekrar bas'; setTimeout(() => { $('j-sifirla').textContent = 'Tüm oyları sil'; }, 4000); return; }
  yap('juri/sifirla', { onay: 'OYLARI SIL' });
  $('j-sifirla').textContent = 'Tüm oyları sil';
});

// yalnız takım ekranı açıkken sorar (D1 ücretsiz katmanı)
setInterval(() => { if (document.querySelector('[data-ayar="takim"]').classList.contains('acik')) cek(); }, 6000);
cek();
