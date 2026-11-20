-- GakCoding sahne sunucusu: telefondan şarkı isteği + canlı galeri.
-- Fotoğraflar D1'de (BLOB), kısa videolar R2'de (MEDYA bağı, gak-sahne-medya kovası) durur.

CREATE TABLE IF NOT EXISTS sarki (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  vid     TEXT,              -- YouTube kimliği (yalnız yazı gönderildiyse boş)
  baslik  TEXT NOT NULL,     -- oEmbed başlığı ya da gönderilen yazı
  kapak   TEXT,              -- kapak görseli adresi (iTunes ya da YouTube küçük resmi); eski veritabanına kod ekler
  kim     TEXT NOT NULL DEFAULT '',
  durum   TEXT NOT NULL DEFAULT 'bekliyor',  -- bekliyor | onay | ret
  ip      TEXT NOT NULL DEFAULT '',
  cihaz   TEXT NOT NULL DEFAULT '',          -- imzalı çerezdeki cihaz kimliği
  zaman   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sarki_durum ON sarki (durum, id);

CREATE TABLE IF NOT EXISTS foto (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  anahtar TEXT NOT NULL UNIQUE,  -- adreste görünen tahmin edilemez ad
  tip     TEXT NOT NULL,
  veri    BLOB NOT NULL,
  boyut   INTEGER NOT NULL,
  kim     TEXT NOT NULL DEFAULT '',
  yazi    TEXT NOT NULL DEFAULT '',  -- polaroidin altına yazılan kısa not
  durum   TEXT NOT NULL DEFAULT 'bekliyor',  -- bekliyor | onay | ret
  ip      TEXT NOT NULL DEFAULT '',
  cihaz   TEXT NOT NULL DEFAULT '',
  tur     TEXT NOT NULL DEFAULT 'foto',      -- foto | video (video R2'de video/<anahtar>, veri boş)
  izin    INTEGER NOT NULL DEFAULT 0,        -- gönderenin paylaşım izni verdiği an (ms); 0 = izin öncesi kayıt
  zaman   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS foto_durum ON foto (durum, id);

-- panelden engellenen cihazlar (c:<cihaz>)
CREATE TABLE IF NOT EXISTS yasak (
  anahtar TEXT PRIMARY KEY,
  zaman   INTEGER NOT NULL
);

-- jüri oylaması: üye başına gizli link, takım başına 1-10 puan. Takım listesi ayar tablosunda ('juri').
CREATE TABLE IF NOT EXISTS juri_uye (
  anahtar TEXT PRIMARY KEY,
  ad      TEXT NOT NULL,
  zaman   INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS juri_oy (
  uye   TEXT NOT NULL,
  takim TEXT NOT NULL,
  puan  INTEGER NOT NULL,
  zaman INTEGER NOT NULL,
  PRIMARY KEY (uye, takim)
);

-- IP başına hız sınırı
CREATE TABLE IF NOT EXISTS hiz (
  ip    TEXT NOT NULL,
  tur   TEXT NOT NULL,
  zaman INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS hiz_ip ON hiz (ip, tur, zaman);

-- tek satırlık ayarlar ve panelin yayınladığı "şimdi çalıyor"
CREATE TABLE IF NOT EXISTS ayar (
  ad    TEXT PRIMARY KEY,
  deger TEXT NOT NULL
);
