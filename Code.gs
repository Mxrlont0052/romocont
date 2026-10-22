/**
 * CONTENT TEAM ROMO — Backend en Google Sheets
 * El Google Sheet es la base de datos. La página en GitHub Pages
 * lee y escribe aquí a través de este Web App.
 *
 * 19-10-2026: lee y escribe POR NOMBRE DE COLUMNA (encabezado de la fila 1),
 * no por posición. Ya se pueden mover columnas en la hoja sin romper la app.
 *
 * PESTAÑAS
 *   VIDEOS  → una fila = un video (la única que escribe la app)
 *   LISTAS  → categorías, creadores, estados y campañas (menús de la hoja)
 *   PANEL   → resumen con fórmulas, solo se lee
 *   CONFIG  → ajustes (carpeta de subidas). Antes era una fila dentro de VIDEOS
 *   GUIONES VIRAL / EA / MDT → guiones de la Fábrica, uno por línea de IA (ver LINEAS_IA)
 *   ▸ <categoría> → vista de solo lectura de cada categoría, pendientes arriba
 *
 * ORDENAR LA HOJA (una sola vez): correr reorganizar() desde el editor.
 * Después: Desplegar → Gestionar implementaciones → ✎ → Versión: Nueva → Desplegar
 * (así la URL /exec NO cambia).
 */

const SHEET_NAME = 'VIDEOS';
const CONFIG_SHEET = 'CONFIG';
const LISTAS_SHEET = 'LISTAS';
const PANEL_SHEET = 'PANEL';

// Carpetas del Drive de 5TB (ROMOCONT/). Solo LISTOS genera links en la hoja:
// el SV es material de trabajo, no algo que el equipo baje para publicar.
const DRIVE_LISTOS = '1RkbNGYLg6RZaTDhCs7sxThXwMJc-T767'; // VIDEOS LISTOS PARA SUBIR
const DRIVE_SINVOZ = '1EwH6F6YbSBHkoCqHfnp9jLI3nD79HN8L'; // VIDEOS SIN VOZ

// Columnas de VIDEOS en el orden nuevo, agrupadas:
// quién es · cómo va · dónde está · ficha · cómo le fue.
// [campo que usa la app, encabezado en la hoja, otros nombres que se aceptan]
// link = archivo en Drive (lo maneja el robot) · tiktok = video publicado (lo maneja el equipo)
// Rendimiento por red (pedido de Peter / RomoOps, 21-10-2026). RomoOps lee cada día TikTok, Instagram y Facebook
// y lo escribe aquí con `bulk`. Para sumar otra red: una línea más en REDES y volver a correr agregarColumnasRedes().
// Facebook también lleva comentarios y compartidos (pedido de Peter, 22-10-2026). Los guardados de IG no se usan.
const REDES = [
  ['tt', 'TT', ['ID', 'PUBLICADO', 'VISTAS', 'LIKES', 'COMENTARIOS', 'COMPARTIDOS']],
  ['ig', 'IG', ['ID', 'PUBLICADO', 'VISTAS', 'LIKES', 'COMENTARIOS', 'COMPARTIDOS']],
  ['fb', 'FB', ['ID', 'PUBLICADO', 'VISTAS', 'LIKES', 'COMENTARIOS', 'COMPARTIDOS']],
];
const COLS_REDES = [['actualizado', 'ACTUALIZADO', []]];
REDES.forEach(([k, P, cs]) => cs.forEach(c => COLS_REDES.push([k + '_' + c.toLowerCase(), P + ' ' + c, []])));

const COLS = [
  ['id',          'ID',           []],
  ['nombre',      'CÓDIGO',       ['NOMBRE', 'CODIGO']],
  ['categoria',   'CATEGORÍA',    ['CATEGORIA']],
  ['campana',     'CAMPAÑA',      ['CAMPANA', 'TANDA']],
  ['estado',      'ESTADO',       []],
  ['creador',     'CREADOR',      []],
  ['fecha',       'FECHA',        ['FECHA ENVIO', 'FECHA ENVÍO']],
  ['link',        'LINK DRIVE',   ['LINK']],
  ['tiktok',      'TIKTOK',       []],
  ['descripcion', 'DESCRIPCIÓN',  ['DESCRIPCION']],
  ['tema',        'TEMA',         []],
  ['formato',     'FORMATO',      []],
  ['oferta',      'OFERTA',       []],
  ['vistas',      'VISTAS',       []],
  ['leads',       'LEADS',        []],
  ['notas',       'NOTAS',        []],
  ['created_at',  'CREADO',       ['CREATED_AT']],
  // Publicar (20-10-2026): los admins eligen DÍA y HORA en el Dashboard; Lizy pega FACEBOOK y TIKTOK.
  ['dia_pub',     'DÍA PUBLICAR', ['DIA PUBLICAR']],
  ['hora_pub',    'HORA PUBLICAR', []],
  ['facebook',    'FACEBOOK',     []],
  ['publicado_en', 'PUBLICADO EN', []],
  ['publico',     'PUBLICÓ',      ['PUBLICO']],
  // SUBIÓ ya existe en la hoja (ROMO CENTRAL la agrega); va en COLS para que reorganizar() no la pierda.
  ['subio',       'SUBIÓ',        ['SUBIO']],
  ['instagram',   'INSTAGRAM',    []],   // link del reel, como TIKTOK y FACEBOOK
].concat(COLS_REDES);
// Columnas que se agregan solas al final de VIDEOS si faltan (las crea asegurarCentral).
const COLS_NUEVAS = ['DÍA PUBLICAR', 'HORA PUBLICAR', 'FACEBOOK', 'PUBLICADO EN', 'PUBLICÓ'];
const FIELDS = COLS.map(c => c[0]);

// Lo que aparece en los menús de LISTAS la primera vez (después se editan en la hoja).
const CATEGORIAS = [
  ['ESTUDIANTES', 'ES'], ['DEMOSTRATIVAS', 'DM'], ['RELLENO', 'RLL'], ['ROMO ROOM', 'RR'],
  ['TESTIMONIOS', 'RDJ'], ['IA VIRAL', 'IAV'], ['IA EDICION DE AUDIO', 'IAE'], ['IA MDT', 'IAM'],
  ['IA INFORMATIVO', 'IA'], ['MINISTERIO DE TRABAJO', 'MDT'],
  ['EDICION DE AUDIO', 'EA'], ['PEDRO ROMO', 'PDR'], ['VIDEOS 360', '360'],
];

// Videos de IA por línea (19-10-2026). El código nace con el guion: al escribir el
// título en su pestaña, la hoja le pone el siguiente libre (IAV001, IAE001, IAM001…).
// IA001–IA048 se quedan como historial en IA INFORMATIVO.
// IAM = video de IA sobre MDT; no confundir con MDT### (videos reales de DJs certificados).
const LINEAS_IA = [
  { linea: 'VIRAL', hoja: 'GUIONES VIRAL', categoria: 'IA VIRAL', prefijo: 'IAV', para: 'DJ hobby: comunidad, polémica, traer gente a la demo' },
  { linea: 'EA', hoja: 'GUIONES EA', categoria: 'IA EDICION DE AUDIO', prefijo: 'IAE', para: 'Productores (primero DJ, después productor)' },
  { linea: 'MDT', hoja: 'GUIONES MDT', categoria: 'IA MDT', prefijo: 'IAM', para: 'DJ pro, certificación' },
];
// Columnas de un guion: CÓDIGO y Estado + lo que lee la Fábrica (romo-reel/fabrica/hoja.py), por encabezado.
const GUION_HEADS = ['CÓDIGO', 'Estado', 'Título', 'Estilo', 'Puerta', 'Tono', 'Presentador', 'Gente',
  '1 Conflicto · voz', '1 · ceja', '1 · titular', '1 · sub',
  '2 Antes del PERO · ceja', '2 Antes del PERO · titular', '2 PERO · voz', '2 · ceja', '2 · titular', '2 · sub',
  '3 POR LO TANTO · voz', '3 · ceja', '3 · titular', '3 · sub',
  '4 Pregunta · voz', '4 · titular', '4 · sub', 'Mito · frase', 'Mito · sello',
  'Chat · contacto', 'Chat · mensajes del problema', 'Chat · mensajes de la solución', 'Notas'];
// borrador → listo (la Fábrica lo puede tomar) → en fábrica → hecho (aprobado, en Drive y en VIDEOS) / descartado
const GUION_ESTADOS = ['borrador', 'listo', 'en fábrica', 'hecho', 'descartado'];
const ESTADOS = ['PENDIENTE', 'PUBLICADO'];
const CREADORES = ['MARLONT', 'DANIEL', 'TIPAN', 'WLADO', 'KIKE', 'LIZY'];
const CAMPANAS = ['MINISTERIO DE TRABAJO', 'EDICION DE AUDIO'];

// Videos que estaban en la categoría equivocada (revisado con Marlon el 19-10-2026).
const MOVER_CATEGORIA = {
  'EDICION DE AUDIO': ['EA003', 'EA004', 'EA005', 'EA006', 'EA007', 'EA008', 'EA009', 'EA010'],
  'RELLENO': ['RLL095', 'RLL096', 'RLL097'],
};

