#!/usr/bin/env bash
# GakCoding sahne sunucusunu Cloudflare'e yayınlar (telefondan şarkı isteği + canlı galeri).
#
# Bu klasördeki .hesap/ ayrı bir wrangler girişi tutar: kişisel hesabının girişine
# dokunmaz. İlk çalıştırmada tarayıcı açılır, ETKİNLİK İÇİN KULLANACAĞIN Cloudflare hesabıyla gir.
# Ücretsiz katman yeter (Workers + D1); kart tanımlamak gerekmez.
#
#   ./yayinla.sh          kur / güncelle (tekrar çalıştırmak güvenli)
#   ./yayinla.sh yerel    yerelde dene: http://127.0.0.1:8787 (şifre: .dev.vars)
#
# Bittiğinde çıkan adresi ve şifreyi kontrol panelindeki "Telefondan gelenler" bölümüne yazıp Bağlan.
set -euo pipefail
cd "$(dirname "$0")"
export XDG_CONFIG_HOME="$PWD/.hesap"
unset CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID
W="npx -y wrangler@4.145.0"

if [ "${1:-}" = yerel ]; then
  [ -f .dev.vars ] || printf 'ADMIN_SIFRE=yerel-deneme-sifresi\n' > .dev.vars
  $W d1 execute gak-sahne --local --file schema.sql >/dev/null
  exec $W dev --local --port 8787 --ip 127.0.0.1
fi

$W whoami 2>/dev/null | grep -q 'You are logged in' || $W login

# 1) veritabanı (yoksa oluştur, kimliğini wrangler.jsonc'ye yaz)
if grep -q '"database_id": "00000000-0000-0000-0000-000000000000"' wrangler.jsonc; then
  ID=$($W d1 list --json | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const r=JSON.parse(s).find(x=>x.name==="gak-sahne");console.log(r?r.uuid:"")})')
  if [ -z "$ID" ]; then
    $W d1 create gak-sahne --location eeur </dev/null >/dev/null
    ID=$($W d1 list --json | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).find(x=>x.name==="gak-sahne").uuid))')
  fi
  sed -i "s/00000000-0000-0000-0000-000000000000/$ID/" wrangler.jsonc
  echo "Veritabanı: $ID"
fi
$W d1 execute gak-sahne --remote --file schema.sql -y >/dev/null
echo "Şema uygulandı."

# 2) yönetici şifresi (bir kez üretilir, .yonetici-sifresi dosyasında durur)
if [ ! -s .yonetici-sifresi ]; then
  head -c 18 /dev/urandom | base64 | tr -d '/+=' | head -c 20 > .yonetici-sifresi
  YENI=1
fi
SIFRE=$(cat .yonetici-sifresi)

# 3) yayın
$W deploy | tee .son-yayin.log
[ "${YENI:-}" = 1 ] && printf '%s' "$SIFRE" | $W secret put ADMIN_SIFRE

ADRES=$(grep -oE 'https://[a-z0-9.-]+\.workers\.dev' .son-yayin.log | head -1 || true)
echo
echo "────────────────────────────────────────"
echo " Sunucu adresi : ${ADRES:-(yukarıdaki workers.dev adresi)}"
echo " Yönetici şifre: $SIFRE"
echo " Panel → Telefondan gelenler → bu ikisini yaz → Bağlan"
echo "────────────────────────────────────────"
