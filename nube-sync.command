#!/bin/bash
# ============================================================
# ROMO NUBE SYNC v4.0 — nube ↔ ROMO CONT (simple: cruza por nombre)
#
# Qué hace (cada 5 minutos):
#  1. Mira los videos de la carpeta ROMO CONT (incluye SUBIR AQUI)
#  2. Cruza el NOMBRE del archivo con el nombre del video en la hoja
#     (por su código: ED001, RLL034, ES 137... CUALQUIER código)
#  3. Le pone el link de descarga al que coincida — NO mueve archivos
#  4. Si el link del túnel cambió, refresca los links existentes
#  5. Publica la carpeta "SUBIR AQUI" para el botón "📤 Subir"
#
# Instalación en la MacBook Air (la de la nube):
#  1. Pasa este archivo por AirDrop
#  2. Córrelo:  sh ~/Downloads/nube-sync.command
#  (déjalo corriendo junto a romo-nube.sh)
# ============================================================

RAIZ="$HOME/romo-nube/RAIZ"                # carpeta que sirve la nube
LINK_FILE="$HOME/Desktop/LINK_ROMO.txt"    # donde romo-nube.sh guarda el link actual
API_URL="https://script.google.com/macros/s/AKfycbxXMj7tetNujWtLkvyaFQfRJlJfn_MduZP6uDt24lzjznjlY8w0PQ4St1kOqt5Yx6Tb/exec"
CARPETA_BASE="ROMO CONT"                   # se crea en el primer disco de la nube
INTERVALO=300                              # segundos entre escaneos (5 min)

PY="$(command -v python3 || command -v python)"

echo "=================================================="
echo "  ROMO NUBE SYNC v2 — organiza y vincula videos"
echo "=================================================="
echo "Carpeta nube : $RAIZ"
echo "Link actual  : $(cat "$LINK_FILE" 2>/dev/null || echo '(no encontrado aún)')"
echo ""

while true; do
"$PY" - "$RAIZ" "$LINK_FILE" "$API_URL" "$CARPETA_BASE" <<'PYEOF'
# -*- coding: utf-8 -*-
# Compatible con Python 2.7 (Mojave) y Python 3
import os, re, json, sys, time, shutil, subprocess
try:
    from urllib.parse import quote
except ImportError:
    from urllib import quote

RAIZ, LINK_FILE, API_URL, CARPETA_BASE = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
VIDEO_EXT = ('.mp4', '.mov', '.m4v', '.avi', '.mkv', '.webm')

# HTTP via curl: el Python de Mojave se cuelga con SSL de Google,
# pero el curl del sistema (con --http1.1) funciona confiable.
def curl(extra, data=None):
    # -4: forzar IPv4 (Mojave pierde ~2 min por request esperando IPv6)
    cmd = ['curl', '-sL', '-4', '--http1.1', '--max-time', '180'] + extra
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE if data is not None else None,
                         stdout=subprocess.PIPE)
    out, _ = p.communicate(data)
    if p.returncode != 0:
        raise Exception('curl fallo con codigo %d' % p.returncode)
    return out

def http_get(url):
    return curl([url])

def http_post(url, body):
    return curl(['-H', 'Content-Type: text/plain;charset=utf-8', '--data-binary', '@-', url], body)
INBOX_NAME = 'SUBIR AQUI'
CONFIG_ID = 'CONFIG_NUBE'

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

# ---- ubicar SUBIR AQUI: usar la que exista en cualquier disco, o crearla ----
discos = sorted(d for d in os.listdir(RAIZ) if not d.startswith('.') and os.path.isdir(os.path.join(RAIZ, d)))
if not discos:
    log('AVISO: no hay discos en la nube.'); sys.exit(0)
inboxes = [d for d in discos if os.path.isdir(os.path.join(RAIZ, d, CARPETA_BASE, INBOX_NAME))]
if not inboxes:
    disco = discos[0]
    os.makedirs(os.path.join(RAIZ, disco, CARPETA_BASE, INBOX_NAME))
    log('Creada la carpeta de subidas: %s/%s/%s' % (disco, CARPETA_BASE, INBOX_NAME))
    inboxes = [disco]
disco = inboxes[0]
base_dir = os.path.join(RAIZ, disco, CARPETA_BASE)
inbox = os.path.join(base_dir, INBOX_NAME)
inbox_rel = '%s/%s/%s' % (disco, CARPETA_BASE, INBOX_NAME)

COD = re.compile(r'([A-Z]{2,6})\s*0*(\d{1,4})')
def codigos(texto):
    return set((p, int(n)) for p, n in COD.findall(texto.upper()))