// ===========================================================================
// Encabezados: de nombre de columna a número de columna
// ===========================================================================
// Texto dañado al pegar el código con el portapapeles en MacRoman (19-10-2026): "C√ìDIGO" → "CÓDIGO".
// Se escribe con escapes \u para que este arreglo no se dañe igual al pegarlo.
const MOJIBAKE = [
  ['\u221A\u00EC', '\u00D3'], ['\u221A\u00E7', '\u00CD'], ['\u221A\u00EB', '\u00D1'], ['\u221A\u00C5', '\u00C1'],
  ['\u221A\u00E2', '\u00C9'], ['\u221A\u00F6', '\u00DA'], ['\u221A\u00FA', '\u00DC'], ['\u221A\u00B0', '\u00E1'],
  ['\u221A\u00A9', '\u00E9'], ['\u221A\u2260', '\u00ED'], ['\u221A\u2265', '\u00F3'], ['\u221A\u222B', '\u00FA'],
  ['\u221A\u00B1', '\u00F1'], ['\u221A\u00BA', '\u00FC'], ['\u00AC\u2211', '\u00B7'], ['\u201A\u00C4\u00EE', '\u2014'],
  ['\u201A\u00F1\u220F', '\u25B8'], ['\u00AC\u00F8', '\u00BF'], ['\u00AC\u00B0', '\u00A1'], ['\u201A\u00DC\u00ED', '\u2192'],
  ['\u201A\u00FA\u00EC', '\u2713'], ['\uF8FF\u00FC\u00EC\u00A7', '\uD83D\uDCE4'],
];
const arreglar = s => MOJIBAKE.reduce((t, [mal, bien]) => t.split(mal).join(bien), String(s == null ? '' : s));
const normHead = s => arreglar(s).toUpperCase().trim()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ');

// { campo: índice 0-based } según la fila 1 de la hoja. Un campo que no tiene
// columna en la hoja simplemente no se lee ni se escribe.
function colMap(sheet) {
  const heads = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(normHead);
  const map = {};
  COLS.forEach(([f, h, alias]) => {
    const i = [h].concat(alias).map(normHead).map(x => heads.indexOf(x)).find(i => i >= 0);
    if (i != null) map[f] = i;
  });
  if (map.id == null) throw new Error('La hoja VIDEOS no tiene columna ID');
  return map;
}

function getSheet() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error('No existe la hoja ' + SHEET_NAME);
  return sheet;
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// La página y los programas viejos mandan "tanda": es la misma columna que CAMPAÑA.
function aliasEntrada(v) {
  if (v && v.campana == null && v.tanda != null) v.campana = v.tanda;
  return v;
}

function celda(val) {
  // El Sheet convierte fechas a Date: devolver como YYYY-MM-DD. Una HORA sola (18:00) llega como Date de 1899: HH:mm.
  if (val instanceof Date && val.getFullYear() < 1901) return Utilities.formatDate(val, 'America/Guayaquil', 'HH:mm');
  if (val instanceof Date) return Utilities.formatDate(val, 'America/Guayaquil', 'yyyy-MM-dd');
  return String(val == null ? '' : val);
}

// ===========================================================================
// CONFIG — ajustes clave/valor (antes era la fila CONFIG_NUBE dentro de VIDEOS)
// ===========================================================================
function getConfigSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(CONFIG_SHEET);
  if (!sh) {
    sh = ss.insertSheet(CONFIG_SHEET);
    sh.getRange(1, 1, 1, 3).setValues([['CLAVE', 'VALOR', 'PARA QUÉ']]).setFontWeight('bold');
  }
  return sh;
}

function getConfig(clave) {
  const data = getConfigSheet().getDataRange().getValues();
  const fila = data.find(r => String(r[0]) === clave);
  return fila ? String(fila[1] || '') : '';
}

function setConfig(clave, valor, paraQue) {
  const sh = getConfigSheet();
  const data = sh.getDataRange().getValues();
  const r = data.findIndex(f => String(f[0]) === clave);
  if (r > 0) sh.getRange(r + 1, 2).setValue(valor);
  else sh.appendRow([clave, valor, paraQue || '']);
}

// ===== GET: devolver todos los videos (o los guiones con ?guiones=1) =====
function doGet(e) {
  try {
    if (e && e.parameter && e.parameter.guiones) return jsonOut(leerGuiones());
    const sheet = getSheet();
    const m = colMap(sheet);
    const data = sheet.getDataRange().getValues();
    const videos = [];
    for (let r = 1; r < data.length; r++) {
      const fila = data[r];
      const cat = m.categoria != null ? fila[m.categoria] : '';
      const nom = m.nombre != null ? fila[m.nombre] : '';
      if (!cat && !nom) continue; // fila vacía
      // Fila agregada a mano en el Sheet sin ID: asignarle uno automáticamente
      if (!fila[m.id]) {
        const newId = 'v' + Date.now() + '_' + r;
        sheet.getRange(r + 1, m.id + 1).setValue(newId);
        fila[m.id] = newId;
      }
      const v = {};
      FIELDS.forEach(f => { v[f] = m[f] != null ? celda(fila[m[f]]) : ''; });
      v.tanda = v.campana; // la página vieja todavía lee "tanda"
      // Hoja sin ordenar todavía: la fila CONFIG_NUBE sigue aquí; la página la reconoce sola.
      videos.push(v);
    }
    // Hoja ya ordenada: la carpeta de subidas vive en CONFIG; se manda como antes.
    if (!videos.some(v => v.id === 'CONFIG_NUBE')) {
      const inbox = getConfig('CARPETA_SUBIDAS');
      if (inbox) videos.push({ id: 'CONFIG_NUBE', categoria: 'CONFIG', nombre: 'CONFIG NUBE', link: inbox });
    }
    return jsonOut(videos);
  } catch (e) {
    return jsonOut({ error: e.message });
  }
}

// Escribe en la fila solo los campos que llegan; lo que no llega se queda como está.
// Métricas: un vacío ("") es «sin dato», no «cero»: nunca pisa un número que ya está.
const METRICAS = COLS_REDES.map(c => c[0]).concat(['vistas']);
const LINKS_REDES = ['tiktok', 'facebook', 'instagram'];
const ES_ID_RED = f => /^(tt|ig|fb)_id$/.test(f);

// Escribe en la fila solo los campos que llegan; lo que no llega se queda como está.
// opts.protegerLinks (lo usa bulk/RomoOps): los links TIKTOK/FACEBOOK/INSTAGRAM solo se llenan si estaban vacíos.
function escribirFila(sheet, m, row, v, opts) {
  const ancho = sheet.getLastColumn();
  const rango = sheet.getRange(row, 1, 1, ancho);
  const actual = rango.getValues()[0];
  FIELDS.forEach(f => {
    if (m[f] == null || f === 'created_at' || f === 'id') return;
    if (v[f] === undefined) return;
    if (METRICAS.indexOf(f) >= 0 && (v[f] === '' || v[f] == null)) return;
    if (opts && opts.protegerLinks && LINKS_REDES.indexOf(f) >= 0 && String(actual[m[f]] || '').trim()) return;
    if (ES_ID_RED(f)) sheet.getRange(row, m[f] + 1).setNumberFormat('@');   // 19 dígitos de TikTok: texto, sin redondeo
    actual[m[f]] = v[f] == null ? '' : String(v[f]);
  });
  rango.setValues([actual]);
}

// ===== POST: insert / update / delete =====
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000); // evita escrituras simultáneas (el bug de duplicados)
  try {
    const req = JSON.parse(e.postData.contents);
    const sheet = getSheet();
    const m = colMap(sheet);

    if (req.action === 'insert') {
      const v = aliasEntrada(req.video || {});
      if (!v.id) throw new Error('Video sin ID');
      if (findRowById(sheet, v.id)) throw new Error('ID duplicado: ' + v.id);
      v.created_at = new Date().toISOString();
      const fila = new Array(sheet.getLastColumn()).fill('');
      FIELDS.forEach(f => { if (m[f] != null) fila[m[f]] = v[f] == null ? '' : String(v[f]); });
      sheet.appendRow(fila);
      return jsonOut({ ok: true, action: 'insert', id: v.id });
    }

    if (req.action === 'update') {
      const v = aliasEntrada(req.video || {});
      const row = findRowById(sheet, v.id);
      if (!row) throw new Error('No existe el video ' + v.id);
      escribirFila(sheet, m, row, v);
      return jsonOut({ ok: true, action: 'update', id: v.id });
    }

    if (req.action === 'delete') {
      const row = findRowById(sheet, req.id);
      if (!row) throw new Error('No existe el video ' + req.id);
      sheet.deleteRow(row);
      return jsonOut({ ok: true, action: 'delete', id: req.id });
    }

    if (req.action === 'bulk') {
      // Actualización masiva (la usa nube-sync): lista de videos por id
      const list = req.videos || [];
      let updated = 0;
      const data = sheet.getDataRange().getValues();
      const rowById = {};
      for (let r = 1; r < data.length; r++) rowById[String(data[r][m.id])] = r + 1;
      list.forEach(v => {
        const row = rowById[String(v.id)];
        if (!row) return;
        escribirFila(sheet, m, row, aliasEntrada(v), { protegerLinks: true });
        updated++;
      });
      return jsonOut({ ok: true, action: 'bulk', updated: updated });
    }

    if (req.action === 'nube') {
      // La Air manda la lista de archivos que hay en la nube; Google hace el cruce.
      // items = [{n:'ED001.mp4', u:'https://.../ED001.mp4'}, ...]
      const items = req.items || [];
      const data = sheet.getDataRange().getValues();
      // normaliza para cruzar: MAYUS y sin espacios ("RLL 034" == "RLL034")
      const norm = s => String(s || '').toUpperCase().replace(/\s+/g, '');
      const map = {};
      items.forEach(it => {
        const dot = it.n.lastIndexOf('.');
        const code = norm(dot >= 0 ? it.n.slice(0, dot) : it.n);
        if (code) map[code] = it.u;
      });
      let linked = 0;
      for (let r = 1; r < data.length; r++) {
        if (String(data[r][m.id]) === 'CONFIG_NUBE') continue;
        const code = norm(data[r][m.nombre]);
        if (code && map[code] && data[r][m.link] !== map[code]) {
          sheet.getRange(r + 1, m.link + 1).setValue(map[code]);
          linked++;
        }
      }
      // Guardar el link de SUBIR AQUI para el botón 📤 de la página
      if (req.inbox) setConfig('CARPETA_SUBIDAS', req.inbox, 'Botón 📤 de la página');
      return jsonOut({ ok: true, action: 'nube', linked: linked, archivos: items.length });
    }

    if (req.action === 'guion') {
      // La Fábrica avisa en qué va cada guion: en fábrica / hecho / descartado / listo
      if (GUION_ESTADOS.indexOf(req.estado) < 0) throw new Error('Estado de guion no válido: ' + req.estado);
      const g = buscarGuion(req.codigo);
      if (!g) throw new Error('No existe el guion ' + req.codigo);
      g.sheet.getRange(g.fila, g.cols.indexOf('ESTADO') + 1).setValue(req.estado);
      return jsonOut({ ok: true, action: 'guion', codigo: req.codigo, estado: req.estado });
    }

    if (req.action === 'drive') {
      // Sincronización a pedido desde el botón de la página.
      return jsonOut(sincronizarDrive());
    }

    if (req.action === 'central') {
      // ROMO CENTRAL (cont.romodj.com/equipo): login, subidas y ROMO EDITS. Ver la sección CENTRAL abajo.
      return jsonOut(central(req));
    }

    throw new Error('Acción desconocida: ' + req.action);
  } catch (err) {
    return jsonOut({ error: err.message });
  } finally {
    lock.releaseLock();
  }
}

