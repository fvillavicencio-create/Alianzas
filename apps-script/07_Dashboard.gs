/**
 * El DASHBOARD es 100% fórmulas (COUNTIFS/SUMIFS/INDEX-MATCH) — no requiere
 * botón para "calcularse". Esta función solo fuerza un recálculo y dejar
 * constancia de cuándo se pidió, para que Marketing/Alianzas sepan que los
 * números ya reflejan lo último importado/sincronizado.
 */
function actualizarDashboard() {
  SpreadsheetApp.flush();
  const db = sheet_(SHEETS.DASHBOARD);
  db.getRange('A2').setValue(
    `Vista ejecutiva Marketing y Alianzas — última actualización solicitada: ${nowStamp_()}`);
  toast_('Dashboard recalculado.');
}

function verUltimaSincronizacion() {
  const cfg = sheet_(SHEETS.CONFIG);
  const block = findConfigBlock_(cfg, 'Registro de sincronizaciones');
  if (!block.rows.length) {
    SpreadsheetApp.getUi().alert('Aún no se ha corrido ninguna sincronización con HubSpot.');
    return;
  }
  const ultima = block.rows[block.rows.length - 1];
  const msg = `Fecha/Hora: ${ultima[0]}\nTipo: ${ultima[1]}\nRegistros procesados: ${ultima[2]}\n` +
    `Errores: ${ultima[3]}\nNo encontrados: ${ultima[4]}\nDetalle: ${ultima[5] || '(sin detalle)'}`;
  SpreadsheetApp.getUi().alert('Última sincronización', msg, SpreadsheetApp.getUi().ButtonSet.OK);
}

function revisarErrores() {
  const ib = sheet_(SHEETS.IMPORTAR);
  const lastRow = lastDataRow_(ib);
  let pendientesError = 0;
  if (lastRow >= 2) {
    ib.getRange(2, COL.IMPORTAR.ESTADO, lastRow - 1, 1).getValues()
      .forEach(r => { if (r[0] === 'Error') pendientesError++; });
  }
  const cfg = sheet_(SHEETS.CONFIG);
  const block = findConfigBlock_(cfg, 'Registro de sincronizaciones');
  const erroresSync = block.rows.reduce((sum, r) => sum + (Number(r[3]) || 0), 0);

  const msg = `Filas con Error en IMPORTAR BASE: ${pendientesError}\n` +
    `Errores acumulados en sincronizaciones con HubSpot: ${erroresSync}\n\n` +
    'Revisa la columna "Resultado" en IMPORTAR BASE y la columna "Detalle" en ' +
    'CONFIGURACIÓN → Registro de sincronizaciones.';
  SpreadsheetApp.getUi().alert('Revisar errores', msg, SpreadsheetApp.getUi().ButtonSet.OK);
  ss_().setActiveSheet(ib);
}
