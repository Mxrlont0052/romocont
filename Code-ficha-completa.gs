/**
 * CONTENT TEAM ROMO — Backend en Google Sheets
 * El Google Sheet es la base de datos. La página en GitHub Pages
 * lee y escribe aquí a través de este Web App.
 *
 * INSTALACIÓN:
 * 1. Crea un Google Sheet nuevo llamado "ROMO Content"
 * 2. Archivo → Importar → Subir → data_limpia.csv → "Reemplazar hoja actual"
 * 3. Renombra la pestaña a: VIDEOS
 * 4. Extensiones → Apps Script → borra todo y pega este código → Guardar
 * 5. Desplegar → Nueva implementación → tipo "Aplicación web"
 *    - Ejecutar como: Yo
 *    - Acceso: Cualquier usuario
 * 6. Copia la URL del Web App (termina en /exec) y pégala en index.html
 *    donde dice PEGA_AQUI_LA_URL_DEL_APPS_SCRIPT
 */

const SHEET_NAME = 'VIDEOS';

// Carpetas del Drive de 5TB (ROMOCONT/). Solo LISTOS genera links en la hoja:
// el SV es material de trabajo, no algo que el equipo baje para publicar.
const DRIVE_LISTOS = '1RkbNGYLg6RZaTDhCs7sxThXwMJc-T767'; // VIDEOS LISTOS PARA SUBIR
const DRIVE_SINVOZ = '1EwH6F6YbSBHkoCqHfnp9jLI3nD79HN8L'; // VIDEOS SIN VOZ
// Orden exacto de columnas en el Sheet:
// link = archivo en la nube ROMO (lo maneja nube-sync) · tiktok = link del video publicado (lo maneja el equipo)
// tema / formato / oferta = la ficha del video para saber de dónde vienen los leads (12-10-2026).
// Van AL FINAL para que las columnas viejas no se muevan.
const FIELDS = ['id','tanda','fecha','categoria','nombre','estado','creador','link','notas','vistas','created_at','descripcion','tiktok','tema','formato','oferta'];
const HEADERS_NUEVOS = { tema: 'TEMA', formato: 'FORMATO', oferta: 'OFERTA' };

// Pone el encabezado de las columnas nuevas si todavía no existe. No toca nada más.
function asegurarEncabezados(sheet) {
  const faltan = FIELDS.length - sheet.getMaxColumns();
  if (faltan > 0) sheet.insertColumnsAfter(sheet.getMaxColumns(), faltan);
  FIELDS.forEach((f, i) => {
    if (!HEADERS_NUEVOS[f]) return;
    const cell = sheet.getRange(1, i + 1);
    if (!String(cell.getValue()).trim()) cell.setValue(HEADERS_NUEVOS[f]);
  });
}