// ===========================================================================
// REORGANIZAR — ordena la hoja una sola vez (correr a mano desde el editor)
// ===========================================================================
// Hace:
//  1. VIDEOS con las columnas nuevas (COLS), fila por fila sin perder nada
//  2. Fechas → fecha real (se ve 2026-07-16)
//  3. Creador en MAYÚSCULAS ("Daniel" → "DANIEL"); vacío se queda vacío
//  4. TANDA se vacía y pasa a CAMPAÑA (opcional: MDT, EDICION DE AUDIO…)
//  5. Fila CONFIG NUBE → pestaña CONFIG
//  6. Orden: por categoría (orden de LISTAS) y luego por código
//  7. Crea LISTAS (menús) y PANEL (resumen)
//  8. Pasa a su categoría los videos de MOVER_CATEGORIA
// No borra ninguna fila de video (los duplicados DM045–DM054 se quedan).
// ANTES: tener la copia de respaldo. Devuelve un informe en el registro.
function reorganizar() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getSheet();
  const m = colMap(sheet);
  const data = sheet.getDataRange().getValues();
  const informe = { filas: 0, fechasArregladas: 0, fechasSinEntender: [], creadoresArreglados: 0, categoriasMovidas: 0, config: 0 };

  const filas = [];
  for (let r = 1; r < data.length; r++) {
    const f = data[r];
    const v = {};
    FIELDS.forEach(k => { v[k] = m[k] != null ? f[m[k]] : ''; });
    if (String(v.id) === 'CONFIG_NUBE' || String(v.categoria) === 'CONFIG') {
      if (v.link) setConfig('CARPETA_SUBIDAS', String(v.link), 'Botón 📤 de la página');
      informe.config++;
      continue;
    }
    if (!v.categoria && !v.nombre && !v.id) continue; // fila vacía
    // Fecha
    if (v.fecha !== '' && !(v.fecha instanceof Date)) {
      const d = parseFechaHoja(v.fecha);
      if (d) { v.fecha = d; informe.fechasArregladas++; }
      else informe.fechasSinEntender.push(String(v.nombre) + ': ' + v.fecha);
    }
    // Creador
    const cre = String(v.creador || '').trim().toUpperCase();
    if (cre !== String(v.creador || '')) informe.creadoresArreglados++;
    v.creador = cre;
    v.nombre = String(v.nombre || '').trim();
    v.categoria = String(v.categoria || '').trim().toUpperCase();
    const destino = Object.keys(MOVER_CATEGORIA).find(c => MOVER_CATEGORIA[c].includes(normCodigo(v.nombre)));
    if (destino && destino !== v.categoria) { v.categoria = destino; informe.categoriasMovidas++; }
    v.campana = ''; // la tanda vieja no servía; campaña empieza limpia
    filas.push(v);
  }

  const ordenCat = CATEGORIAS.map(c => c[0]);
  filas.sort(compararVideos(ordenCat));
  informe.filas = filas.length;

  // Escribir VIDEOS de nuevo
  const salida = [COLS.map(c => c[1])].concat(filas.map(v => FIELDS.map(k => v[k] == null ? '' : v[k])));
  const filtro = sheet.getFilter();
  if (filtro) filtro.remove();
  sheet.clear();
  sheet.clearConditionalFormatRules();
  sheet.getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns()).clearDataValidations();
  sheet.getRange(1, 1, salida.length, COLS.length).setValues(salida);
  if (sheet.getMaxColumns() > COLS.length) sheet.deleteColumns(COLS.length + 1, sheet.getMaxColumns() - COLS.length);

  crearListas(ss);
  darFormatoVideos(sheet, filas.length);
  crearPanel(ss);
  ss.setActiveSheet(sheet);
  ss.moveActiveSheet(1);

  Logger.log(JSON.stringify(informe, null, 2));
  return informe;
}

// "2026-07-16", "Sat Jan 10 2026 00:00:00 GMT-0500", "10 enero 2026",
// "06 de Octubre 2026", "1 DE JUNIO 2026" → Date (mediodía, para que la zona horaria no la mueva de día)
const MESES = { enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5, julio: 6, agosto: 7,
  septiembre: 8, setiembre: 8, octubre: 9, noviembre: 10, diciembre: 11 };
const MESES_EN = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
function parseFechaHoja(s) {
  s = String(s || '').trim();
  let x = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (x) return new Date(+x[1], +x[2] - 1, +x[3], 12);
  x = s.match(/^[A-Za-z]{3} ([A-Za-z]{3}) (\d{1,2}) (\d{4})/);
  if (x && MESES_EN[x[1].toLowerCase()] != null) return new Date(+x[3], MESES_EN[x[1].toLowerCase()], +x[2], 12);
  x = s.toLowerCase().match(/^(\d{1,2})\s+(?:de\s+)?([a-záéíóú]+)\s+(?:de\s+|del\s+)?(\d{4})$/);
  if (x && MESES[x[2]] != null) return new Date(+x[3], MESES[x[2]], +x[1], 12);
  x = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); // 16/07/2026
  if (x) return new Date(+x[3], +x[2] - 1, +x[1], 12);
  return null;
}

// Categoría (en el orden de LISTAS; las desconocidas al final) → prefijo del código → número.
function compararVideos(ordenCat) {
  const pos = c => { const i = ordenCat.indexOf(c); return i < 0 ? 999 : i; };
  const partes = c => {
    const x = String(c || '').toUpperCase().replace(/\s+/g, '').match(/^(.*?)(\d+)$/);
    return x ? [x[1], +x[2]] : [String(c || '').toUpperCase(), -1];
  };
  return (a, b) => {
    const d = pos(a.categoria) - pos(b.categoria) || String(a.categoria).localeCompare(String(b.categoria));
    if (d) return d;
    const [pa, na] = partes(a.nombre), [pb, nb] = partes(b.nombre);
    return pa.localeCompare(pb) || na - nb || String(a.id).localeCompare(String(b.id));
  };
}

// LISTAS: una columna por menú. Se puede editar a mano: los menús de VIDEOS leen de aquí.
function crearListas(ss) {
  let sh = ss.getSheetByName(LISTAS_SHEET);
  if (!sh) sh = ss.insertSheet(LISTAS_SHEET);
  sh.clear();
  const heads = ['CATEGORÍA', 'PREFIJO', '', 'ESTADO', '', 'CREADOR', '', 'CAMPAÑA'];
  const alto = Math.max(CATEGORIAS.length, ESTADOS.length, CREADORES.length, CAMPANAS.length) + 30;
  const tabla = [heads];
  for (let i = 0; i < alto; i++) {
    tabla.push([
      CATEGORIAS[i] ? CATEGORIAS[i][0] : '', CATEGORIAS[i] ? CATEGORIAS[i][1] : '', '',
      ESTADOS[i] || '', '', CREADORES[i] || '', '', CAMPANAS[i] || '',
    ]);
  }
  sh.getRange(1, 1, tabla.length, heads.length).setValues(tabla);
  sh.getRange(1, 1, 1, heads.length).setFontWeight('bold').setBackground('#000000').setFontColor('#FFFFFF');
  sh.setFrozenRows(1);
  sh.getRange('A1').setNote('Agrega categorías, creadores o campañas aquí abajo y aparecen solas en los menús de VIDEOS.');
}

