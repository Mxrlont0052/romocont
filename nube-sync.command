#!/bin/bash
# ============================================================
# ROMO NUBE SYNC v1.0 — cruza los videos de la nube con ROMO CONT
#
# Qué hace (cada 5 minutos):
#  1. Escanea los discos de la nube buscando videos
#  2. Saca el código del nombre del archivo (RLL034, ES 137, DM 22...)
#  3. Le pone el link de descarga al video en ROMO CONT
#  4. Si el link de la nube cambió (reiniciaste el túnel),
#     re-escribe TODOS los links para que nunca queden muertos
#
# Instalación en la MacBook Air (la de la nube):
#  1. Pasa este archivo por AirDrop
#  2. Córrelo:  sh ~/Downloads/nube-sync.command
#  (déjalo corriendo junto a romo-nube.sh)
# ============================================================

RAIZ="$HOME/romo-nube/RAIZ"                # carpeta que sirve la nube
LINK_FILE="$HOME/Desktop/LINK_ROMO.txt"    # donde romo-nube.sh guarda el link actual
API_URL="https://script.google.com/macros/s/AKfycbxXMj7tetNujWtLkvyaFQfRJlJfn_MduZP6uDt24lzjznjlY8w0PQ4St1kOqt5Yx6Tb/exec"
INTERVALO=300                              # segundos entre escaneos (5 min)

# Python del sistema (Mojave trae 2.7; si hay python3 lo usa)
PY="$(command -v python3 || command -v python)"

echo "=============================================="
echo "  ROMO NUBE SYNC — vinculando nube ↔ ROMO CONT"
echo "=============================================="
echo "Carpeta nube : $RAIZ"
echo "Link actual  : $(cat "$LINK_FILE" 2>/dev/null || echo '(no encontrado aún)')"
echo ""

while true; do
"$PY" - "$RAIZ" "$LINK_FILE" "$API_URL" <<'PYEOF'
# -*- coding: utf-8 -*-
# Compatible con Python 2.7 (Mojave) y Python 3
import os, re, json, ssl, sys, time
try:
    from urllib.request import urlopen, Request
    from urllib.parse import quote
except ImportError:
    from urllib2 import urlopen, Request
    from urllib import quote

RAIZ, LINK_FILE, API_URL = sys.argv[1], sys.argv[2], sys.argv[3]
VIDEO_EXT = ('.mp4', '.mov', '.m4v', '.avi', '.mkv', '.webm')
CTX = ssl.create_default_context()

def log(msg):
    print(time.strftime('[%H:%M] ') + msg)
    sys.stdout.flush()

# ---- link base actual de la nube ----
try:
    with open(LINK_FILE) as f:
        base = f.read().strip().rstrip('/')
    assert base.startswith('http')
except Exception:
    log('AVISO: no pude leer el link de la nube en ' + LINK_FILE + ' — nada que hacer.')
    sys.exit(0)

# ---- codigos: "RLL 034" / "RLL034" / "rll0034" -> ('RLL', 34) ----
COD = re.compile(r'([A-Z]{2,6})\s*0*(\d{1,4})')
def codigos(texto):
    return set((p, int(n)) for p, n in COD.findall(texto.upper()))

# ---- escanear archivos de video de la nube ----
archivos = []   # (ruta_relativa, set_de_codigos)
for dirpath, dirs, files in os.walk(RAIZ, followlinks=True):
    dirs[:] = [d for d in dirs if not d.startswith('.')]
    for fn in files:
        if fn.lower().endswith(VIDEO_EXT) and not fn.startswith('.'):
            rel = os.path.relpath(os.path.join(dirpath, fn), RAIZ)
            cods = codigos(os.path.splitext(fn)[0])
            if cods:
                archivos.append((rel, cods))
log('Videos con codigo en la nube: %d' % len(archivos))

# ---- bajar la base de ROMO CONT ----
data = json.loads(urlopen(API_URL, context=CTX).read().decode('utf-8'))
if isinstance(data, dict) and data.get('error'):
    log('ERROR de la API: ' + data['error']); sys.exit(1)

def hacer_link(rel):
    # /files/<ruta> abre el archivo en la nube (login del equipo) con boton de descarga
    return base + '/files/' + quote(rel)

def post(video):
    req = Request(API_URL, json.dumps({'action':'update','video':video}).encode('utf-8'),
                  {'Content-Type':'text/plain;charset=utf-8'})
    r = json.loads(urlopen(req, context=CTX).read().decode('utf-8'))
    if r.get('error'): log('  ERROR guardando %s: %s' % (video.get('nombre'), r['error']))

nuevos, refrescados = 0, 0
for v in data:
    vcods = codigos(v.get('nombre',''))
    if not vcods: continue
    match = None
    for rel, fcods in archivos:
        if vcods & fcods:
            match = rel; break
    if not match: continue
    link_nuevo = hacer_link(match)
    link_viejo = v.get('link','')
    if link_viejo == link_nuevo: continue
    es_nuestro = '/files/' in link_viejo   # solo tocamos links de la nube, no links de TikTok etc.
    if link_viejo and not es_nuestro: continue
    v['link'] = link_nuevo
    post(v)
    if link_viejo: refrescados += 1
    else:
        nuevos += 1
        log('  + %s -> %s' % (v.get('nombre'), match))

if refrescados: log('Links refrescados por cambio de tunel: %d' % refrescados)
log('Listo. Nuevos: %d, refrescados: %d' % (nuevos, refrescados))
PYEOF
sleep $INTERVALO
done
