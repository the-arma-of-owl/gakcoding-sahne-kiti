#!/bin/sh
# Sahne ekranlarını başlatır: Sunu klasörünü localhost:8765'te sunar, kontrol panelini Brave'de açar.
# Ekran: localhost:8765/sahne-ekranlari/ekran.html (projeksiyona sürükle, F ile tam ekran)
cd "$(dirname "$0")" || exit 1
python3 yerel-sunucu.py 8765 &
SUNUCU=$!
sleep 1
URL=http://localhost:8765/sahne-ekranlari/kontrol.html
(command -v brave >/dev/null && brave "$URL") || (command -v brave-browser >/dev/null && brave-browser "$URL") || xdg-open "$URL"
echo "Sunucu açık (PID $SUNUCU). Kapatmak için Ctrl+C."
wait $SUNUCU