function darFormatoVideos(sheet, n) {
  const ss = sheet.getParent();
  const listas = ss.getSheetByName(LISTAS_SHEET);
  const col = f => FIELDS.indexOf(f) + 1;
  const filasDatos = Math.max(n, 1) + 500; // espacio para videos nuevos
  if (sheet.getMaxRows() < filasDatos + 1) sheet.insertRowsAfter(sheet.getMaxRows(), filasDatos + 1 - sheet.getMaxRows());

  // Encabezado ROMO
  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(2);
  sheet.getRange(1, 1, 1, COLS.length).setFontWeight('bold').setFontColor('#FFFFFF').setBackground('#000000');
  // Colores por bloque en el encabezado: quién es · cómo va · dónde está · ficha · cómo le fue
  const bloque = (desde, hasta, color) => sheet.getRange(1, col(desde), 1, col(hasta) - col(desde) + 1).setBackground(color);
  bloque('id', 'campana', '#000000');
  bloque('estado', 'fecha', '#E8001D');
  bloque('link', 'tiktok', '#1A1A1A');
  bloque('descripcion', 'oferta', '#333333');
  bloque('vistas', 'created_at', '#1A1A1A');
  sheet.getRange(1, col('link'), 1, 2).setFontColor('#00FFFF');

  sheet.getRange(2, col('fecha'), filasDatos, 1).setNumberFormat('yyyy-mm-dd');
  sheet.getRange(2, col('vistas'), filasDatos, 2).setNumberFormat('0');
  sheet.getRange(2, col('descripcion'), filasDatos, 1).setWrap(false);
  sheet.hideColumns(col('id'));
  sheet.hideColumns(col('created_at'));
  [[col('nombre'), 110], [col('categoria'), 170], [col('campana'), 160], [col('estado'), 110],
   [col('creador'), 100], [col('fecha'), 100], [col('link'), 140], [col('tiktok'), 140],
   [col('descripcion'), 280], [col('notas'), 220]].forEach(([c, w]) => sheet.setColumnWidth(c, w));

  // Menús desde LISTAS (la app igual puede escribir valores nuevos)
  const menu = letra => SpreadsheetApp.newDataValidation()
    .requireValueInRange(listas.getRange(letra + '2:' + letra), true).setAllowInvalid(true).build();
  sheet.getRange(2, col('categoria'), filasDatos, 1).setDataValidation(menu('A'));
  sheet.getRange(2, col('estado'), filasDatos, 1).setDataValidation(menu('D'));
  sheet.getRange(2, col('creador'), filasDatos, 1).setDataValidation(menu('F'));
  sheet.getRange(2, col('campana'), filasDatos, 1).setDataValidation(menu('H'));

  // Estado con color
  const est = sheet.getRange(2, col('estado'), filasDatos, 1);
  sheet.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('PENDIENTE')
      .setBackground('#FFE0B2').setFontColor('#E65100').setBold(true).setRanges([est]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('PUBLICADO')
      .setBackground('#D7F5E3').setFontColor('#1B5E20').setRanges([est]).build(),
  ]);

  sheet.getRange(1, 1, n + 1, COLS.length).createFilter();
}

// ===========================================================================
// GUIONES — una pestaña por línea de IA
// ===========================================================================
function hojaGuion(ss, l) {
  let sh = ss.getSheetByName(l.hoja);
  if (!sh) {
    sh = ss.insertSheet(l.hoja);
    sh.getRange(1, 1, 1, GUION_HEADS.length).setValues([GUION_HEADS]);
  }
  return sh;
}

// Encabezados normalizados de una pestaña de guiones.
const cabGuion = sh => sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0].map(normHead);

// Número más alto usado con ese prefijo, en VIDEOS y en las pestañas de guiones.
function ultimoNumero(ss, prefijo) {
  const re = new RegExp('^' + prefijo + '\\s*0*(\\d+)$', 'i');
  let top = 0;
  const mira = c => { const x = String(c || '').trim().match(re); if (x) top = Math.max(top, +x[1]); };
  const v = getSheet(), m = colMap(v);
  if (v.getLastRow() > 1) v.getRange(2, m.nombre + 1, v.getLastRow() - 1, 1).getValues().forEach(f => mira(f[0]));
  LINEAS_IA.forEach(l => {
    const sh = ss.getSheetByName(l.hoja);
    if (!sh || sh.getLastRow() < 2) return;
    const i = cabGuion(sh).indexOf('CODIGO');
    if (i >= 0) sh.getRange(2, i + 1, sh.getLastRow() - 1, 1).getValues().forEach(f => mira(f[0]));
  });
  return top;
}

// Todo guion con título y sin código recibe el siguiente libre de su línea. Idempotente.
function asignarCodigos(soloHoja) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let n = 0;
  LINEAS_IA.forEach(l => {
    if (soloHoja && soloHoja !== l.hoja) return;
    const sh = ss.getSheetByName(l.hoja);
    if (!sh || sh.getLastRow() < 2) return;
    const cab = cabGuion(sh), iC = cab.indexOf('CODIGO'), iT = cab.indexOf('TITULO'), iE = cab.indexOf('ESTADO');
    if (iC < 0 || iT < 0) return;
    const data = sh.getRange(2, 1, sh.getLastRow() - 1, cab.length).getValues();
    let top = null;
    data.forEach((f, r) => {
      if (!String(f[iT]).trim() || String(f[iC]).trim()) return;
      if (top == null) top = ultimoNumero(ss, l.prefijo);
      top++;
      sh.getRange(r + 2, iC + 1).setValue(l.prefijo + String(top).padStart(3, '0'));
      if (iE >= 0 && !String(f[iE]).trim()) sh.getRange(r + 2, iE + 1).setValue('borrador');
      n++;
    });
  });
  return n;
}

// Se dispara solo al editar la hoja: escribir el título de un guion le da su código al instante.
function onEdit(e) {
  try {
    const nombre = e && e.range && e.range.getSheet().getName();
    if (LINEAS_IA.some(l => l.hoja === nombre)) asignarCodigos(nombre);
  } catch (err) { /* nunca bloquear la edición */ }
}

// Todos los guiones, con su línea, para la Fábrica. Las llaves son los encabezados tal cual.
function leerGuiones() {
  asignarCodigos();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const out = [];
  LINEAS_IA.forEach(l => {
    const sh = ss.getSheetByName(l.hoja);
    if (!sh || sh.getLastRow() < 2) return;
    const data = sh.getDataRange().getValues();
    const cab = data[0].map(h => String(h).trim());
    for (let r = 1; r < data.length; r++) {
      if (!data[r].some(x => String(x).trim())) continue;
      const g = { linea: l.linea, categoria: l.categoria, fila: r + 1 };
      cab.forEach((h, i) => { if (h) g[h] = celda(data[r][i]).trim(); });
      out.push(g);
    }
  });
  return out;
}

function buscarGuion(codigo) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const want = normCodigo(codigo);
  for (const l of LINEAS_IA) {
    const sh = ss.getSheetByName(l.hoja);
    if (!sh || sh.getLastRow() < 2) continue;
    const cols = cabGuion(sh), iC = cols.indexOf('CODIGO');
    const data = sh.getRange(2, iC + 1, sh.getLastRow() - 1, 1).getValues();
    const r = data.findIndex(f => normCodigo(f[0]) === want);
    if (r >= 0) return { sheet: sh, fila: r + 2, cols: cols };
  }
  return null;
}

function formatoGuiones(ss) {
  const listas = ss.getSheetByName(LISTAS_SHEET);
  LINEAS_IA.forEach((l, k) => {
    const sh = hojaGuion(ss, l);
    sh.setFrozenRows(1); sh.setFrozenColumns(3);
    sh.getRange(1, 1, 1, sh.getLastColumn()).setFontWeight('bold').setFontColor('#FFFFFF').setBackground('#000000');
    sh.getRange(1, 1, 1, 2).setBackground('#E8001D');
    sh.getRange('A1').setNote(l.categoria + ' — ' + l.para + '. El CÓDIGO se pone solo al escribir el título. ' +
      'Estado: borrador → listo (la Fábrica lo toma) → en fábrica → hecho / descartado.');
    const est = sh.getRange(2, 2, Math.max(sh.getMaxRows() - 1, 1), 1);
    est.setDataValidation(SpreadsheetApp.newDataValidation()
      .requireValueInRange(listas.getRange('J2:J' + (GUION_ESTADOS.length + 1)), true).setAllowInvalid(false).build());
    sh.setConditionalFormatRules([
      ['listo', '#D7F5E3', '#1B5E20'], ['en fábrica', '#FFE0B2', '#E65100'],
      ['hecho', '#E0F7FA', '#006064'], ['descartado', '#EEEEEE', '#9E9E9E'],
    ].map(([t, bg, fg]) => SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo(t)
      .setBackground(bg).setFontColor(fg).setRanges([est]).build()));
    sh.setColumnWidth(1, 90); sh.setColumnWidth(2, 100); sh.setColumnWidth(3, 240);
    sh.setTabColor(['#E8001D', '#00FFFF', '#FFFFFF'][k]);
  });
}

// ===========================================================================
// VISTAS — una pestaña por categoría, pendientes arriba. Se calculan solas: se edita en VIDEOS.
// ===========================================================================
function crearVistas(ss) {
  const listas = ss.getSheetByName(LISTAS_SHEET);
  const cats = listas.getRange('A2:A').getValues().map(f => String(f[0]).trim()).filter(Boolean);
  const L = c => String.fromCharCode(64 + FIELDS.indexOf(c) + 1);
  const cols = ['nombre', 'campana', 'estado', 'creador', 'fecha', 'link', 'tiktok', 'descripcion', 'vistas', 'notas'].map(L).join(',');
  cats.forEach(cat => {
    const nombre = '▸ ' + cat;
    let sh = ss.getSheetByName(nombre);
    if (!sh) sh = ss.insertSheet(nombre);
    sh.clear();
    sh.getRange('A1').setFormula(`=QUERY(VIDEOS!A:Q,"select ${cols} where ${L('categoria')} = '${cat.replace(/'/g, "")}' order by ${L('estado')} asc, ${L('nombre')} asc",1)`);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, 10).setFontWeight('bold').setFontColor('#FFFFFF').setBackground('#1A1A1A');
    sh.getRange('E2:E').setNumberFormat('yyyy-mm-dd');
    sh.setTabColor('#333333');
  });
}

