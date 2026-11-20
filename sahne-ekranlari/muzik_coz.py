# Paneldeki "Ekle" kutusu için: link ya da şarkı adını YouTube videolarına çevirir.
# YouTube video/oynatma listesi, Spotify şarkı/oynatma listesi/albüm linki ya da düz
# "Sanatçı – Şarkı" satırı kabul edilir. API anahtarı gerekmez; sayfalar değişirse
# o satır hata olarak döner, panel gösterir.
import json, re, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor

UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'


def getir(url, sure=8):
    istek = urllib.request.Request(url, headers={'user-agent': UA, 'accept-language': 'tr-TR,tr;q=0.9', 'cookie': 'SOCS=CAI; CONSENT=YES+1'})
    with urllib.request.urlopen(istek, timeout=sure) as r:
        return r.read().decode('utf-8', 'replace')


def video_kimligi(s):
    s = s.strip()
    if re.fullmatch(r'[\w-]{11}', s):
        return s
    try:
        u = urllib.parse.urlparse(s)
    except ValueError:
        return None
    if not re.search(r'(^|\.)(youtube\.com|youtu\.be)$', u.hostname or ''):
        return None
    if u.hostname.endswith('youtu.be'):
        return u.path[1:12] or None
    v = urllib.parse.parse_qs(u.query).get('v')
    if v:
        return v[0][:11]
    m = re.search(r'/(shorts|embed|live)/([\w-]{11})', u.path)
    return m.group(2) if m else None


def video_bilgisi(vid):
    """oEmbed: başlık ve kanal; gömülemeyen ya da olmayan video için hata"""
    try:
        d = json.loads(getir('https://www.youtube.com/oembed?format=json&url=' + urllib.parse.quote(f'https://www.youtube.com/watch?v={vid}'), 5))
        return {'vid': vid, 'baslik': d.get('title', ''), 'kanal': d.get('author_name', '')}
    except urllib.error.HTTPError as e:
        if e.code in (401, 403):
            return {'hata': 'Bu video başka sitelerde çalınamıyor (sahibi kapatmış)'}
        return {'hata': 'Video bulunamadı'}
    except Exception:
        return {'vid': vid, 'baslik': '', 'kanal': ''}


def youtube_ara(sorgu):
    """arama sayfasındaki ilk sonuçlardan gömülebilen ilki"""
    try:
        html = getir('https://www.youtube.com/results?hl=tr&gl=TR&search_query=' + urllib.parse.quote(sorgu))
    except Exception:
        return None
    adaylar = list(dict.fromkeys(re.findall(r'"videoRenderer":\{"videoId":"([\w-]{11})"', html)))[:4]
    for vid in adaylar:
        b = video_bilgisi(vid)
        if 'hata' not in b and b['baslik']:
            return b
    return None


def _yt_veri(html):
    m = re.search(r'var ytInitialData = (\{.*?\});</script>', html, re.S)
    return json.loads(m.group(1)) if m else {}


def youtube_listesi(liste):
    """oynatma listesinin ilk 100 videosu"""
    veri = _yt_veri(getir(f'https://www.youtube.com/playlist?list={liste}&hl=tr'))
    sonuc = []

    def gez(o):
        if isinstance(o, dict):
            if 'playlistVideoRenderer' in o:
                r = o['playlistVideoRenderer']
                sonuc.append({'vid': r.get('videoId'), 'baslik': ''.join(x.get('text', '') for x in r.get('title', {}).get('runs', []))})
            l = o.get('lockupViewModel')
            if l and l.get('contentType') == 'LOCKUP_CONTENT_TYPE_VIDEO':
                sonuc.append({'vid': l.get('contentId'), 'baslik': l.get('metadata', {}).get('lockupMetadataViewModel', {}).get('title', {}).get('content', '')})
            for v in o.values():
                gez(v)
        elif isinstance(o, list):
            for v in o:
                gez(v)
    gez(veri)
    gorulen, temiz = set(), []
    for s in sonuc:
        if s['vid'] and s['vid'] not in gorulen:
            gorulen.add(s['vid'])
            temiz.append(s)
    ad = veri.get('metadata', {}).get('playlistMetadataRenderer', {}).get('title', '')
    return ad, temiz


def spotify(tur, kimlik):
    """embed sayfasından şarkı adları: [(sanatçı, şarkı, kapak)]"""
    html = getir(f'https://open.spotify.com/embed/{tur}/{kimlik}')
    m = re.search(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', html, re.S)
    e = json.loads(m.group(1))['props']['pageProps']['state']['data']['entity']
    if tur == 'track':
        resim = (e.get('visualIdentity') or {}).get('image') or [{}]
        return e.get('name', ''), [(', '.join(a.get('name', '') for a in e.get('artists', [])), e.get('name') or e.get('title', ''), resim[-1].get('url', ''))]
    return e.get('name', ''), [(t.get('subtitle', ''), t.get('title', ''), '') for t in e.get('trackList', [])]


def _spotify_sarki(parca):
    sanatci, ad, kapak = parca
    adi = f'{sanatci} – {ad}' if sanatci else ad
    b = youtube_ara(f'{sanatci} {ad}')
    if not b:
        return {'hata': 'YouTube\'da bulunamadı', 'girdi': adi}
    return {'vid': b['vid'], 'baslik': adi, 'kanal': b['kanal'], 'kapak': kapak, 'kaynak': 'spotify'}


def satir_coz(satir):
    """tek satır -> (açıklama, [şarkılar])"""
    satir = satir.strip()
    sp = re.search(r'open\.spotify\.com/(?:intl-\w+/)?(track|playlist|album)/(\w+)', satir)
    if sp:
        ad, parcalar = spotify(sp.group(1), sp.group(2))
        with ThreadPoolExecutor(8) as h:
            return f'Spotify: {ad}', list(h.map(_spotify_sarki, parcalar))
    liste = re.search(r'[?&]list=([\w-]+)', satir)
    vid = video_kimligi(satir)
    if liste and not vid:
        ad, videolar = youtube_listesi(liste.group(1))
        return f'YouTube listesi: {ad}', videolar
    if vid:
        b = video_bilgisi(vid)
        return 'YouTube', [b if 'hata' not in b else {**b, 'girdi': satir}]
    if satir.startswith('http'):
        return '', [{'hata': 'Tanınmayan link (YouTube ya da Spotify olmalı)', 'girdi': satir}]
    b = youtube_ara(satir)
    return 'Arama', [b if b else {'hata': 'YouTube\'da bulunamadı', 'girdi': satir}]


def coz(metin):
    satirlar = [s for s in (x.strip() for x in metin.splitlines()) if s][:300]
    with ThreadPoolExecutor(6) as h:
        sonuclar = list(h.map(lambda s: _guvenli(s), satirlar))
    sarkilar, hatalar, kaynaklar = [], [], []
    for aciklama, liste in sonuclar:
        if aciklama:
            kaynaklar.append(aciklama)
        for s in liste:
            (hatalar if 'hata' in s else sarkilar).append(s)
    return {'sarkilar': sarkilar, 'hatalar': hatalar, 'kaynaklar': kaynaklar}


def _guvenli(satir):
    try:
        return satir_coz(satir)
    except Exception as e:
        return '', [{'hata': f'Okunamadı ({type(e).__name__})', 'girdi': satir}]