// Un campo que NO viene en el pedido se conserva (antes se borraba). Así la
// página vieja, ROMO CAMBIOS o nube-sync no pisan la ficha nueva al guardar.
function mezclarFila(current, v) {
  return FIELDS.map((f, i) =>
    f === 'created_at' || v[f] === undefined ? (current[i] == null ? '' : current[i])
      : (v[f] == null ? '' : String(v[f])));
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

// ===== GET: devolver todos los videos =====
function doGet() {
  try {
    const sheet = getSheet();
    const data = sheet.getDataRange().getValues();
    const videos = [];
    for (let r = 1; r < data.length; r++) {
      // Fila totalmente vacía: ignorar
      if (!data[r][3] && !data[r][4]) continue; // sin categoría ni nombre
      // Fila agregada a mano en el Sheet sin ID: asignarle uno automáticamente
      if (!data[r][0]) {
        const newId = 'v' + Date.now() + '_' + r;
        sheet.getRange(r + 1, 1).setValue(newId);
        data[r][0] = newId;
      }
      const v = {};
      FIELDS.forEach((f, i) => {
        let val = data[r][i];
        // El Sheet convierte fechas a Date: devolver como YYYY-MM-DD
        if (val instanceof Date) val = Utilities.formatDate(val, 'America/Guayaquil', 'yyyy-MM-dd');
        v[f] = String(val == null ? '' : val);
      });
      videos.push(v);
    }
    return jsonOut(videos);
  } catch (e) {
    return jsonOut({ error: e.message });
  }
}

// ===== POST: insert / update / delete =====
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000); // evita escrituras simultáneas (el bug de duplicados)
  try {
    const req = JSON.parse(e.postData.contents);
    const sheet = getSheet();
    asegurarEncabezados(sheet);

    if (req.action === 'insert') {
      const v = req.video || {};
      if (!v.id) throw new Error('Video sin ID');
      if (findRowById(sheet, v.id)) throw new Error('ID duplicado: ' + v.id);
      v.created_at = new Date().toISOString();
      sheet.appendRow(FIELDS.map(f => v[f] == null ? '' : String(v[f])));
      return jsonOut({ ok: true, action: 'insert', id: v.id });
    }

    if (req.action === 'update') {
      const v = req.video || {};
      const row = findRowById(sheet, v.id);
      if (!row) throw new Error('No existe el video ' + v.id);
      // No sobrescribir created_at ni lo que no venga en el pedido
      const current = sheet.getRange(row, 1, 1, FIELDS.length).getValues()[0];
      sheet.getRange(row, 1, 1, FIELDS.length).setValues([mezclarFila(current, v)]);
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
      for (let r = 1; r < data.length; r++) rowById[String(data[r][0])] = r + 1;
      list.forEach(v => {
        const row = rowById[String(v.id)];
        if (!row) return;
        const current = sheet.getRange(row, 1, 1, FIELDS.length).getValues()[0];
        sheet.getRange(row, 1, 1, FIELDS.length).setValues([mezclarFila(current, v)]);
        updated++;
      });
      return jsonOut({ ok: true, action: 'bulk', updated: updated });
    }

    if (req.action === 'nube') {
      // La Air manda la lista de archivos que hay en la nube; Google hace el cruce.
      // items = [{n:'ED001.mp4', u:'https://.../ED001.mp4'}, ...]
      const items = req.items || [];
      const data = sheet.getDataRange().getValues();
      const linkCol = FIELDS.indexOf('link') + 1; // columna LINK
      // normaliza para cruzar: MAYUS y sin espacios ("RLL 034" == "RLL034")
      const norm = s => String(s || '').toUpperCase().replace(/\s+/g, '');
      const map = {};
      items.forEach(it => {
        const dot = it.n.lastIndexOf('.');
        const code = norm(dot >= 0 ? it.n.slice(0, dot) : it.n);
        if (code) map[code] = it.u;
      });
      let linked = 0, configRow = 0;
      for (let r = 1; r < data.length; r++) {
        if (String(data[r][0]) === 'CONFIG_NUBE') { configRow = r + 1; continue; }
        const code = norm(data[r][4]); // NOMBRE
        if (code && map[code] && data[r][linkCol - 1] !== map[code]) {
          sheet.getRange(r + 1, linkCol).setValue(map[code]);
          linked++;
        }
      }
      // Guardar el link de SUBIR AQUI para el botón 📤 de la página
      if (req.inbox) {
        if (configRow) {
          sheet.getRange(configRow, linkCol).setValue(req.inbox);
        } else {
          sheet.appendRow(FIELDS.map(f =>
            f === 'id' ? 'CONFIG_NUBE' : f === 'nombre' ? 'CONFIG NUBE' : f === 'link' ? req.inbox : ''));
        }
      }
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
// DRIVE — el robot que mantiene la columna LINK al día
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
  const linkCol = FIELDS.indexOf('link') + 1;
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
    if (String(data[r][0]) === 'CONFIG_NUBE') continue;
    const code = normCodigo(data[r][4]); // NOMBRE
    const actual = String(data[r][linkCol - 1] || '');
    const nuevo = code ? porCodigo[code] : null;
    if (nuevo) {
      if (actual !== nuevo) { sheet.getRange(r + 1, linkCol).setValue(nuevo); escritos++; }
    } else if (esLinkMuerto(actual)) {
      // El archivo no está en Drive y el link apunta a la nube vieja: dejarlo
      // en blanco hace que el dashboard muestre "📤 subir" en vez de un ⬇ que
      // falla. Un link de Drive sin archivo NO se toca: puede estar en otra
      // carpeta y borrarlo perdería información buena.
      sheet.getRange(r + 1, linkCol).setValue(''); limpiados++;
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
  const linkCol = FIELDS.indexOf('link') + 1;
  const data = sheet.getDataRange().getValues();
  let n = 0;
  for (let r = 1; r < data.length; r++) {
    if (esLinkMuerto(data[r][linkCol - 1])) { sheet.getRange(r + 1, linkCol).setValue(''); n++; }
  }
  // La fila CONFIG_NUBE guardaba el link del "SUBIR AQUI" del túnel: ahora el
  // destino es la carpeta de Drive, y la página la lee de ahí igual que antes.
  const cfgRow = data.findIndex(f => String(f[0]) === 'CONFIG_NUBE');
  const inbox = 'https://drive.google.com/drive/folders/' + DRIVE_LISTOS;
  if (cfgRow > 0) sheet.getRange(cfgRow + 1, linkCol).setValue(inbox);
  else sheet.appendRow(FIELDS.map(f =>
    f === 'id' ? 'CONFIG_NUBE' : f === 'nombre' ? 'CONFIG NUBE' : f === 'link' ? inbox : ''));
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
  const ids = sheet.getRange(1, 1, sheet.getLastRow(), 1).getValues();
  for (let r = 1; r < ids.length; r++) {
    if (String(ids[r][0]) === String(id)) return r + 1; // fila 1-indexed
  }
  return 0;
}