// ===========================================================================
// ACTUALIZAR (19-10-2026) — correr UNA vez después de reorganizar(). No reordena ni borra nada.
// ===========================================================================
//  1. ROMO DJS → TESTIMONIOS (los 8 videos conservan su código RDJ)
//  2. LISTAS: categorías IA VIRAL / IA EDICION DE AUDIO / IA MDT y estados de guion
//  3. Pestañas GUIONES VIRAL / GUIONES EA / GUIONES MDT
//  4. Una pestaña ▸ por categoría (pendientes arriba)
//  5. PANEL al día y pestañas en orden
function actualizar() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getSheet(), m = colMap(sheet);
  const informe = { tildesArregladas: 0, testimonios: 0, categoriasNuevas: [], guiones: [], vistas: 0 };

  // 0. Tildes dañadas en encabezados y textos fijos (VIDEOS fila 1, LISTAS fila 1, CONFIG)
  const cab = sheet.getRange(1, 1, 1, sheet.getLastColumn());
  const heads = cab.getValues()[0];
  const nuevos = heads.map(h => { const f = COLS.find(([, hh, al]) => [hh].concat(al).map(normHead).includes(normHead(h))); return f ? f[1] : arreglar(h); });
  informe.tildesArregladas += nuevos.filter((h, i) => h !== heads[i]).length;
  cab.setValues([nuevos]);
  [LISTAS_SHEET, CONFIG_SHEET].forEach(n => {
    const sh = ss.getSheetByName(n);
    if (!sh || !sh.getLastRow()) return;
    const rg = sh.getDataRange(), v = rg.getValues();
    const a = v.map(f => f.map(x => typeof x === 'string' ? arreglar(x) : x));
    informe.tildesArregladas += a.flat().filter((x, i) => x !== v.flat()[i]).length;
    rg.setValues(a);
  });

  // 1. Testimonios
  if (sheet.getLastRow() > 1) {
    const rg = sheet.getRange(2, m.categoria + 1, sheet.getLastRow() - 1, 1);
    const vals = rg.getValues();
    vals.forEach(f => { if (String(f[0]).trim().toUpperCase() === 'ROMO DJS') { f[0] = 'TESTIMONIOS'; informe.testimonios++; } });
    rg.setValues(vals);
  }

  // 2. LISTAS (sin borrar lo que se haya agregado a mano)
  const listas = ss.getSheetByName(LISTAS_SHEET);
  const colA = listas.getRange('A2:B').getValues();
  const iRdj = colA.findIndex(f => String(f[0]).trim() === 'ROMO DJS');
  if (iRdj >= 0) listas.getRange(iRdj + 2, 1).setValue('TESTIMONIOS');
  const tiene = new Set(listas.getRange('A2:A').getValues().map(f => String(f[0]).trim()));
  LINEAS_IA.forEach(l => {
    if (tiene.has(l.categoria)) return;
    listas.getRange(listas.getRange('A:A').getValues().filter(f => String(f[0]).trim()).length + 1, 1, 1, 2)
      .setValues([[l.categoria, l.prefijo]]);
    informe.categoriasNuevas.push(l.categoria);
  });
  listas.getRange(1, 10, GUION_ESTADOS.length + 1, 1).setValues([['ESTADO GUION']].concat(GUION_ESTADOS.map(x => [x])));
  listas.getRange('J1').setFontWeight('bold').setBackground('#000000').setFontColor('#FFFFFF');

  // 3. Guiones
  LINEAS_IA.forEach(l => { hojaGuion(ss, l); informe.guiones.push(l.hoja); });
  formatoGuiones(ss);

  // 4 y 5
  crearVistas(ss);
  informe.vistas = listas.getRange('A2:A').getValues().filter(f => String(f[0]).trim()).length;
  crearPanel(ss);
  const orden = [SHEET_NAME].concat(LINEAS_IA.map(l => l.hoja));
  orden.forEach((n, i) => { const sh = ss.getSheetByName(n); ss.setActiveSheet(sh); ss.moveActiveSheet(i + 1); });
  ss.getSheets().filter(sh => /^▸ /.test(sh.getName())).forEach((sh, i) => { ss.setActiveSheet(sh); ss.moveActiveSheet(orden.length + i + 1); });
  [PANEL_SHEET, LISTAS_SHEET, CONFIG_SHEET].forEach(n => { const sh = ss.getSheetByName(n); if (sh) { ss.setActiveSheet(sh); ss.moveActiveSheet(ss.getSheets().length); } });
  ss.setActiveSheet(sheet);

  Logger.log(JSON.stringify(informe, null, 2));
  return informe;
}

// PANEL: resumen que se calcula solo. No se escribe a mano.
function crearPanel(ss) {
  let sh = ss.getSheetByName(PANEL_SHEET);
  if (!sh) sh = ss.insertSheet(PANEL_SHEET);
  sh.clear();
  const L = c => String.fromCharCode(64 + FIELDS.indexOf(c) + 1); // letra de la columna en VIDEOS
  const V = c => `VIDEOS!${L(c)}2:${L(c)}`;
  sh.getRange('A1').setValue('PANEL ROMO CONT — se calcula solo, no escribir aquí').setFontWeight('bold');

  sh.getRange('A3:D3').setValues([['CATEGORÍA', 'TOTAL', 'PUBLICADOS', 'PENDIENTES']]);
  sh.getRange('A4').setFormula(`=FILTER(LISTAS!A2:A, LISTAS!A2:A<>"")`);
  for (let r = 4; r < 4 + CATEGORIAS.length + 10; r++) {
    sh.getRange(r, 2, 1, 3).setFormulas([[
      `=IF(A${r}="","",COUNTIF(${V('categoria')},A${r}))`,
      `=IF(A${r}="","",COUNTIFS(${V('categoria')},A${r},${V('estado')},"PUBLICADO"))`,
      `=IF(A${r}="","",COUNTIFS(${V('categoria')},A${r},${V('estado')},"PENDIENTE"))`,
    ]]);
  }

  sh.getRange('F3:H3').setValues([['CREADOR', 'ESTE MES', 'TOTAL']]);
  sh.getRange('F4').setFormula(`=FILTER(LISTAS!F2:F, LISTAS!F2:F<>"")`);
  for (let r = 4; r < 4 + CREADORES.length + 10; r++) {
    sh.getRange(r, 7, 1, 2).setFormulas([[
      `=IF(F${r}="","",COUNTIFS(${V('creador')},F${r},${V('fecha')},">="&EOMONTH(TODAY(),-1)+1))`,
      `=IF(F${r}="","",COUNTIF(${V('creador')},F${r}))`,
    ]]);
  }

  sh.getRange('J3:K3').setValues([['ALERTAS', '']]);
  sh.getRange('J4:K6').setValues([
    ['Pendientes', `=COUNTIF(${V('estado')},"PENDIENTE")`],
    ['Pendientes con más de 7 días', `=COUNTIFS(${V('estado')},"PENDIENTE",${V('fecha')},"<"&TODAY()-7)`],
    ['Publicados sin descripción', `=COUNTIFS(${V('estado')},"PUBLICADO",${V('descripcion')},"")`],
  ]);
  ['A3:D3', 'F3:H3', 'J3:K3'].forEach(a => sh.getRange(a).setFontWeight('bold').setBackground('#000000').setFontColor('#FFFFFF'));
  sh.setColumnWidth(1, 190); sh.setColumnWidth(10, 220);
}

// ===========================================================================
// DRIVE — el robot que mantiene la columna LINK DRIVE al día
// ===========================================================================
// ROMO CAMBIOS ya escribe el link al terminar de subir cada video, así que esto
// es la red de abajo: recoge lo que se subió a mano a la carpeta, lo que se
// subió con la hoja aún sin la fila, y lo que falló por internet. Corre solo
// cada 10 minutos (ver crearTriggerDrive) y es idempotente: solo escribe cuando
// el link cambia, así que sobra con que corra de más.

// Link que baja el archivo directo, sin pasar por el visor de Drive.
function driveLink(id) {
  return 'https://drive.google.com/uc?export=download&id=' + id;
}

// "RLL 004.mp4" y "rll004" son el mismo video: así cruzan la hoja y el archivo.
function normCodigo(s) {
  return String(s || '').toUpperCase().replace(/\.[A-Z0-9]{2,4}$/, '').replace(/\s+/g, '');
}

