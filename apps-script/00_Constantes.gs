/**
 * Constantes compartidas: nombres de pestañas y layout de columnas.
 * Si agregas una columna, agrégala también aquí para que el resto del
 * código la encuentre por nombre en vez de por número fijo.
 */

const SHEETS = {
  DASHBOARD: 'DASHBOARD',
  CONTACTOS: 'CONTACTOS MAESTROS',
  INTERACCIONES: 'INTERACCIONES',
  EVENTOS: 'EVENTOS',
  BASES: 'BASES ORIGINALES',
  IMPORTAR: 'IMPORTAR BASE',
  AUDIT: 'HUBSPOT AUDIT',
  DUPLICADOS: 'DUPLICADOS',
  CONFIG: 'CONFIGURACION',
  README: 'README',
};

// Índices 1-based, en el mismo orden que las columnas del workbook.
const COL = {
  CONTACTOS: {
    MASTER_ID: 1, NOMBRE: 2, APELLIDO: 3, NOMBRE_COMPLETO: 4, EMPRESA: 5,
    EMAIL_NORM: 6, EMAIL_ORIG: 7, TEL_NORM: 8, TEL_ORIG: 9, CARGO: 10,
    INDUSTRIA: 11, CIUDAD_ESTADO: 12, FECHA_REGISTRO: 13, HS_CONTACT_ID: 14,
    HS_COMPANY_ID: 15, HS_DEAL_ID: 16, EXISTE_HUBSPOT: 17, LIGA_HUBSPOT: 18,
    SDR_ASIGNADO: 19, ESTA_ASIGNADO: 20, TIENE_ACTIVIDAD: 21, NUM_ACTIVIDADES: 22,
    ULTIMA_ACTIVIDAD: 23, TIPO_ULTIMA_ACTIVIDAD: 24, FECHA_ULTIMO_CONTACTO: 25,
    ESTATUS_COMERCIAL: 26, NUM_FUENTES: 27, NUM_EVENTOS: 28, DUPLICADO_DETECTADO: 29,
    TIPO_DUPLICADO: 30, IDS_RELACIONADOS: 31, ULTIMA_SYNC: 32,
  },
  INTERACCIONES: {
    INTERACCION_ID: 1, MASTER_ID: 2, EVENT_ID: 3, EVENTO: 4, TIPO_ORIGEN: 5,
    ALIADO: 6, FECHA_EVENTO: 7, FECHA_REGISTRO: 8, BASE_ID: 9, FILA_ORIGINAL: 10,
    EMAIL_APARECIO: 11, TEL_APARECIO: 12, AYUDA_EXISTE_HUBSPOT: 13,
    AYUDA_SDR: 14, AYUDA_ACTIVIDAD: 15, AYUDA_ESTATUS: 16, AYUDA_DEAL: 17,
  },
  EVENTOS: {
    EVENT_ID: 1, NOMBRE: 2, TIPO: 3, ALIADO: 4, FECHA_EVENTO: 5,
    FECHA_RECEPCION: 6, RESPONSABLE: 7, ARCHIVO_ORIGINAL: 8, LIGA_ORIGINAL: 9,
    NUM_REGISTROS: 10, NUM_UNICOS: 11, NUM_DUPLICADOS: 12, NUM_EN_HUBSPOT: 13,
    NUM_NO_HUBSPOT: 14, ULTIMA_SYNC: 15, OBSERVACIONES: 16,
  },
  BASES: {
    BASE_ID: 1, NOMBRE: 2, FUENTE: 3, URL_ORIGEN: 4, FECHA_IMPORTACION: 5,
    IMPORTADO_POR: 6, NUM_REGISTROS: 7, NUM_UNICOS: 8, NUM_DUPLICADOS: 9,
    EVENT_ID: 10, ESTADO: 11, COLUMNAS_NO_MAPEADAS: 12,
  },
  IMPORTAR: {
    URL_SHEET: 1, NOMBRE_PESTANA: 2, EVENT_ID: 3, TIPO_ORIGEN: 4, ALIADO: 5,
    FECHA_EVENTO: 6, FECHA_REGISTRO: 7, FUENTE_ORIGINAL: 8, ESTADO: 9, RESULTADO: 10,
  },
  AUDIT: {
    MASTER_ID: 1, EXISTE_HUBSPOT: 2, HS_CONTACT_ID: 3, LIGA_HUBSPOT: 4,
    EMPRESA_ASOCIADA: 5, HS_COMPANY_ID: 6, DEAL_NOMBRE: 7, HS_DEAL_ID: 8,
    ASIGNADO_SDR: 9, NOMBRE_SDR: 10, FECHA_ASIGNACION: 11, TIENE_ACTIVIDAD: 12,
    NUM_ACTIVIDADES: 13, ULTIMA_ACTIVIDAD: 14, TIPO_ULTIMA_ACTIVIDAD: 15,
    FECHA_ULTIMO_CONTACTO: 16, DIAS_SIN_CONTACTO: 17, ESTATUS_COMERCIAL: 18,
    CONFIANZA_ESTATUS: 19, SEMAFORO: 20, ULTIMA_SYNC: 21,
  },
  DUPLICADOS: {
    PAR_ID: 1, MC_A: 2, MC_B: 3, TIPO_COINCIDENCIA: 4, CAMPO: 5, VALOR: 6,
    CONFIANZA: 7, HS_ID_A: 8, HS_ID_B: 9, EVENTO_A: 10, EVENTO_B: 11,
    ESTATUS_REVISION: 12, ACCION_RECOMENDADA: 13, REVISADO_POR: 14, FECHA_REVISION: 15,
  },
};

const ESTATUS = {
  PENDIENTE_CARGAR: 'Pendiente de cargar a HubSpot',
  SIN_SDR: 'En HubSpot — Sin SDR',
  ASIGNADO_SIN_CONTACTO: 'Asignado — Sin contacto',
  CONTACTADO: 'Contactado',
  RESPONDIO: 'Respondió',
  REUNION_AGENDADA: 'Reunión agendada',
  NO_INTERESADO: 'No interesado',
  NO_RESPONDE: 'No responde',
  CONVERTIDO: 'Convertido',
  REVISION_MANUAL: 'Revisión manual',
};

const HUBSPOT_API_BASE = 'https://api.hubapi.com';
const HUBSPOT_TOKEN_PROPERTY = 'HUBSPOT_TOKEN';

// Prefijos de correo genéricos/compartidos (buzones de área, no de una persona):
// nunca se auto-fusiona por coincidencia de email si el LOCAL PART (antes del
// @) es uno de estos, porque contacto@empresa.com o ventas@empresa.com puede
// representar personas distintas de la misma empresa. Los dominios públicos
// (gmail.com, hotmail.com, etc.) NO se excluyen: una misma dirección exacta de
// gmail sí identifica a una sola persona.
const PREFIJOS_GENERICOS = ['info', 'contacto', 'ventas', 'admin', 'administracion', 'compras',
  'rh', 'recursoshumanos', 'hola', 'hello', 'contact', 'sales', 'soporte', 'support',
  'atencionaclientes', 'cumplimiento', 'oficialdecumplimiento'];
