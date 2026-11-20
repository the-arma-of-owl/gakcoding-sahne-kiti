"""Kontrol paneli + salon ekranı yan yana, macOS pencereli demo GIF'i.

    python3 sahne-ekranlari/yerel-sunucu.py 8799 &
    uv run --with playwright==1.48.0 --with pillow==11.0.0 python araclar/demo_kayit.py docs/demo

Kontrol panelinde ekran seçilip Yayınla'ya basılır; salon ekranı BroadcastChannel ile anında değişir.
"""
import asyncio, base64, bisect, json, shutil, subprocess, sys, time
from multiprocessing import Pool
from pathlib import Path

BASE = "http://localhost:8799"
OUT = Path(sys.argv[1]).resolve(); TMP = OUT / "_kare"
VW, VH = 1280, 760
FONT_B = "/usr/share/fonts/noto/NotoSans-Bold.ttf"; FONT_R = "/usr/share/fonts/noto/NotoSans-Regular.ttf"
CURSOR_JS = r"""(() => { if (window.__cur || location.pathname.indexOf('kontrol') < 0) return;
 const mk = () => { if (document.getElementById('__cur')) return; const c = document.createElement('div'); c.id='__cur';
  c.innerHTML='<svg width="26" height="30" viewBox="0 0 26 30"><path d="M2 2 L2 24 L8 18.5 L12.2 28 L16 26.3 L11.9 17 L20 17 Z" fill="#111" stroke="#fff" stroke-width="2" stroke-linejoin="round"/></svg>';
  c.style.cssText='position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;transform:translate(640px,420px);transition:transform .7s cubic-bezier(.45,.05,.25,1)';
  document.documentElement.appendChild(c); };
 window.__cur = { move(x,y,ms){ mk(); const c=document.getElementById('__cur'); c.style.transitionDuration=(ms/1000)+'s'; c.style.transform=`translate(${x}px,${y}px)`; },
  click(x,y){ const r=document.createElement('div'); r.style.cssText=`position:fixed;left:${x-22}px;top:${y-22}px;width:44px;height:44px;border-radius:50%;z-index:2147483646;pointer-events:none;background:rgba(232,170,80,.3);border:2px solid rgba(232,170,80,.85);transform:scale(.3);transition:transform .5s ease-out,opacity .6s ease-out`;
   document.documentElement.appendChild(r); requestAnimationFrame(()=>{r.style.transform='scale(1.3)';r.style.opacity='0'}); setTimeout(()=>r.remove(),700); } };
 if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', mk); else mk(); })();"""

DEMO = {"konusmacilar": [{"id": "k1", "ad": "Deniz Yılmaz", "unvan": "Yazılım mühendisi", "konu": "Bir günde ürün çıkarmak"}],
        "aktifKonusmaci": "k1",
        "takimlar": [{"id": "t1", "ad": "Kuzey Yıldızı", "proje": "Orcik Rotası", "derece": 1, "odul": "Birincilik", "uyeler": "Ada, Mert, Selin, Kaan"}],
        "aktifTakim": "t1", "takimMod": "kart"}


class Cap:
    def __init__(self, page, name):
        self.page, self.dir, self.times = page, TMP / name, []
        shutil.rmtree(self.dir, ignore_errors=True); self.dir.mkdir(parents=True)
    async def start(self):
        self.cdp = await self.page.context.new_cdp_session(self.page)
        self.cdp.on("Page.screencastFrame", self._f)
        await self.cdp.send("Page.startScreencast", {"format": "jpeg", "quality": 88, "maxWidth": VW, "maxHeight": VH, "everyNthFrame": 1})
    def _f(self, p):
        (self.dir / f"{len(self.times):05d}.jpg").write_bytes(base64.b64decode(p["data"])); self.times.append(time.time())
        asyncio.ensure_future(self.cdp.send("Page.screencastFrameAck", {"sessionId": p["sessionId"]}))
    async def stop(self):
        try: await self.cdp.send("Page.stopScreencast")
        except Exception: pass
        (self.dir / "t.json").write_text(json.dumps(self.times))