function sincronizarDrive() {
  const sheet = getSheet();
  const m = colMap(sheet);
  const data = sheet.getDataRange().getValues();

  // 1) Todo lo que hay en LISTOS PARA SUBIR, por código.
  const porCodigo = {};
  const it = DriveApp.getFolderById(DRIVE_LISTOS).getFiles();
  while (it.hasNext()) {
    const f = it.next();
    const code = normCodigo(f.getName());
    if (code) porCodigo[code] = driveLink(f.getId());
  }

  // 2) Pegar el link en cada fila que le corresponda.
  let escritos = 0, limpiados = 0;
  for (let r = 1; r < data.length; r++) {
    if (String(data[r][m.id]) === 'CONFIG_NUBE') continue;
    const code = normCodigo(data[r][m.nombre]);
    const actual = String(data[r][m.link] || '');
    const nuevo = code ? porCodigo[code] : null;
    if (nuevo) {
      if (actual !== nuevo) { sheet.getRange(r + 1, m.link + 1).setValue(nuevo); escritos++; }
    } else if (esLinkMuerto(actual)) {
      // El archivo no está en Drive y el link apunta a la nube vieja: dejarlo
      // en blanco hace que el dashboard muestre "📤 subir" en vez de un ⬇ que
      // falla. Un link de Drive sin archivo NO se toca: puede estar en otra
      // carpeta y borrarlo perdería información buena.
      sheet.getRange(r + 1, m.link + 1).setValue(''); limpiados++;
    }
  }
  return { ok: true, archivos: Object.keys(porCodigo).length, escritos: escritos, limpiados: limpiados };
}

// Links de la nube privada que ya no existe (túneles Cloudflare / localhost.run).
function esLinkMuerto(u) {
  return /trycloudflare\.com|localhost\.run|lhr\.life|pinggy/i.test(String(u || ''));
}

// Barre de una vez todos los links muertos de la nube vieja.
function limpiarLinksViejos() {
  const sheet = getSheet();
  const m = colMap(sheet);
  const data = sheet.getDataRange().getValues();
  let n = 0;
  for (let r = 1; r < data.length; r++) {
    if (esLinkMuerto(data[r][m.link])) { sheet.getRange(r + 1, m.link + 1).setValue(''); n++; }
  }
  // El destino del "SUBIR AQUI" es la carpeta de Drive; la página la lee de CONFIG.
  setConfig('CARPETA_SUBIDAS', 'https://drive.google.com/drive/folders/' + DRIVE_LISTOS, 'Botón 📤 de la página');
  return { ok: true, limpiados: n };
}

// NOTA: compartir las carpetas se hace A MANO desde Drive, con la cuenta de
// ROMO que es la dueña (clic derecho → Compartir → Cualquier usuario con el
// enlace → Lector). Este script corre con la cuenta personal de Marlon y solo
// tiene permiso de LECTURA sobre Drive (ver appsscript.json): no puede —ni debe—
// cambiar quién ve esas carpetas.

// Con qué cuenta corre este script y qué alcanza a ver. Si getFolderById falla,
// casi siempre es que el script corre con una cuenta de Google distinta a la
// dueña de las carpetas (pasa con varias sesiones abiertas en el navegador).
function diagnostico() {
  const out = {};
  try { out.cuenta = Session.getActiveUser().getEmail() || '(no visible)'; }
  catch (e) { out.cuenta = 'ERROR: ' + e.message; }
  try { out.hoja = SpreadsheetApp.getActiveSpreadsheet().getName(); }
  catch (e) { out.hoja = 'ERROR (script suelto, no pegado a la hoja): ' + e.message; }
  try { out.columnas = colMap(getSheet()); }
  catch (e) { out.columnas = 'ERROR: ' + e.message; }
  [['LISTOS', DRIVE_LISTOS], ['SIN VOZ', DRIVE_SINVOZ]].forEach(function (par) {
    try { out[par[0]] = '✓ ' + DriveApp.getFolderById(par[1]).getName(); }
    catch (e) { out[par[0]] = '✗ ' + e.message; }
  });
  Logger.log(JSON.stringify(out, null, 2));
  return out;
}

// Busca las carpetas POR NOMBRE en el Drive de esta cuenta y escupe sus IDs.
// Sirve cuando el ID no vale porque las carpetas viven en otra cuenta o son una
// copia distinta: los IDs que salgan aquí son los que hay que poner arriba.
function buscarCarpetas() {
  const out = [];
  ['VIDEOS LISTOS PARA SUBIR', 'VIDEOS SIN VOZ'].forEach(function (nombre) {
    const it = DriveApp.getFoldersByName(nombre);
    let hallada = false;
    while (it.hasNext()) {
      const f = it.next();
      const padres = f.getParents();
      out.push(nombre + ' → ID ' + f.getId() +
               (padres.hasNext() ? ' (dentro de ' + padres.next().getName() + ')' : ''));
      hallada = true;
    }
    if (!hallada) out.push(nombre + ' → NO EXISTE en el Drive de esta cuenta');
  });
  Logger.log(out.join('\n'));
  return out;
}

// Instala el robot cada 10 min (borra el anterior para no duplicarlo).
function crearTriggerDrive() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'sincronizarDrive') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('sincronizarDrive').timeBased().everyMinutes(10).create();
  return { ok: true };
}

function findRowById(sheet, id) {
  if (!id) return 0;
  const m = colMap(sheet);
  const ids = sheet.getRange(1, m.id + 1, sheet.getLastRow(), 1).getValues();
  for (let r = 1; r < ids.length; r++) {
    if (String(ids[r][0]) === String(id)) return r + 1; // fila 1-indexed
  }
  return 0;
}

// ===========================================================================
// CENTRAL — ROMO CENTRAL (cont.romodj.com/equipo) · 20-10-2026
// ===========================================================================
// Solo la usa el backend de Modal «romo-central», con una clave propia. La clave se guarda
// sola la primera vez en CONFIG › CLAVE_CENTRAL (la página pública nunca la ve).
//
//   EQUIPO   → quién es quién: NOMBRE · CORREO · ROL (ADMIN / PUBLICADOR / EDITOR / SUBIDOR) · ACTIVO
//              Quien entra con Google y no está aquí queda anotado solo como SUBIDOR.
//              "Por emparejar" = fila sin correo: al ponerle el correo, esa persona entra con ese rol.
//   SUBIDAS  → una fila = un video crudo subido (cola de ROMO EDITS)
//   VIDEOS   → al aprobar un cambio se crea su fila (con la columna SUBIÓ)
const EQUIPO_SHEET = 'EQUIPO';
const SUBIDAS_SHEET = 'SUBIDAS';
const EQUIPO_HEADS = ['NOMBRE', 'CORREO', 'ROL', 'ACTIVO', 'ÚLTIMA VEZ'];
const EQUIPO_INICIAL = [
  ['MARLONT', 'marlonromero0052@gmail.com', 'ADMIN', 'SI', ''],
  ['KIKE', 'lskike@gmail.com', 'ADMIN', 'SI', ''],
  ['PETER', 'peter.romo@gmail.com', 'ADMIN', 'SI', ''],
  ['LIZY', '', 'PUBLICADOR', 'SI', ''],
  ['DANIEL', '', 'EDITOR', 'SI', ''],
  ['TIPAN', '', 'EDITOR', 'SI', ''],
];
const ROLES = ['ADMIN', 'PUBLICADOR', 'EDITOR', 'SUBIDOR'];
// [campo, encabezado]
const SUBIDA_COLS = [
  ['id', 'ID'], ['archivo', 'ARCHIVO'], ['drive_id', 'DRIVE ID'], ['subio', 'SUBIÓ'], ['correo', 'CORREO'],
  ['fecha', 'FECHA'], ['estado', 'ESTADO'], ['editor', 'EDITOR'], ['tomado', 'TOMADO'],
  ['categoria', 'CATEGORÍA'], ['codigo', 'CÓDIGO'], ['notas', 'NOTAS'],
];
// PREPARANDO → PARA EDITAR → RENDERIZANDO → REVISAR → LISTO · (DESCARTADO / ERROR)
const SUBIDA_ESTADOS = ['PREPARANDO', 'PARA EDITAR', 'RENDERIZANDO', 'REVISAR', 'LISTO', 'DESCARTADO', 'ERROR'];
const ABIERTOS = ['PARA EDITAR', 'RENDERIZANDO', 'REVISAR'];
// Un video tomado y sin tocar en 48 h vuelve a la bolsa para que otro editor lo haga.
const LIBERAR_HORAS = 48;
// Prefijo que escribe cada categoría y patrón con el que lee (RLL acepta la fila vieja «RL»).
const PREFIJO_CAT = {
  'ESTUDIANTES': ['ES', /^ES\s*0*(\d+)$/i],
  'DEMOSTRATIVAS': ['DM', /^DM\s*0*(\d+)$/i],
  'RELLENO': ['RLL', /^RLL?\s*0*(\d+)$/i],
};

function central(req) {
  const clave = getConfig('CLAVE_CENTRAL');
  if (!req.clave || String(req.clave).length < 32) throw new Error('Falta la clave');
  if (!clave) setConfig('CLAVE_CENTRAL', req.clave, 'ROMO CENTRAL (Modal). No compartir.');
  else if (clave !== req.clave) throw new Error('Clave incorrecta');
  asegurarCentral();
  const op = req.op;
  if (op === 'equipo') return { ok: true, equipo: leerTabla(EQUIPO_SHEET) };
  if (op === 'entro') return entroAlguien(req.correo, req.nombre);
  if (op === 'subidas') return { ok: true, subidas: leerSubidas() };
  if (op === 'subida_nueva') return subidaNueva(req.subida || {});
  if (op === 'subida_cambiar') return subidaCambiar(req.id, req.campos || {});
  if (op === 'repartir') return repartir(req.editor, !!req.mas);
  if (op === 'registrar_cambio') return registrarCambio(req);
  if (op === 'categorias') return { ok: true, categorias: leerCategorias() };
  if (op === 'categoria_nueva') return categoriaNueva(req.nombre, req.prefijo);
  if (op === 'registrar_video') return registrarVideo(req);
  if (op === 'columnas_redes') return agregarColumnasRedes();
  if (op === 'guiones_reemplazar') return guionesReemplazar(req.borrar || [], req.nuevos || []);
  throw new Error('Operación desconocida: ' + op);
}

