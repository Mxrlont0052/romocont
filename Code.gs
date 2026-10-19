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
];
const FIELDS = COLS.map(c => c[0]);

// Lo que aparece en los menús de LISTAS la primera vez (después se editan en la hoja).
const CATEGORIAS = [
  ['ESTUDIANTES', 'ES'], ['DEMOSTRATIVAS', 'DM'], ['RELLENO', 'RLL'], ['ROMO ROOM', 'RR'],
  ['ROMO DJS', 'RDJ'], ['IA INFORMATIVO', 'IA'], ['MINISTERIO DE TRABAJO', 'MDT'],
  ['EDICION DE AUDIO', 'EA'], ['PEDRO ROMO', 'PDR'], ['VIDEOS 360', '360'],
];
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
const normHead = s => String(s || '').toUpperCase().trim()
  .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ');

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
  // El Sheet convierte fechas a Date: devolver como YYYY-MM-DD
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

// ===== GET: devolver todos los videos =====
function doGet() {
  try {
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
function escribirFila(sheet, m, row, v) {
  const ancho = sheet.getLastColumn();
  const rango = sheet.getRange(row, 1, 1, ancho);
  const actual = rango.getValues()[0];
  FIELDS.forEach(f => {
    if (m[f] == null || f === 'created_at' || f === 'id') return;
    if (v[f] === undefined) return;
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
        escribirFila(sheet, m, row, aliasEntrada(v));
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

    if (req.action === 'drive') {
      // Sincronización a pedido desde el botón de la página.
      return jsonOut(sincronizarDrive());
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