async def record():
    from playwright.async_api import async_playwright
    events = []
    cap_ = lambda t, s="": events.append({"t": time.time(), "text": t, "sub": s})
    async with async_playwright() as pw:
        b = await pw.chromium.launch(executable_path="/usr/bin/chromium", args=[
            "--autoplay-policy=no-user-gesture-required", "--disable-renderer-backgrounding",
            "--disable-background-timer-throttling", "--disable-backgrounding-occluded-windows", "--mute-audio"])
        ctx = await b.new_context(viewport={"width": VW, "height": VH}, locale="tr-TR", timezone_id="Europe/Istanbul")
        await ctx.add_init_script(CURSOR_JS)
        k = await ctx.new_page(); await k.goto(BASE + "/sahne-ekranlari/kontrol.html"); await k.wait_for_timeout(800)
        # sahte demo verisi (gerçek isim yok) hem canlıya hem taslağa
        await k.evaluate("""(d) => { for (const key of ['gak-sahne-v1','gak-sahne-taslak']) {
            const s = JSON.parse(localStorage.getItem(key) || '{}'); Object.assign(s, d, {sahne:'bekleme'});
            const t = new Date(Date.now() + (3*3600+25*60)*1000); s.kodlamaBitis = t.toTimeString().slice(0,5);
            localStorage.setItem(key, JSON.stringify(s)); } }""", DEMO)
        await k.reload(); await k.wait_for_timeout(800)
        e = await ctx.new_page(); await e.goto(BASE + "/sahne-ekranlari/ekran.html"); await e.wait_for_timeout(2500)
        d = await ctx.new_page(); await d.goto(BASE + "/deste/index.html"); await d.wait_for_timeout(1200)  # sunum kumandası (kayda girmez)
        await k.bring_to_front()
        ck, ce = Cap(k, "kontrol"), Cap(e, "ekran"); await ck.start(); await ce.start()
        t0 = time.time(); events.append({"t": t0, "text": "", "sub": ""})

        async def tikla(sel, ms=700):
            loc = k.locator(sel).first; bb = await loc.bounding_box()
            x, y = bb["x"] + bb["width"] / 2, bb["y"] + bb["height"] / 2
            await k.evaluate("([x,y,ms]) => window.__cur.move(x,y,ms)", [x - 3, y - 3, ms]); await k.wait_for_timeout(ms + 100)
            await k.evaluate("([x,y]) => window.__cur.click(x,y)", [x, y]); await k.wait_for_timeout(150); await loc.click()

        async def yayinla(sahne, baslik, alt, bekle=3200):
            cap_(baslik, alt)
            await tikla(f'#liste [data-sahne="{sahne}"]'); await k.wait_for_timeout(1100)
            await tikla("#yayinla", 650); await k.wait_for_timeout(bekle)

        cap_("Solda kontrol paneli, sağda salon ekranı", "Bekleme ekranı yayında")
        await k.wait_for_timeout(2600)
        await yayinla("konusmaci", "Ekranı seç, taslakta gör, Yayınla", "Konuşmacı ekranı · salon anında değişir")
        await yayinla("sunum", "Sunum ekranı", "Deste salon ekranının içinde açılır", 1800)
        cap_("Kura çarkı", "Sunum kumandası ilerletir, çark ekranda döner")
        for _ in range(3): await d.keyboard.press("ArrowRight"); await d.wait_for_timeout(900)
        await d.wait_for_timeout(900); await d.keyboard.press("Space"); await k.wait_for_timeout(6500)
        await yayinla("kodlama", "Kodlama + müzik", "Geri sayım ve çalan şarkı", 3500)
        await yayinla("takim", "Takım sahnede", "Kazanan takımın kartı", 3500)
        cap_("Panik tuşu (B)", "Salon ekranını tek tuşla karartır")
        await tikla("#panik", 650); await k.wait_for_timeout(2200); await tikla("#panik", 500); await k.wait_for_timeout(2200)
        await ck.stop(); await ce.stop()
        (TMP / "olay.json").write_text(json.dumps(events))
        await b.close()

# ───────── kurgu: iki macOS penceresi yan yana ─────────
FPS, OW, OH = 20, 1920, 1080
PW = 924; PH = int(PW * VH / VW); TB = 38; RAD = 16; GAP = 28
X1 = (OW - 2 * PW - GAP) // 2; X2 = X1 + PW + GAP; WY = 132
_G = {}

