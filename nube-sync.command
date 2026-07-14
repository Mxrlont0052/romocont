#!/bin/bash
# ============================================================
# ROMO NUBE SYNC v2.0 — nube ↔ ROMO CONT
#
# Qué hace (cada 5 minutos):
#  1. ORGANIZA: lo que el equipo suba a la carpeta "SUBIR AQUI"
#     lo mueve solo a su carpeta por categoría según el código:
#     RLL034 → RELLENO, ES 137 → ESTUDIANTES, DM22 → DEMOSTRATIVAS...
#  2. VINCULA: escanea toda la nube y le pone el link de descarga
#     a cada video de ROMO CONT que encuentre por su código
#  3. Si el link del túnel cambió, re-escribe TODOS los links
#  4. Publica la carpeta "SUBIR AQUI" en ROMO CONT para que el
#     botón "📤 Subir a la nube" siempre apunte al link vigente
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
    cmd = ['curl', '-sL', '--http1.1', '--max-time', '180'] + extra
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

# codigo -> carpeta de categoria
CATEGORIAS = {
    'RLL': 'RELLENO', 'RL': 'RELLENO',
    'ES': 'ESTUDIANTES',
    'DM': 'DEMOSTRATIVAS',
    'RDJ': 'ROMO DJS',
    'PDR': 'PEDRO ROMO',
    'MDT': 'MINISTERIO DE TRABAJO',
}
def carpeta_de(prefijo, nombre_archivo):
    if prefijo in CATEGORIAS: return CATEGORIAS[prefijo]
    if prefijo.startswith('RR'): return 'ROMO ROOM'
    if '360' in nombre_archivo.upper(): return 'VIDEOS 360'
    return 'OTROS'

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

# ---- 1. ORGANIZAR: mover lo de SUBIR AQUI a su carpeta por categoria ----
for fn in sorted(os.listdir(inbox)):
    src = os.path.join(inbox, fn)
    if fn.startswith('.') or not os.path.isfile(src): continue
    if not fn.lower().endswith(VIDEO_EXT): continue
    cods = codigos(os.path.splitext(fn)[0])
    if not cods:
        log('  ? %s no tiene codigo — lo dejo en SUBIR AQUI' % fn); continue
    # esperar a que termine de subirse (tamano estable 5s)
    try:
        s1 = os.path.getsize(src); time.sleep(5); s2 = os.path.getsize(src)
        if s1 != s2: log('  … %s aun subiendo, lo tomo en la proxima' % fn); continue
    except OSError: continue
    prefijo = sorted(cods)[0][0]
    destino_dir = os.path.join(base_dir, carpeta_de(prefijo, fn))
    if not os.path.isdir(destino_dir): os.makedirs(destino_dir)
    destino = os.path.join(destino_dir, fn)
    if os.path.exists(destino):
        destino = os.path.join(destino_dir, os.path.splitext(fn)[0] + '_2' + os.path.splitext(fn)[1])
    shutil.move(src, destino)
    log('  📁 %s -> %s/' % (fn, carpeta_de(prefijo, fn)))

# ---- 2. escanear todos los videos de la nube ----
archivos = []
for dirpath, dirs, files in os.walk(RAIZ, followlinks=True):
    dirs[:] = [d for d in dirs if not d.startswith('.') and d != INBOX_NAME]
    for fn in files:
        if fn.lower().endswith(VIDEO_EXT) and not fn.startswith('.'):
            rel = os.path.relpath(os.path.join(dirpath, fn), RAIZ)
            cods = codigos(os.path.splitext(fn)[0])
            if cods:
                archivos.append((rel, cods))
log('Videos con codigo en la nube: %d' % len(archivos))

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

nuevos, refrescados = 0, 0
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
    if link_viejo and '/files/' not in link_viejo: continue  # no pisar links de TikTok etc.
    v['link'] = link_nuevo
    r = post('update', v)
    if r.get('error'): log('  ERROR guardando %s: %s' % (v.get('nombre'), r['error'])); continue
    if link_viejo: refrescados += 1
    else:
        nuevos += 1
        log('  🔗 %s -> %s' % (v.get('nombre'), match))

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
