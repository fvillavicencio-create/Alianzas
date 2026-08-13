/** Normalización de email/teléfono/nombre/empresa. Nunca se pierde el valor original. */

function normalizeEmail_(email) {
  const e = String(email || '').trim().toLowerCase().replace(/\s+/g, '');
  const valido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  return valido ? e : '';
}

function emailLocalPart_(email) {
  const at = String(email || '').indexOf('@');
  return at === -1 ? '' : email.substring(0, at).toLowerCase();
}

function esEmailGenerico_(email) {
  return PREFIJOS_GENERICOS.indexOf(emailLocalPart_(email)) !== -1;
}

function normalizePhone_(phone) {
  let p = String(phone || '').replace(/[^\d+]/g, '');
  if (!p) return '';
  const hadPlus = p.startsWith('+');
  p = p.replace(/\+/g, '');
  if (!hadPlus) {
    // Sin lada internacional: 10 dígitos se asume México (+52); si ya trae
    // el 52 al frente con más de 10 dígitos, se respeta tal cual.
    if (p.length === 10) p = '52' + p;
  }
  return p;
}

function normalizeName_(name) {
  return String(name || '').trim().replace(/\s+/g, ' ');
}

/** Para comparar (no para mostrar): mayúsculas, sin acentos, sin espacios extra. */
function normalizeForCompare_(text) {
  return String(text || '').trim().toUpperCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

function normalizeCompany_(company) {
  return normalizeName_(company);
}

/** Similitud 0..1 entre dos strings usando distancia de Levenshtein normalizada. */
function similarity_(a, b) {
  const s1 = normalizeForCompare_(a);
  const s2 = normalizeForCompare_(b);
  if (!s1 && !s2) return 1;
  if (!s1 || !s2) return 0;
  if (s1 === s2) return 1;
  const dist = levenshtein_(s1, s2);
  return 1 - dist / Math.max(s1.length, s2.length);
}

function levenshtein_(a, b) {
  const m = a.length, n = b.length;
  const dp = new Array(n + 1);
  for (let j = 0; j <= n; j++) dp[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = tmp;
    }
  }
  return dp[n];
}