# ---- escanear la carpeta ROMO CONT (incluye SUBIR AQUI) — sin mover nada ----
# Simple: cada archivo se queda donde está; se cruza por codigo con la hoja.
archivos = []
for dirpath, dirs, files in os.walk(base_dir, followlinks=True):
    dirs[:] = [d for d in dirs if not d.startswith('.')]
    for fn in files:
        if fn.lower().endswith(VIDEO_EXT) and not fn.startswith('.'):
            rel = os.path.relpath(os.path.join(dirpath, fn), RAIZ)
            cods = codigos(os.path.splitext(fn)[0])
            if cods:
                archivos.append((rel, cods))
log('Videos en la carpeta ROMO CONT: %d' % len(archivos))

# ---- 3. cruzar con ROMO CONT ----
log('Descargando la base de ROMO CONT...')
try:
    data = json.loads(http_get(API_URL).decode('utf-8'))
except Exception as e:
    log('ERROR conectando con ROMO CONT: %r — reintento en la proxima pasada' % e)
    sys.exit(0)
if isinstance(data, dict) and data.get('error'):
    log('ERROR de la API: ' + data['error']); sys.exit(1)
log('Base descargada: %d videos. Cruzando...' % len(data))

def hacer_link(rel):
    return base + '/files/' + quote(rel)

def post(action, video):
    try:
        body = json.dumps({'action':action,'video':video,'id':video.get('id')}).encode('utf-8')
        return json.loads(http_post(API_URL, body).decode('utf-8'))
    except Exception as e:
        return {'error': repr(e)}

cambios, nuevos, refrescados = [], 0, 0
for v in data:
    if v.get('id') == CONFIG_ID: continue
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
    if link_viejo and '/files/' not in link_viejo and not v.get('tiktok'):
        v['tiktok'] = link_viejo  # link externo (TikTok) se muda a su propia casilla
    v['link'] = link_nuevo
    cambios.append(v)
    if link_viejo: refrescados += 1
    else:
        nuevos += 1
        log('  🔗 %s -> %s' % (v.get('nombre'), match))

# ---- 3b. refrescar links viejos de la nube si cambio el tunel (sin tocar disco) ----
ya = set(v['id'] for v in cambios)
for v in data:
    if v.get('id') == CONFIG_ID or v['id'] in ya: continue
    link = v.get('link','')
    if '/files/' in link and not link.startswith(base + '/'):
        v['link'] = base + '/files/' + link.split('/files/', 1)[1]
        cambios.append(v)
        refrescados += 1

# guardar en lotes de 50 (una sola conexion por lote)
if cambios:
    log('Guardando %d links en lotes de 50...' % len(cambios))
i = 0
while i < len(cambios):
    lote = cambios[i:i+50]
    try:
        body = json.dumps({'action':'bulk','videos':lote}).encode('utf-8')
        r = json.loads(http_post(API_URL, body).decode('utf-8'))
    except Exception as e:
        r = {'error': repr(e)}
    if isinstance(r, dict) and r.get('error') and 'desconocida' in r.get('error',''):
        # Code.gs viejo sin accion bulk: guardar uno por uno
        log('  (Code.gs sin modo lote: guardando de a uno)')
        for v in lote:
            rr = post('update', v)
            if rr.get('error'): log('  ERROR guardando %s: %s' % (v.get('nombre'), rr['error']))
    elif isinstance(r, dict) and r.get('error'):
        log('  ERROR en lote: %s' % r['error'])
    else:
        log('  ✓ lote de %d guardado' % len(lote))
    i += 50

# ---- 4. publicar el link de SUBIR AQUI para el boton de la pagina ----
inbox_link = base + '/files/' + quote(inbox_rel)
cfg = None
for v in data:
    if v.get('id') == CONFIG_ID: cfg = v; break
if cfg is None:
    r = post('insert', {'id':CONFIG_ID,'tanda':'','fecha':'','categoria':'CONFIG','nombre':'CONFIG NUBE',
                        'estado':'','creador':'','link':inbox_link,'notas':'carpeta de subidas','vistas':'','descripcion':''})
    if not r.get('error'): log('Config de subidas publicada en ROMO CONT')
elif cfg.get('link') != inbox_link:
    cfg['link'] = inbox_link
    post('update', cfg)
    log('Link de SUBIR AQUI actualizado (cambio de tunel)')

if refrescados: log('Links refrescados por cambio de tunel: %d' % refrescados)
log('Listo. Nuevos: %d, refrescados: %d' % (nuevos, refrescados))
PYEOF
sleep $INTERVALO
done
