/**
 * Sincronización con HubSpot. Usa la API REST directamente vía UrlFetchApp
 * (no MCP) para que el Sheet funcione de forma autónoma. El token se lee de
 * Propiedades del script — NUNCA se hardcodea ni se guarda en una celda.
 *
 * Ver docs/arquitectura.md sección E (endpoints) y D (lógica de estatus).
 */

function getHubspotToken_() {
  const token = PropertiesService.getScriptProperties().getProperty(HUBSPOT_TOKEN_PROPERTY);
  if (!token) {
    throw new Error('Falta configurar HUBSPOT_TOKEN en Propiedades del script ' +
      '(Extensiones → Apps Script → Configuración del proyecto → Propiedades del script). ' +
      'Ver docs/INSTRUCCIONES_SETUP.md.');
  }
  return token;
}

function hubspotFetch_(method, path, payload) {
  const options = {
    method,
    headers: { Authorization: 'Bearer ' + getHubspotToken_() },
    contentType: 'application/json',
    muteHttpExceptions: true,
  };
  if (payload !== undefined) options.payload = JSON.stringify(payload);
  const resp = UrlFetchApp.fetch(HUBSPOT_API_BASE + path, options);
  const code = resp.getResponseCode();
  if (code >= 300) {
    throw new Error(`HubSpot ${method} ${path} -> HTTP ${code}: ${resp.getContentText().substring(0, 300)}`);
  }
  return JSON.parse(resp.getContentText() || '{}');
}

