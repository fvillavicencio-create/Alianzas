/** Menú personalizado "Regcheq CRM". Se instala solo al abrir el Sheet. */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Regcheq CRM')
    .addItem('Instalar/extender fórmulas (correr primero)', 'instalarFormulasUI_')
    .addItem('Importar nueva base', 'importarBaseUI_')
    .addItem('Actualizar HubSpot', 'actualizarHubSpotUI_')
    .addItem('Detectar duplicados', 'detectarDuplicadosUI_')
    .addItem('Actualizar dashboard', 'actualizarDashboard')
    .addSeparator()
    .addItem('Revisar errores', 'revisarErrores')
    .addItem('Ver última sincronización', 'verUltimaSincronizacion')
    .addToUi();
}

// Wrappers con manejo de errores visible al usuario (las funciones base son
// las que se prueban/documentan; estas solo agregan el diálogo de la UI).
function instalarFormulasUI_() { runWithAlert_(instalarFormulas, 'Instalar/extender fórmulas'); }
function importarBaseUI_() { runWithAlert_(importarBase, 'Importar nueva base'); }
function actualizarHubSpotUI_() { runWithAlert_(actualizarHubSpot, 'Actualizar HubSpot'); }
function detectarDuplicadosUI_() { runWithAlert_(detectarDuplicados, 'Detectar duplicados'); }

function runWithAlert_(fn, titulo) {
  try {
    fn();
  } catch (e) {
    SpreadsheetApp.getUi().alert(titulo, String(e.message || e), SpreadsheetApp.getUi().ButtonSet.OK);
  }
}