// Crea EQUIPO, SUBIDAS y la columna SUBIÓ en VIDEOS si faltan. No toca nada que ya exista.
function asegurarCentral() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let eq = ss.getSheetByName(EQUIPO_SHEET);
  if (!eq) {
    eq = ss.insertSheet(EQUIPO_SHEET);
    eq.getRange(1, 1, 1, EQUIPO_HEADS.length).setValues([EQUIPO_HEADS]).setFontWeight('bold');
    eq.getRange(2, 1, EQUIPO_INICIAL.length, EQUIPO_HEADS.length).setValues(EQUIPO_INICIAL);
    eq.getRange('C2:C').setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(ROLES, true).build());
    eq.getRange('D2:D').setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['SI', 'NO'], true).build());
    eq.setFrozenRows(1);
  }
  let su = ss.getSheetByName(SUBIDAS_SHEET);
  if (!su) {
    su = ss.insertSheet(SUBIDAS_SHEET);
    su.getRange(1, 1, 1, SUBIDA_COLS.length).setValues([SUBIDA_COLS.map(c => c[1])]).setFontWeight('bold');
    su.getRange('G2:G').setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(SUBIDA_ESTADOS, true).build());
    su.setFrozenRows(1);
  }
  const v = getSheet();
  ['SUBIÓ'].concat(COLS_NUEVAS).forEach(h => {
    const heads = v.getRange(1, 1, 1, v.getLastColumn()).getValues()[0].map(normHead);
    if (heads.indexOf(normHead(h)) < 0) v.getRange(1, v.getLastColumn() + 1).setValue(h).setFontWeight('bold');
  });
}

// Filas de una pestaña como objetos { ENCABEZADO: valor } (encabezados normalizados, sin tildes).
function leerTabla(nombre) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nombre);
  if (!sh || sh.getLastRow() < 2) return [];
  const data = sh.getDataRange().getValues();
  const cab = data[0].map(normHead);
  return data.slice(1).filter(f => f.some(c => String(c).trim())).map(f => {
    const o = {}; cab.forEach((h, i) => { if (h) o[h] = celdaHora(f[i]); }); return o;
  });
}
const celdaHora = val => val instanceof Date ? val.toISOString() : String(val == null ? '' : val);

function entroAlguien(correo, nombre) {
  correo = String(correo || '').toLowerCase().trim();
  if (!correo) throw new Error('Sin correo');
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(EQUIPO_SHEET);
  const data = sh.getDataRange().getValues();
  for (let r = 1; r < data.length; r++) {
    if (String(data[r][1]).toLowerCase().trim() === correo) {
      sh.getRange(r + 1, 5).setValue(new Date());
      return { ok: true, nuevo: false };
    }
  }
  sh.appendRow([String(nombre || correo.split('@')[0]).toUpperCase(), correo, 'SUBIDOR', 'SI', new Date()]);
  return { ok: true, nuevo: true };
}

function hojaSubidas() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SUBIDAS_SHEET);
  const cab = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(normHead);
  const col = {};
  SUBIDA_COLS.forEach(([f, h]) => { const i = cab.indexOf(normHead(h)); if (i >= 0) col[f] = i; });
  return { sh, col, ancho: cab.length };
}

function leerSubidas() {
  const { sh, col } = hojaSubidas();
  if (sh.getLastRow() < 2) return [];
  return sh.getDataRange().getValues().slice(1).filter(f => String(f[col.id] || '').trim()).map(f => {
    const o = {}; SUBIDA_COLS.forEach(([c]) => { o[c] = col[c] != null ? celdaHora(f[col[c]]) : ''; }); return o;
  });
}

function filaSubida(sh, col, id) {
  if (sh.getLastRow() < 2) return 0;
  const ids = sh.getRange(2, col.id + 1, sh.getLastRow() - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) if (String(ids[i][0]) === String(id)) return i + 2;
  return 0;
}

function subidaNueva(s) {
  const { sh, col, ancho } = hojaSubidas();
  if (!s.id) throw new Error('Subida sin ID');
  if (filaSubida(sh, col, s.id)) return { ok: true, id: s.id, repetida: true };
  const fila = new Array(ancho).fill('');
  s.fecha = new Date(); s.estado = s.estado || 'PREPARANDO';
  SUBIDA_COLS.forEach(([c]) => { if (col[c] != null && s[c] != null) fila[col[c]] = s[c]; });
  sh.appendRow(fila);
  return { ok: true, id: s.id };
}

function subidaCambiar(id, campos) {
  const { sh, col } = hojaSubidas();
  const r = filaSubida(sh, col, id);
  if (!r) throw new Error('No existe la subida ' + id);
  if (campos.estado && SUBIDA_ESTADOS.indexOf(campos.estado) < 0) throw new Error('Estado no válido: ' + campos.estado);
  Object.keys(campos).forEach(c => {
    if (col[c] == null || c === 'id') return;
    sh.getRange(r, col[c] + 1).setValue(c === 'tomado' && campos[c] === 'ahora' ? new Date() : campos[c]);
  });
  return { ok: true, id: id };
}

// Reparto justo y escalable: cada editor activo se queda con su parte de lo abierto
// (ceil(abiertos / editores)). Si faltan editores, lo demás espera en la bolsa;
// con «mas» se lleva lo que quede. Lo tomado y olvidado 48 h vuelve a la bolsa.
function repartir(editor, mas) {
  editor = String(editor || '').toUpperCase().trim();
  if (!editor) throw new Error('Falta el editor');
  const { sh, col } = hojaSubidas();
  if (sh.getLastRow() < 2) return { ok: true, mios: [], libres: 0, editores: 0 };
  const data = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  const ahora = Date.now();
  const editores = leerTabla(EQUIPO_SHEET)
    .filter(e => e.ROL === 'EDITOR' && e.ACTIVO !== 'NO').map(e => String(e.NOMBRE).toUpperCase());
  if (editores.indexOf(editor) < 0) editores.push(editor);  // un admin que edita también cuenta
  const abierto = f => ABIERTOS.indexOf(String(f[col.estado])) >= 0;
  data.forEach((f, i) => {
    if (String(f[col.estado]) !== 'PARA EDITAR' || !f[col.editor]) return;
    const t = f[col.tomado] instanceof Date ? f[col.tomado].getTime() : 0;
    if (t && ahora - t > LIBERAR_HORAS * 3600e3) {
      sh.getRange(i + 2, col.editor + 1).setValue(''); f[col.editor] = '';
    }
  });
  const total = data.filter(abierto).length;
  const mios = data.filter(f => abierto(f) && String(f[col.editor]).toUpperCase() === editor).length;
  const libres = data.map((f, i) => [f, i]).filter(([f]) => String(f[col.estado]) === 'PARA EDITAR' && !f[col.editor]);
  // Más viejo primero: lo que lleva más tiempo esperando se edita antes.
  libres.sort((a, b) => new Date(a[0][col.fecha]) - new Date(b[0][col.fecha]));
  const cupo = mas ? libres.length : Math.max(0, Math.ceil(total / editores.length) - mios);
  libres.slice(0, cupo).forEach(([f, i]) => {
    sh.getRange(i + 2, col.editor + 1).setValue(editor);
    sh.getRange(i + 2, col.tomado + 1).setValue(new Date());
  });
  return { ok: true, tomados: Math.min(cupo, libres.length), libres: Math.max(0, libres.length - cupo), editores: editores.length };
}

// Al aprobar: siguiente código libre de la categoría + fila en VIDEOS + subida en LISTO. Todo bajo el candado de doPost.
function registrarCambio(req) {
  const cat = String(req.categoria || '').toUpperCase();
  const pc = PREFIJO_CAT[cat];
  if (!pc) throw new Error('Categoría no válida: ' + cat);
  const v = getSheet(), m = colMap(v);
  let top = 0;
  if (v.getLastRow() > 1) v.getRange(2, m.nombre + 1, v.getLastRow() - 1, 1).getValues().forEach(f => {
    const x = String(f[0] || '').trim().match(pc[1]); if (x) top = Math.max(top, +x[1]);
  });
  const codigo = pc[0] + String(top + 1).padStart(3, '0');
  const fila = new Array(v.getLastColumn()).fill('');
  const t = new Date();
  const vals = {
    id: 'v' + t.getTime(), nombre: codigo, categoria: cat, estado: 'PENDIENTE',
    creador: String(req.editor || '').toUpperCase(),
    fecha: t.getDate() + ' de ' + ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto',
      'septiembre', 'octubre', 'noviembre', 'diciembre'][t.getMonth()] + ' ' + t.getFullYear(),
    link: req.link || '', created_at: t.toISOString(),
  };
  FIELDS.forEach(f => { if (m[f] != null && vals[f] != null) fila[m[f]] = vals[f]; });
  const heads = v.getRange(1, 1, 1, v.getLastColumn()).getValues()[0].map(normHead);
  const iSubio = heads.indexOf(normHead('SUBIÓ'));
  if (iSubio >= 0) fila[iSubio] = String(req.subio || '');
  v.appendRow(fila);
  if (req.subida) subidaCambiar(req.subida, { estado: 'LISTO', codigo: codigo, categoria: cat });
  return { ok: true, codigo: codigo, id: vals.id };
}