function chunk_(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** Busca contactos por email en lotes de 100 usando el operador IN. Devuelve email(minúsculas) -> propiedades. */
function hubspotBuscarContactosPorEmail_(emails, contactProps) {
  const resultado = {};
  const props = Array.from(new Set(['email', ...contactProps]));
  chunk_(emails, 100).forEach(lote => {
    const body = {
      filterGroups: [{ filters: [{ propertyName: 'email', operator: 'IN', values: lote }] }],
      properties: props,
      limit: 100,
    };
    let after;
    do {
      if (after) body.after = after;
      const data = hubspotFetch_('POST', '/crm/v3/objects/contacts/search', body);
      (data.results || []).forEach(c => {
        const email = (c.properties.email || '').toLowerCase();
        if (email) resultado[email] = c;
      });
      after = data.paging && data.paging.next ? data.paging.next.after : null;
    } while (after);
    Utilities.sleep(150); // margen bajo el límite de tasa de la API
  });
  return resultado;
}

function hubspotObtenerAsociaciones_(contactId) {
  const data = hubspotFetch_('GET',
    `/crm/v3/objects/contacts/${contactId}?associations=companies,deals`);
  const companyIds = ((data.associations && data.associations.companies) || {})
    .results ? data.associations.companies.results.map(r => r.id) : [];
  const dealIds = ((data.associations && data.associations.deals) || {})
    .results ? data.associations.deals.results.map(r => r.id) : [];
  return { companyIds, dealIds };
}

function hubspotBatchRead_(objectType, ids, properties) {
  const out = {};
  if (!ids.length) return out;
  chunk_(Array.from(new Set(ids)), 100).forEach(lote => {
    const data = hubspotFetch_('POST', `/crm/v3/objects/${objectType}/batch/read`, {
      properties, inputs: lote.map(id => ({ id })),
    });
    (data.results || []).forEach(r => { out[r.id] = r.properties; });
  });
  return out;
}

function hubspotObtenerOwners_() {
  const map = {};
  let after;
  do {
    const qs = after ? `?limit=100&after=${after}` : '?limit=100';
    const data = hubspotFetch_('GET', '/crm/v3/owners' + qs);
    (data.results || []).forEach(o => {
      map[String(o.id)] = `${o.firstName || ''} ${o.lastName || ''}`.trim() || o.email;
    });
    after = data.paging && data.paging.next ? data.paging.next.after : null;
  } while (after);
  return map;
}

/** Ver docs/arquitectura.md sección D — árbol de decisión de estatus comercial. */
function computeEstatus_(props, dealMappedStatuses, tieneActividad, diasSinContacto, thresholds) {
  if (dealMappedStatuses.indexOf(ESTATUS.CONVERTIDO) !== -1) return { estatus: ESTATUS.CONVERTIDO, auto: true };
  if (dealMappedStatuses.indexOf(ESTATUS.REUNION_AGENDADA) !== -1) {
    return { estatus: ESTATUS.REUNION_AGENDADA, auto: true };
  }
  if (dealMappedStatuses.indexOf(ESTATUS.NO_INTERESADO) !== -1) return { estatus: ESTATUS.NO_INTERESADO, auto: true };

  const leadStatus = String(props.hs_lead_status || '');
  const NO_INTERESADO_VALUES = ['BAD_TIMING', 'Sin presupuesto', 'Competencia', 'Descartado', 'Eliminado',
    'Correo inválido / rebotado'];
  if (NO_INTERESADO_VALUES.indexOf(leadStatus) !== -1) return { estatus: ESTATUS.NO_INTERESADO, auto: true };

  if (leadStatus === 'Sin respuesta') {
    if (diasSinContacto !== '' && diasSinContacto >= thresholds.amarillo) {
      return { estatus: ESTATUS.NO_RESPONDE, auto: true };
    }
    return { estatus: ESTATUS.CONTACTADO, auto: true };
  }
  if (['CONNECTED', 'ATTEMPTED_TO_CONTACT', 'Esperando RCG'].indexOf(leadStatus) !== -1) {
    return { estatus: ESTATUS.CONTACTADO, auto: true };
  }

  if (props.hubspot_owner_id && !tieneActividad) return { estatus: ESTATUS.ASIGNADO_SIN_CONTACTO, auto: true };
  if (!props.hubspot_owner_id) return { estatus: ESTATUS.SIN_SDR, auto: true };
  return { estatus: ESTATUS.REVISION_MANUAL, auto: false };
}

function actualizarHubSpot() {
  const cm = sheet_(SHEETS.CONTACTOS);
  const lastRow = lastDataRow_(cm);
  if (lastRow < 2) { toast_('CONTACTOS MAESTROS está vacío.'); return; }

  const propsCfg = getHubspotPropertiesConfig_();
  const dealstageMap = getDealstageMap_();
  const thresholds = getAlertThresholds_();
  const portalId = getPortalId_();

  const filas = cm.getRange(2, 1, lastRow - 1, COL.CONTACTOS.EMAIL_NORM).getValues()
    .map((row, i) => ({ fila: i + 2, masterId: row[COL.CONTACTOS.MASTER_ID - 1],
      email: row[COL.CONTACTOS.EMAIL_NORM - 1] }))
    .filter(x => x.masterId && x.email);

  if (!filas.length) { toast_('No hay contactos con email para sincronizar.'); return; }

  let encontrados = 0, noEncontrados = 0, errores = 0;
  const errorDetalle = [];

  try {
    const encontradosMap = hubspotBuscarContactosPorEmail_(filas.map(f => f.email), propsCfg.contacts || []);
    const ownersMap = hubspotObtenerOwners_();

    // Asociaciones por contacto encontrado (1 llamada por contacto: ver limitación en docs, sección G).
    const asociaciones = {};
    const companyIds = [], dealIds = [];
    Object.keys(encontradosMap).forEach(email => {
      const c = encontradosMap[email];
      try {
        const a = hubspotObtenerAsociaciones_(c.id);
        asociaciones[c.id] = a;
        companyIds.push(...a.companyIds);
        dealIds.push(...a.dealIds);
      } catch (e) {
        errores++; errorDetalle.push(`${email}: ${e.message}`);
      }
    });

    const companiesData = hubspotBatchRead_('companies', companyIds, ['name']);
    const dealsData = hubspotBatchRead_('deals', dealIds,
      ['dealname', 'dealstage', 'pipeline', 'amount', 'closedate']);

    const audit = sheet_(SHEETS.AUDIT);
    const auditLastRow = lastDataRow_(audit);
    const auditIndex = {};
    if (auditLastRow >= 2) {
      audit.getRange(2, COL.AUDIT.MASTER_ID, auditLastRow - 1, 1).getValues()
        .forEach((r, i) => { if (r[0]) auditIndex[r[0]] = i + 2; });
    }

    filas.forEach(f => {
      const c = encontradosMap[f.email];
      let row = auditIndex[f.masterId];
      if (!row) {
        row = lastDataRow_(audit) + 1;
        auditIndex[f.masterId] = row;
        audit.getRange(row, COL.AUDIT.MASTER_ID).setValue(f.masterId);
      }

      if (!c) {
        noEncontrados++;
        audit.getRange(row, COL.AUDIT.EXISTE_HUBSPOT).setValue('No');
        audit.getRange(row, COL.AUDIT.ULTIMA_SYNC).setValue(nowStamp_());
        return;
      }
      encontrados++;
      const p = c.properties;
      const a = asociaciones[c.id] || { companyIds: [], dealIds: [] };
      const companyName = a.companyIds.length ? (companiesData[a.companyIds[0]] || {}).name || '' : '';
      const dealMappedStatuses = a.dealIds.map(id => dealstageMap[(dealsData[id] || {}).dealstage])
        .filter(Boolean);
      const dealNombre = a.dealIds.length ? (dealsData[a.dealIds[0]] || {}).dealname || '' : '';

      const tieneActividad = !!(p.hs_last_activity_date || p.notes_last_contacted);
      const fechaUltimoContacto = p.notes_last_contacted || p.hs_last_activity_date || '';
      const diasSinContacto = fechaUltimoContacto
        ? Math.floor((Date.now() - new Date(fechaUltimoContacto).getTime()) / 86400000) : '';
      const { estatus, auto } = computeEstatus_(p, dealMappedStatuses, tieneActividad, diasSinContacto, thresholds);

      // Se escribe celda por celda (en vez de un solo rango) porque DIAS_SIN_CONTACTO (Q) y
      // SEMAFORO (T) son fórmulas del propio Sheet y no deben sobreescribirse aquí.
      const setCell = (col, value) => audit.getRange(row, col).setValue(value);
      setCell(COL.AUDIT.EXISTE_HUBSPOT, 'Sí');
      setCell(COL.AUDIT.HS_CONTACT_ID, c.id);
      setCell(COL.AUDIT.LIGA_HUBSPOT, `https://app.hubspot.com/contacts/${portalId}/record/0-1/${c.id}`);
      setCell(COL.AUDIT.EMPRESA_ASOCIADA, companyName);
      setCell(COL.AUDIT.HS_COMPANY_ID, a.companyIds[0] || '');
      setCell(COL.AUDIT.DEAL_NOMBRE, dealNombre);
      setCell(COL.AUDIT.HS_DEAL_ID, a.dealIds[0] || '');
      setCell(COL.AUDIT.ASIGNADO_SDR, p.hubspot_owner_id ? 'Sí' : 'No');
      setCell(COL.AUDIT.NOMBRE_SDR, p.hubspot_owner_id ? (ownersMap[String(p.hubspot_owner_id)] || '') : '');
      // FECHA_ASIGNACION: HubSpot no expone por API estándar cuándo se asignó el propietario actual.
      setCell(COL.AUDIT.TIENE_ACTIVIDAD, tieneActividad ? 'Sí' : 'No');
      // NUM_ACTIVIDADES y TIPO_ULTIMA_ACTIVIDAD: ver docs/arquitectura.md sección G — requieren la
      // API de engagements aparte; se dejan en blanco hasta implementar esa profundización opcional.
      setCell(COL.AUDIT.ULTIMA_ACTIVIDAD, fechaUltimoContacto);
      setCell(COL.AUDIT.FECHA_ULTIMO_CONTACTO, fechaUltimoContacto);
      setCell(COL.AUDIT.ESTATUS_COMERCIAL, estatus);
      setCell(COL.AUDIT.CONFIANZA_ESTATUS, auto ? 'Automático' : 'Revisión manual');
      setCell(COL.AUDIT.ULTIMA_SYNC, nowStamp_());
    });

    logSync_('Actualizar HubSpot', encontrados + noEncontrados, errores, noEncontrados, errorDetalle.join(' | '));
    toast_(`Sincronización terminada: ${encontrados} encontrados, ${noEncontrados} no encontrados, ${errores} error(es).`);
  } catch (e) {
    logSync_('Actualizar HubSpot', 0, 1, 0, String(e.message || e));
    throw e;
  }
}
