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
// Orden exacto de columnas en el Sheet:
// link = archivo en la nube ROMO (lo maneja nube-sync) · tiktok = link del video publicado (lo maneja el equipo)
const FIELDS = ['id','tanda','fecha','categoria','nombre','estado','creador','link','notas','vistas','created_at','descripcion','tiktok'];

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
      // No sobrescribir created_at
      const current = sheet.getRange(row, 1, 1, FIELDS.length).getValues()[0];
      const values = FIELDS.map((f, i) =>
        f === 'created_at' ? current[i] : (v[f] == null ? '' : String(v[f])));
      sheet.getRange(row, 1, 1, FIELDS.length).setValues([values]);
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
        const values = FIELDS.map((f, i) =>
          f === 'created_at' ? current[i] : (v[f] == null ? '' : String(v[f])));
        sheet.getRange(row, 1, 1, FIELDS.length).setValues([values]);
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

    throw new Error('Acción desconocida: ' + req.action);
  } catch (err) {
    return jsonOut({ error: err.message });
  } finally {
    lock.releaseLock();
  }
}

function findRowById(sheet, id) {
  if (!id) return 0;
  const ids = sheet.getRange(1, 1, sheet.getLastRow(), 1).getValues();
  for (let r = 1; r < ids.length; r++) {
    if (String(ids[r][0]) === String(id)) return r + 1; // fila 1-indexed
  }
  return 0;
}