def _bg():
    from PIL import Image, ImageDraw, ImageFilter, ImageFont
    g = Image.new("L", (OW, OH)); g.putdata([min(255, int(255 * (x / OW * .6 + y / OH * .4))) for y in range(OH) for x in range(OW)])
    bg = Image.composite(Image.new("RGB", (OW, OH), (14, 20, 40)), Image.new("RGB", (OW, OH), (90, 40, 30)), g).convert("RGBA")
    gl = Image.new("RGBA", (OW, OH)); dd = ImageDraw.Draw(gl)
    dd.ellipse((-300, -300, 900, 600), fill=(220, 140, 70, 60)); dd.ellipse((1200, 600, 2300, 1500), fill=(70, 100, 200, 55))
    bg = Image.alpha_composite(bg, gl.filter(ImageFilter.GaussianBlur(160)))
    f = ImageFont.truetype(FONT_R, 17); ft = ImageFont.truetype(FONT_B, 34)
    for x, title in ((X1, "Sahne kontrol · dizüstü"), (X2, "Salon ekranı · projeksiyon")):
        sh = Image.new("RGBA", (OW, OH)); ImageDraw.Draw(sh).rounded_rectangle((x, WY - TB + 24, x + PW, WY + PH + 24), RAD, fill=(0, 0, 0, 140))
        bg = Image.alpha_composite(bg, sh.filter(ImageFilter.GaussianBlur(28)))
        w = Image.new("RGBA", (OW, OH)); d = ImageDraw.Draw(w)
        d.rounded_rectangle((x, WY - TB, x + PW, WY + PH), RAD, fill=(42, 42, 46, 255))
        for i, c in enumerate([(255, 95, 87), (254, 188, 46), (40, 200, 64)]):
            cx = x + 22 + i * 22; d.ellipse((cx - 7, WY - TB / 2 - 7, cx + 7, WY - TB / 2 + 7), fill=c)
        tw = d.textlength(title, font=f); d.text((x + (PW - tw) / 2, WY - TB / 2 - 12), title, font=f, fill=(200, 200, 205))
        bg = Image.alpha_composite(bg, w)
    d = ImageDraw.Draw(bg); t = "GakCoding sahne kiti · canlı demo"
    d.text(((OW - d.textlength(t, font=ft)) / 2, 50), t, font=ft, fill=(245, 238, 225))
    mask = Image.new("L", (PW, PH), 0); ImageDraw.Draw(mask).rounded_rectangle((0, -RAD, PW, PH), RAD, fill=255)
    return bg.convert("RGB"), mask

def _init():
    from PIL import ImageFont
    bg, mask = _bg()
    _G.update(bg=bg, mask=mask, fb=ImageFont.truetype(FONT_B, 36), fr=ImageFont.truetype(FONT_R, 26),
              tk=json.loads((TMP / "kontrol/t.json").read_text()), te=json.loads((TMP / "ekran/t.json").read_text()),
              ev=json.loads((TMP / "olay.json").read_text()))

def _kare(ad, times, s):
    from PIL import Image
    i = max(0, bisect.bisect_right(times, s) - 1)
    return Image.open(TMP / ad / f"{i:05d}.jpg").convert("RGB").resize((PW, PH), Image.LANCZOS)

def _render(i):
    from PIL import ImageDraw
    ev = _G["ev"]; s = ev[0]["t"] + i / FPS
    fr = _G["bg"].copy()
    fr.paste(_kare("kontrol", _G["tk"], s), (X1, WY), _G["mask"]); fr.paste(_kare("ekran", _G["te"], s), (X2, WY), _G["mask"])
    cur = None
    for e_ in ev:
        if e_["t"] <= s: cur = e_
    if cur and cur["text"]:
        d = ImageDraw.Draw(fr, "RGBA"); a = min(1.0, (s - cur["t"]) / 0.35)
        tw = max(d.textlength(cur["text"], font=_G["fb"]), d.textlength(cur["sub"], font=_G["fr"]))
        bw, bh = tw + 64, 118; x0 = (OW - bw) / 2; y0 = WY + PH + 60 + (1 - a) * 14
        d.rounded_rectangle((x0, y0, x0 + bw, y0 + bh), 22, fill=(16, 14, 20, int(215 * a)))
        d.text((x0 + 32, y0 + 16), cur["text"], font=_G["fb"], fill=(255, 255, 255, int(255 * a)))
        d.text((x0 + 32, y0 + 68), cur["sub"], font=_G["fr"], fill=(230, 215, 190, int(235 * a)))
    return fr.tobytes()

def render():
    tk = json.loads((TMP / "kontrol/t.json").read_text()); ev = json.loads((TMP / "olay.json").read_text())
    n = int((tk[-1] - ev[0]["t"]) * FPS)
    mp4, gif = OUT / "sahne-kiti-demo.mp4", OUT / "sahne-kiti-demo.gif"
    ff = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{OW}x{OH}", "-r", str(FPS), "-i", "-",
                           "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(mp4)], stdin=subprocess.PIPE)
    with Pool(16, initializer=_init) as pool:
        for buf in pool.imap(_render, range(n), chunksize=8): ff.stdin.write(buf)
    ff.stdin.close(); ff.wait()
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(mp4), "-vf",
                    "fps=8,scale=1100:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle",
                    str(gif)], check=True)
    print(f"{n / FPS:.1f} sn · mp4 {mp4.stat().st_size / 1e6:.1f} MB · gif {gif.stat().st_size / 1e6:.1f} MB")

if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    if "--render" not in sys.argv: asyncio.run(record())
    render()
