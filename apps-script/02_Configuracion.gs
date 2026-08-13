/**
 * Lector genérico de bloques de la pestaña CONFIGURACIÓN.
 *
 * CONFIGURACIÓN no tiene una sola tabla: es una serie de bloques apilados,
 * cada uno con un subtítulo en la columna A, seguido de una fila de
 * encabezados y sus filas de datos hasta la primera fila en blanco. Buscamos
 * el bloque POR TEXTO en vez de por número de fila fijo, para que el usuario
 * pueda reordenar/agregar bloques en CONFIGURACIÓN sin romper el código.
 */
function findConfigBlock_(sheet, labelText) {
  const lastRow = sheet.getLastRow();
  const colA = sheet.getRange(1, 1, lastRow, 1).getValues();
  let labelRow = -1;
  for (let r = 0; r < colA.length; r++) {
    if (String(colA[r][0]).trim() === labelText) { labelRow = r + 1; break; }
  }
  if (labelRow === -1) throw new Error(`No se encontró el bloque "${labelText}" en CONFIGURACIÓN.`);

  const headerRow = labelRow + 1;
  const lastCol = sheet.getLastColumn();
  const headers = sheet.getRange(headerRow, 1, 1, lastCol).getValues()[0]
    .map(h => String(h).trim());
  let width = headers.length;
  while (width > 0 && headers[width - 1] === '') width--;

  const rows = [];
  let r = headerRow + 1;
  while (r <= lastRow) {
    const rowVals = sheet.getRange(r, 1, 1, width).getValues()[0];
    if (rowVals[0] === '' || rowVals[0] === null) break;
    rows.push(rowVals);
    r++;
  }
  return { headerRow, headers: headers.slice(0, width), rows };
}

function blockToObjects_(block) {
  return block.rows.map(row => {
    const obj = {};
    block.headers.forEach((h, i) => { obj[h] = row[i]; });
    return obj;
  });
}

function getSdrList_() {
  const block = findConfigBlock_(sheet_(SHEETS.CONFIG), 'SDR (Sales Development Representatives)');
  return blockToObjects_(block)
    .filter(o => String(o['Activo']).trim() === 'Sí')
    .map(o => ({ nombre: String(o['Nombre']).trim(), ownerId: String(o['HubSpot Owner ID']).trim() }));
}

function getColumnSynonyms_() {
  const block = findConfigBlock_(sheet_(SHEETS.CONFIG), 'Sinónimos de columnas para importación');
  const map = {}; // sinónimo normalizado -> campo canónico
  blockToObjects_(block).forEach(o => {
    const canonico = String(o['Campo canónico']).trim();
    String(o['Sinónimos (separados por coma)']).split(',').forEach(s => {
      const key = normalizeHeader_(s);
      if (key) map[key] = canonico;
    });
    map[normalizeHeader_(canonico)] = canonico;
  });
  return map;
}

function normalizeHeader_(h) {
  return String(h || '').trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quita acentos
    .replace(/[^a-z0-9]/g, '');
}

function getDealstageMap_() {
  const block = findConfigBlock_(sheet_(SHEETS.CONFIG), 'Mapeo de Dealstage → Estatus comercial');
  const map = {}; // stageId -> estatus mapeado
  blockToObjects_(block).forEach(o => {
    map[String(o['Stage ID']).trim()] = String(o['Estatus mapeado']).trim();
  });
  return map;
}

function getHubspotPropertiesConfig_() {
  const block = findConfigBlock_(sheet_(SHEETS.CONFIG), 'Propiedades HubSpot a consultar');
  const map = {};
  blockToObjects_(block).forEach(o => {
    map[String(o['Objeto']).trim()] = String(o['Propiedades (separadas por coma)']).trim()
      .split(',').map(s => s.trim()).filter(Boolean);
  });
  return map;
}

function getAlertThresholds_() {
  const cfg = sheet_(SHEETS.CONFIG);
  const colA = cfg.getRange(1, 1, cfg.getLastRow(), 2).getValues();
  let amarillo = 7, rojo = 21;
  colA.forEach(row => {
    if (String(row[0]).indexOf('alerta 🟡') !== -1) amarillo = Number(row[1]) || amarillo;
    if (String(row[0]).indexOf('alerta 🔴') !== -1) rojo = Number(row[1]) || rojo;
  });
  return { amarillo, rojo };
}

function getPortalId_() {
  const cfg = sheet_(SHEETS.CONFIG);
  const colA = cfg.getRange(1, 1, cfg.getLastRow(), 2).getValues();
  for (const row of colA) {
    if (String(row[0]).trim() === 'Portal ID') return String(row[1]).trim();
  }
  throw new Error('No se encontró "Portal ID" en CONFIGURACIÓN.');
}