// ===========================================================================
// CATEGORÍAS y VIDEOS ESPECIALES (20-10-2026): «Registrar videos» de ROMO EDITS
// ===========================================================================
// Las categorías viven en LISTAS (columna A = CATEGORÍA, B = PREFIJO). Agregar una aquí la pone en los menús de VIDEOS.
function leerCategorias() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(LISTAS_SHEET);
  if (!sh || sh.getLastRow() < 2) return CATEGORIAS.map(([c, p]) => ({ categoria: c, prefijo: p }));
  return sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues()
    .filter(f => String(f[0]).trim() && String(f[1]).trim())
    .map(f => ({ categoria: String(f[0]).trim().toUpperCase(), prefijo: String(f[1]).trim().toUpperCase() }));
}

function categoriaNueva(nombre, prefijo) {
  nombre = String(nombre || '').trim().toUpperCase();
  prefijo = String(prefijo || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!nombre || !prefijo) throw new Error('Falta el nombre o el prefijo');
  if (prefijo.length > 5) throw new Error('El prefijo es de 2 a 5 letras (ej. POD)');
  const cats = leerCategorias();
  if (cats.some(c => c.categoria === nombre)) throw new Error('Ya existe la categoría ' + nombre);
  if (cats.some(c => c.prefijo === prefijo)) throw new Error('El prefijo ' + prefijo + ' ya es de otra categoría');
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(LISTAS_SHEET);
  const col = sh.getRange(2, 1, Math.max(sh.getLastRow() - 1, 1), 1).getValues();
  let fila = col.findIndex(f => !String(f[0]).trim());
  fila = fila < 0 ? sh.getLastRow() + 1 : fila + 2;
  sh.getRange(fila, 1, 1, 2).setValues([[nombre, prefijo]]);
  return { ok: true, categoria: nombre, prefijo: prefijo };
}

// Siguiente código libre de la categoría (mira VIDEOS y las pestañas de guiones) + fila PENDIENTE en VIDEOS.
function registrarVideo(req) {
  const cat = String(req.categoria || '').trim().toUpperCase();
  const c = leerCategorias().find(x => x.categoria === cat);
  if (!c) throw new Error('Categoría no válida: ' + cat);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let top = 0;
  if (PREFIJO_CAT[cat]) {
    const v0 = getSheet(), m0 = colMap(v0);
    if (v0.getLastRow() > 1) v0.getRange(2, m0.nombre + 1, v0.getLastRow() - 1, 1).getValues().forEach(f => {
      const x = String(f[0] || '').trim().match(PREFIJO_CAT[cat][1]); if (x) top = Math.max(top, +x[1]);
    });
  } else {
    top = ultimoNumero(ss, c.prefijo);
  }
  const codigo = c.prefijo + String(top + 1).padStart(3, '0');
  const v = getSheet(), m = colMap(v);
  const t = new Date();
  const fila = new Array(v.getLastColumn()).fill('');
  const vals = {
    id: 'v' + t.getTime() + Math.floor(Math.random() * 1000), nombre: codigo, categoria: cat, estado: 'PENDIENTE',
    creador: String(req.editor || '').toUpperCase(), fecha: Utilities.formatDate(t, 'America/Guayaquil', 'yyyy-MM-dd'),
    link: req.link || '', notas: String(req.notas || ''), created_at: t.toISOString(),
  };
  FIELDS.forEach(f => { if (m[f] != null && vals[f] != null) fila[m[f]] = vals[f]; });
  const heads = v.getRange(1, 1, 1, v.getLastColumn()).getValues()[0].map(normHead);
  const iSubio = heads.indexOf(normHead('SUBIÓ'));
  if (iSubio >= 0) fila[iSubio] = String(req.subio || '');
  v.appendRow(fila);
  return { ok: true, codigo: codigo, id: vals.id };
}

// ===========================================================================
// COLUMNAS DE REDES (21-10-2026) — correr UNA vez (o desde ROMO CENTRAL con la acción central «columnas_redes»)
// ===========================================================================
// Crea al FINAL de VIDEOS las que falten: INSTAGRAM, ACTUALIZADO y los bloques TT / IG / FB. No mueve ni renombra nada.
// Formato: *ID como TEXTO (los de TikTok tienen 19 dígitos), ACTUALIZADO y *PUBLICADO como fecha yyyy-mm-dd, el resto número.
function agregarColumnasRedes() {
  const v = getSheet();
  const filas = Math.max(v.getMaxRows() - 1, 1);
  const creadas = [];
  ['INSTAGRAM'].concat(COLS_REDES.map(c => c[1])).forEach(h => {
    const heads = v.getRange(1, 1, 1, v.getLastColumn()).getValues()[0].map(normHead);
    let i = heads.indexOf(normHead(h));
    if (i < 0) {
      i = v.getLastColumn();
      v.getRange(1, i + 1).setValue(h).setFontWeight('bold');
      creadas.push(h);
    }
    const cuerpo = v.getRange(2, i + 1, filas, 1);
    if (/ ID$/.test(h)) cuerpo.setNumberFormat('@');
    else if (h === 'ACTUALIZADO' || / PUBLICADO$/.test(h)) cuerpo.setNumberFormat('yyyy-mm-dd');
    else if (h !== 'INSTAGRAM') cuerpo.setNumberFormat('0');
  });
  return { ok: true, creadas: creadas };
}

// ===========================================================================
// GUIONES DESDE CLAUDE (22-10-2026): borrar guiones sin hacer y cargar una tanda nueva, sin tocar la hoja a mano.
// ===========================================================================
// borrar: códigos a quitar (solo si NO están hechos). nuevos: [{linea: 'VIRAL'|'EA'|'MDT', <Encabezado>: valor…}].
// Cada nuevo recibe el siguiente CÓDIGO libre de su línea (mira VIDEOS y las pestañas, como asignarCodigos).
// Si un encabezado no existe en la pestaña (Presentador, Gente, Notas…), se agrega al final.
function guionesReemplazar(borrar, nuevos) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const quitar = borrar.map(c => String(c).trim().toUpperCase());
  const borrados = [], saltados = [];
  LINEAS_IA.forEach(l => {
    const sh = hojaGuion(ss, l);
    if (sh.getLastRow() < 2) return;
    const cab = cabGuion(sh), iC = cab.indexOf('CODIGO'), iE = cab.indexOf('ESTADO');
    const data = sh.getRange(2, 1, sh.getLastRow() - 1, cab.length).getValues();
    for (let r = data.length - 1; r >= 0; r--) {
      const cod = String(data[r][iC] || '').trim().toUpperCase();
      if (quitar.indexOf(cod) < 0) continue;
      if (String(data[r][iE] || '').toLowerCase() === 'hecho') { saltados.push(cod); continue; }
      sh.deleteRow(r + 2); borrados.push(cod);
    }
  });
  const cargados = [];
  const tops = {};
  nuevos.forEach(n => {
    const l = LINEAS_IA.find(x => x.linea === String(n.linea || '').toUpperCase());
    if (!l) throw new Error('Línea no válida: ' + n.linea);
    const sh = hojaGuion(ss, l);
    let cab = cabGuion(sh);
    Object.keys(n).forEach(k => {
      if (k === 'linea' || cab.indexOf(normHead(k)) >= 0) return;
      sh.getRange(1, sh.getLastColumn() + 1).setValue(k).setFontWeight('bold');
      cab = cabGuion(sh);
    });
    // Con «CÓDIGO»: se rehace ESE guion en su misma fila (mismo número, vuelve a «listo»). Nunca toca uno «hecho».
    const pedido = String(n['CÓDIGO'] || n['CODIGO'] || '').trim().toUpperCase();
    if (pedido) {
      const iC = cab.indexOf('CODIGO'), iE = cab.indexOf('ESTADO');
      const data = sh.getRange(2, 1, Math.max(1, sh.getLastRow() - 1), cab.length).getValues();
      const r = data.findIndex(f => String(f[iC] || '').trim().toUpperCase() === pedido);
      if (r < 0) throw new Error('No existe el guion ' + pedido + ' en ' + l.hoja);
      if (String(data[r][iE] || '').toLowerCase() === 'hecho') { saltados.push(pedido); return; }
      const fila = new Array(cab.length).fill('');
      Object.keys(n).forEach(k => { const i = cab.indexOf(normHead(k)); if (i >= 0 && k !== 'linea') fila[i] = n[k]; });
      fila[iC] = pedido;
      if (iE >= 0) fila[iE] = 'listo';
      sh.getRange(r + 2, 1, 1, cab.length).setValues([fila]);
      cargados.push({ codigo: pedido, titulo: n['Título'] || '', reemplazado: true });
      return;
    }
    if (tops[l.prefijo] == null) tops[l.prefijo] = ultimoNumero(ss, l.prefijo);
    tops[l.prefijo]++;
    const codigo = l.prefijo + String(tops[l.prefijo]).padStart(3, '0');
    const fila = new Array(cab.length).fill('');
    Object.keys(n).forEach(k => { const i = cab.indexOf(normHead(k)); if (i >= 0 && k !== 'linea') fila[i] = n[k]; });
    fila[cab.indexOf('CODIGO')] = codigo;
    if (cab.indexOf('ESTADO') >= 0 && !fila[cab.indexOf('ESTADO')]) fila[cab.indexOf('ESTADO')] = 'listo';
    sh.appendRow(fila);
    cargados.push({ codigo: codigo, titulo: n['Título'] || '' });
  });
  return { ok: true, borrados: borrados, saltados: saltados, cargados: cargados };
}
