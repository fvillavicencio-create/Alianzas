/**
 * Lógica de deduplicación. Cascada de reglas (se detiene en el primer match):
 *   1. HubSpot Contact ID idéntico       -> confianza 100
 *   2. Email normalizado idéntico        -> confianza 95 (excepto emails
 *      genéricos tipo contacto@empresa.com, que van a revisión)
 *   3. Teléfono normalizado idéntico     -> confianza 75, a revisión
 *   4. Nombre completo + Empresa similar (>=0.85) -> confianza variable, a revisión
 *
 * Solo 1 y 2 (sin contar la excepción de genéricos) fusionan automáticamente
 * al importar. 3 y 4 SIEMPRE quedan como Master Contact ID separados +
 * entrada en DUPLICADOS para revisión manual — nunca se fusionan solas.
 */

const UMBRAL_SIMILITUD = 0.85;

/** Construye índices en memoria de CONTACTOS MAESTROS para buscar matches rápido. */
function construirIndiceContactos_() {
  const sh = sheet_(SHEETS.CONTACTOS);
  const lastRow = lastDataRow_(sh);
  const idx = { porEmail: {}, porTelefono: {}, porHsId: {}, filas: [] };
  if (lastRow < 2) return idx;

  const data = sh.getRange(2, 1, lastRow - 1, COL.CONTACTOS.ULTIMA_SYNC).getValues();
  data.forEach((row, i) => {
    const masterId = row[COL.CONTACTOS.MASTER_ID - 1];
    if (!masterId) return;
    const fila = i + 2;
    const email = row[COL.CONTACTOS.EMAIL_NORM - 1];
    const tel = row[COL.CONTACTOS.TEL_NORM - 1];
    const nombreCompleto = row[COL.CONTACTOS.NOMBRE_COMPLETO - 1];
    const empresa = row[COL.CONTACTOS.EMPRESA - 1];
    const hsId = row[COL.CONTACTOS.HS_CONTACT_ID - 1]; // fórmula: normalmente vacío hasta sincronizar
    idx.filas.push({ masterId, fila, email, tel, nombreCompleto, empresa });
    if (email) (idx.porEmail[email] = idx.porEmail[email] || []).push(masterId);
    if (tel) (idx.porTelefono[tel] = idx.porTelefono[tel] || []).push(masterId);
    if (hsId) idx.porHsId[String(hsId)] = masterId;
  });
  return idx;
}

/**
 * Busca coincidencia para un contacto nuevo (ya normalizado) contra el índice.
 * Devuelve { masterId, tipo, campo, valor, confianza } o null si no hay match fuerte/exacto.
 * Las coincidencias medias/débiles se manejan aparte con detectarDuplicadosDebiles_.
 */
function buscarCoincidenciaFuerte_(nuevo, idx) {
  if (nuevo.hsId && idx.porHsId[nuevo.hsId]) {
    return {
      masterId: idx.porHsId[nuevo.hsId], tipo: 'fuerte', campo: 'HubSpot Contact ID',
      valor: nuevo.hsId, confianza: 100,
    };
  }
  if (nuevo.email && idx.porEmail[nuevo.email] && idx.porEmail[nuevo.email].length === 1
      && !esEmailGenerico_(nuevo.email)) {
    return {
      masterId: idx.porEmail[nuevo.email][0], tipo: 'fuerte', campo: 'Email',
      valor: nuevo.email, confianza: 95,
    };
  }
  return null;
}

/**
 * Recorre CONTACTOS MAESTROS completo y genera/actualiza la pestaña DUPLICADOS
 * con coincidencias medias (teléfono) y débiles (nombre+empresa similar).
 * Nunca fusiona nada; solo deja registro para revisión manual.
 */
function detectarDuplicados() {
  const idx = construirIndiceContactos_();
  const du = sheet_(SHEETS.DUPLICADOS);
  const existentes = new Set();
  const lastDupRow = lastDataRow_(du);
  if (lastDupRow >= 2) {
    du.getRange(2, COL.DUPLICADOS.MC_A, lastDupRow - 1, 2).getValues().forEach(r => {
      existentes.add(r[0] + '|' + r[1]);
      existentes.add(r[1] + '|' + r[0]);
    });
  }

  const nuevosPares = [];
  const filas = idx.filas;
  for (let i = 0; i < filas.length; i++) {
    for (let j = i + 1; j < filas.length; j++) {
      const a = filas[i], b = filas[j];
      if (a.masterId === b.masterId) continue;
      const key = a.masterId + '|' + b.masterId;
      if (existentes.has(key)) continue;

      if (a.tel && b.tel && a.tel === b.tel) {
        nuevosPares.push([a.masterId, b.masterId, 'media', 'Teléfono', a.tel, 75]);
        existentes.add(key); existentes.add(b.masterId + '|' + a.masterId);
        continue;
      }
      const simNombre = similarity_(a.nombreCompleto, b.nombreCompleto);
      const simEmpresa = similarity_(a.empresa, b.empresa);
      if (simNombre >= UMBRAL_SIMILITUD && simEmpresa >= UMBRAL_SIMILITUD && a.nombreCompleto && a.empresa) {
        const confianza = Math.round(((simNombre + simEmpresa) / 2) * 100);
        nuevosPares.push([a.masterId, b.masterId, 'débil', 'Nombre + Empresa',
          `${a.nombreCompleto} / ${a.empresa}`, confianza]);
        existentes.add(key); existentes.add(b.masterId + '|' + a.masterId);
      }
    }
  }

  if (nuevosPares.length === 0) { toast_('No se encontraron duplicados nuevos.'); return 0; }

  let row = lastDupRow + 1;
  nuevosPares.forEach(([mcA, mcB, tipo, campo, valor, confianza]) => {
    const parId = nextId_(du, COL.DUPLICADOS.PAR_ID, 'DUP-', 6);
    du.getRange(row, COL.DUPLICADOS.PAR_ID, 1, 6)
      .setValues([[parId, mcA, mcB, tipo, campo, valor]]);
    du.getRange(row, COL.DUPLICADOS.CONFIANZA).setValue(confianza);
    du.getRange(row, COL.DUPLICADOS.ESTATUS_REVISION).setValue('Pendiente');
    du.getRange(row, COL.DUPLICADOS.ACCION_RECOMENDADA).setValue(
      tipo === 'media' ? 'Confirmar si es la misma persona (mismo teléfono)'
                        : 'Revisar manualmente: nombre y empresa similares');
    row++;
  });
  toast_(`${nuevosPares.length} posible(s) duplicado(s) nuevo(s) agregado(s) a DUPLICADOS.`);
  return nuevosPares.length;
}
