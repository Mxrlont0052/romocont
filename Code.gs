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
const FIELDS = ['id','tanda','fecha','categoria','nombre','estado','creador','link','notas','vistas','created_at'];

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
      if (!data[r][0]) continue; // sin ID = fila vacía
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
