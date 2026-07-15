#!/bin/bash
# ============================================================
# ROMO NUBE SYNC v5.0 — la Air solo manda la lista de archivos
#
# Ya NO hace el cruce ni mueve nada. Google (Apps Script) hace todo:
#  - Esta Air lista los videos que hay en la nube
#  - Los manda a ROMO CONT con su link
#  - Google cruza el nombre del archivo con el nombre del video
#    y le pone el link de descarga
#
# Instalación en la MacBook Air:
#  1. Pasa este archivo por AirDrop
#  2. Córrelo:  sh ~/Downloads/nube-sync.command
#  (déjalo corriendo junto a romo-nube.sh)
# ============================================================

RAIZ="$HOME/romo-nube/RAIZ"
LINK_FILE="$HOME/Desktop/LINK_ROMO.txt"
API_URL="https://script.google.com/macros/s/AKfycbxXMj7tetNujWtLkvyaFQfRJlJfn_MduZP6uDt24lzjznjlY8w0PQ4St1kOqt5Yx6Tb/exec"
TMP="/tmp/romo-nube-payload.json"
INTERVALO=180   # 3 min

PY="$(command -v python3 || command -v python)"

echo "=================================================="
echo "  ROMO NUBE SYNC v5 — Google hace el cruce"
echo "=================================================="
echo "Carpeta nube : $RAIZ"
echo "Link actual  : $(cat "$LINK_FILE" 2>/dev/null || echo '(no encontrado aún)')"
echo ""

while true; do
  # 1) Python arma la lista de archivos (SOLO archivos, sin red — no se cuelga)
  "$PY" - "$RAIZ" "$LINK_FILE" "$TMP" <<'PYEOF'
# -*- coding: utf-8 -*-
import os, sys, json, time
try:
    from urllib.parse import quote
except ImportError:
    from urllib import quote

RAIZ, LINK_FILE, TMP = sys.argv[1], sys.argv[2], sys.argv[3]
VIDEO_EXT = ('.mp4', '.mov', '.m4v', '.avi', '.mkv', '.webm')

def log(m): print(time.strftime('[%H:%M] ') + m); sys.stdout.flush()

try:
    base = open(LINK_FILE).read().strip().rstrip('/')
    assert base.startswith('http')
except Exception:
    log('AVISO: no pude leer el link de la nube — nada que mandar.'); sys.exit(1)

# Buscar la carpeta ROMO CONT (donde vive SUBIR AQUI)
romo_cont = None
inbox = None
for dp, dirs, files in os.walk(RAIZ, followlinks=True):
    if os.path.basename(dp) == 'SUBIR AQUI':
        inbox = dp
        romo_cont = os.path.dirname(dp)
        break
if not romo_cont:
    log('AVISO: no encontré la carpeta SUBIR AQUI todavía.'); sys.exit(1)

# Listar TODOS los videos de la carpeta ROMO CONT (SUBIR AQUI y donde estén)
items = []
for dp, dirs, files in os.walk(romo_cont, followlinks=True):
    dirs[:] = [d for d in dirs if not d.startswith('.')]
    for fn in files:
        if fn.lower().endswith(VIDEO_EXT) and not fn.startswith('.'):
            rel = os.path.relpath(os.path.join(dp, fn), RAIZ)
            items.append({'n': fn, 'u': base + '/files/' + quote(rel)})

inbox_url = base + '/files/' + quote(os.path.relpath(inbox, RAIZ))
json.dump({'action': 'nube', 'inbox': inbox_url, 'items': items}, open(TMP, 'w'))
log('Archivos en la nube: %d — mandando a ROMO CONT...' % len(items))
PYEOF

  # 2) curl manda la lista a Google (curl del sistema sí funciona en Mojave)
  if [ -f "$TMP" ]; then
    R=$(curl -sL -4 --http1.1 --max-time 120 \
         -H 'Content-Type: text/plain;charset=utf-8' \
         --data-binary @"$TMP" "$API_URL")
    echo "  Google respondió: $R"
    rm -f "$TMP"
  fi
  sleep $INTERVALO
done
