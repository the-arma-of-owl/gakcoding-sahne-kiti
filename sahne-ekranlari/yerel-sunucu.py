#!/usr/bin/env python3
# Sunu klasörünü localhost:8765'te sunar. Önbelleği kapatır: dosya değişince
# sayfayı yenilemek yeter, tarayıcı eski JS'yi tutmaz.
# Panel için uçlar: /api/coz (link/şarkı adı -> YouTube), /api/listeler (müzik listeleri dosyası),
# /api/yukle (konuşmacı ve takım görselleri, takım videosu -> sahne-ekranlari/yuklenen/),
# /api/cerceve (takımın sitesi salon ekranına gömülebiliyor mu).
import functools, hashlib, http.server, json, os, re, sys, tempfile, urllib.parse, urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import muzik_coz

kok = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
LISTELER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'muzik-listeleri.json')
YUKLENEN = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'yuklenen')
UZANTI = {'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif', 'image/svg+xml': '.svg', 'image/avif': '.avif'}
VIDEO = {'video/mp4': '.mp4', 'video/webm': '.webm', 'video/quicktime': '.mov', 'video/x-matroska': '.mkv'}


class Isleyici(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def log_message(self, *a):
        pass

    def json_yolla(self, veri, kod=200):
        govde = json.dumps(veri, ensure_ascii=False).encode()
        self.send_response(kod)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(govde)))
        self.end_headers()
        self.wfile.write(govde)

    def govde(self):
        return self.rfile.read(int(self.headers.get('Content-Length') or 0)).decode('utf-8')

    def cerceve(self):
        adres = urllib.parse.parse_qs(urllib.parse.urlsplit(self.path).query).get('adres', [''])[0]
        if not re.match(r'https?://', adres):
            return self.json_yolla({'hata': 'Geçersiz adres'}, 400)
        try:
            istek = urllib.request.Request(adres, headers={'User-Agent': 'Mozilla/5.0 Chrome/130.0'})
            with urllib.request.urlopen(istek, timeout=3.5) as y:
                xfo = y.headers.get('X-Frame-Options')
                csp = y.headers.get('Content-Security-Policy') or ''
        except Exception as e:
            return self.json_yolla({'gomulur': None, 'neden': str(e)[:120]})
        m = re.search(r'frame-ancestors([^;]*)', csp, re.I)
        return self.json_yolla({'gomulur': not xfo and (not m or m.group(1).strip() == '*')})

    # video ileri/başa sarılabilsin: tarayıcının parça isteklerini karşılar
    def parca_yolla(self):
        yol = self.translate_path(self.path)
        m = re.fullmatch(r'bytes=(\d*)-(\d*)', self.headers.get('Range') or '')
        if not m or not os.path.isfile(yol) or not (m.group(1) or m.group(2)):
            return False
        boy = os.path.getsize(yol)
        bas = int(m.group(1)) if m.group(1) else max(0, boy - int(m.group(2)))
        son = min(int(m.group(2)), boy - 1) if m.group(1) and m.group(2) else boy - 1
        if bas > son:
            self.send_error(416)
            return True
        self.send_response(206)
        self.send_header('Content-Type', self.guess_type(yol))
        self.send_header('Accept-Ranges', 'bytes')
        self.send_header('Content-Range', f'bytes {bas}-{son}/{boy}')
        self.send_header('Content-Length', str(son - bas + 1))
        self.end_headers()
        with open(yol, 'rb') as f:
            f.seek(bas)
            kalan = son - bas + 1
            try:
                while kalan > 0:
                    parca = f.read(min(1 << 20, kalan))
                    if not parca:
                        break
                    self.wfile.write(parca)
                    kalan -= len(parca)
            except (BrokenPipeError, ConnectionResetError):
                pass
        return True

    def do_GET(self):
        if self.path.startswith('/api/cerceve'):
            return self.cerceve()
        if re.search(r'/yuklenen/|\.(mp4|webm)(\?|$)', self.path) and self.parca_yolla():
            return
        if self.path.split('?')[0] == '/api/listeler':
            try:
                with open(LISTELER, encoding='utf-8') as f:
                    return self.json_yolla(json.load(f))
            except FileNotFoundError:
                return self.json_yolla({})
        super().do_GET()

    def do_POST(self):
        if self.path == '/api/coz':
            try:
                metin = json.loads(self.govde()).get('metin', '')
            except ValueError:
                return self.json_yolla({'hata': 'Geçersiz istek'}, 400)
            return self.json_yolla(muzik_coz.coz(metin))
        if self.path.startswith('/api/yukle'):
            tur = (self.headers.get('Content-Type') or '').split(';')[0].strip()
            boy = int(self.headers.get('Content-Length') or 0)
            if tur in VIDEO:
                return self.video_al(tur, boy)
            if tur not in UZANTI:
                return self.json_yolla({'hata': 'Yalnız resim ya da video dosyası'}, 400)
            if not 0 < boy <= 25 * 1024 * 1024:
                return self.json_yolla({'hata': 'Dosya 25 MB\'tan büyük'}, 400)
            veri = self.rfile.read(boy)
            # aynı resim iki kez yüklenirse aynı dosya kullanılır
            ad = hashlib.sha1(veri).hexdigest()[:16] + UZANTI[tur]
            os.makedirs(YUKLENEN, exist_ok=True)
            with open(os.path.join(YUKLENEN, ad), 'wb') as f:
                f.write(veri)
            return self.json_yolla({'yol': 'yuklenen/' + ad})
        self.send_error(404)

    # video belleğe alınmaz: geçici dosyaya akar, sonra içeriğinin özetiyle adlandırılır
    def video_al(self, tur, boy):
        if not 0 < boy <= 3 * 1024 * 1024 * 1024:
            return self.json_yolla({'hata': 'Video 3 GB\'tan büyük'}, 400)
        os.makedirs(YUKLENEN, exist_ok=True)
        ozet = hashlib.sha1()
        with tempfile.NamedTemporaryFile(dir=YUKLENEN, delete=False) as g:
            kalan = boy
            while kalan > 0:
                parca = self.rfile.read(min(1 << 20, kalan))
                if not parca:
                    break
                ozet.update(parca)
                g.write(parca)
                kalan -= len(parca)
        if kalan:
            os.unlink(g.name)
            return self.json_yolla({'hata': 'Yükleme yarıda kesildi'}, 400)
        ad = ozet.hexdigest()[:16] + VIDEO[tur]
        os.chmod(g.name, 0o644)
        os.replace(g.name, os.path.join(YUKLENEN, ad))
        return self.json_yolla({'yol': 'yuklenen/' + ad})

    def do_PUT(self):
        if self.path == '/api/listeler':
            try:
                veri = json.loads(self.govde())
            except ValueError:
                return self.json_yolla({'hata': 'Geçersiz istek'}, 400)
            gecici = LISTELER + '.yeni'
            with open(gecici, 'w', encoding='utf-8') as f:
                json.dump(veri, f, ensure_ascii=False, indent=1)
            os.replace(gecici, LISTELER)
            return self.json_yolla({'tamam': True})
        self.send_error(404)


http.server.ThreadingHTTPServer(('127.0.0.1', port), functools.partial(Isleyici, directory=kok)).serve_forever()
