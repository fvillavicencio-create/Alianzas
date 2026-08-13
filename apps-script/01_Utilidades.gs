/** Helpers genéricos usados por el resto de los módulos. */

function ss_() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function sheet_(name) {
  const sh = ss_().getSheetByName(name);
  if (!sh) throw new Error(`No se encontró la pestaña "${name}".`);
  return sh;
}

/** Última fila con datos reales en la columna A (ignora filas vacías al final). */
function lastDataRow_(sheet) {
  const values = sheet.getRange(1, 1, sheet.getMaxRows(), 1).getValues();
  for (let r = values.length - 1; r >= 1; r--) {
    if (values[r][0] !== '' && values[r][0] !== null) return r + 1;
  }
  return 1; // solo encabezado
}

/** Genera el siguiente ID consecutivo tipo PREFIJO-000123 buscando el máximo actual. */
function nextId_(sheet, column, prefix, padLength) {
  const lastRow = lastDataRow_(sheet);
  let max = 0;
  if (lastRow >= 2) {
    const vals = sheet.getRange(2, column, lastRow - 1, 1).getValues();
    vals.forEach(row => {
      const v = String(row[0] || '');
      if (v.indexOf(prefix) === 0) {
        const n = parseInt(v.substring(prefix.length), 10);
        if (!isNaN(n) && n > max) max = n;
      }
    });
  }
  const next = max + 1;
  return prefix + String(next).padStart(padLength, '0');
}

function extractSpreadsheetId_(urlOrId) {
  const s = String(urlOrId || '').trim();
  const m = s.match(/\/d\/([a-zA-Z0-9-_]+)/);
  return m ? m[1] : s;
}

function nowStamp_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'America/Mexico_City',
    'yyyy-MM-dd HH:mm:ss');
}

function logSync_(tipo, procesados, errores, noEncontrados, detalle) {
  const cfg = sheet_(SHEETS.CONFIG);
  const block = findConfigBlock_(cfg, 'Registro de sincronizaciones');
  const row = block.headerRow + 1 + block.rows.length;
  cfg.getRange(row, 1, 1, 6).setValues([[nowStamp_(), tipo, procesados, errores, noEncontrados, detalle]]);
}

function toast_(msg, title) {
  ss_().toast(msg, title || 'Regcheq CRM', 8);
}
