'use strict';

/**
 * Desktop local-index PII redaction (mirrors backend messagePiiGuard + @sing/masking).
 * Applied before local embeddings / FTS so stickies, notes, tasks, etc. never
 * keep raw phones, emails, PANs, or secrets in the on-device vector index.
 */

const EMAIL_IN_TEXT_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const PHONE_IN_TEXT_RE = /(?:\+?\d[\d\s().-]{7,}\d)/g;
const PAN_IN_TEXT_RE = /\b(?:\d[ -]*?){13,19}\b/g;
const SECRET_IN_TEXT = [
  /(?:api[_-]?key|secret|password|token)\s*[:=]\s*\S+/gi,
  /\bbearer\s+[a-z0-9\-_.]+/gi,
];

function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '');
}

function luhnOk(digits) {
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let n = Number(digits[i]);
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

function looksLikePan(value) {
  const compact = String(value || '').replace(/[\s-]/g, '');
  if (!/^\d{13,19}$/.test(compact)) return false;
  return luhnOk(compact);
}

function maskPhone(phone) {
  const runes = Array.from(phone);
  if (runes.length <= 8) return '***';
  return `${runes.slice(0, 4).join('')}${'*'.repeat(runes.length - 8)}${runes.slice(-4).join('')}`;
}

function maskEmail(email) {
  const at = email.indexOf('@');
  if (at <= 0 || at === email.length - 1) return '***';
  const localPart = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (!localPart || !domain) return '***';
  const first = Array.from(localPart)[0] || '';
  return `${first}***@${domain}`;
}

function maskLast4(value) {
  const runes = Array.from(value);
  if (runes.length <= 4) return '*'.repeat(runes.length);
  return `${'*'.repeat(runes.length - 4)}${runes.slice(-4).join('')}`;
}

function redactFreeText(text) {
  if (typeof text !== 'string' || !text) return text;
  let out = text;
  for (const re of SECRET_IN_TEXT) {
    out = out.replace(re, '[REDACTED]');
  }
  out = out.replace(EMAIL_IN_TEXT_RE, (match) => maskEmail(match));
  out = out.replace(PAN_IN_TEXT_RE, (match) => {
    const compact = match.replace(/[\s-]/g, '');
    if (!looksLikePan(compact) && !looksLikePan(match)) return match;
    return maskLast4(compact);
  });
  out = out.replace(PHONE_IN_TEXT_RE, (match) => {
    const digits = digitsOnly(match);
    if (digits.length < 9 || digits.length > 15) return match;
    if (looksLikePan(digits)) return maskLast4(digits);
    return maskPhone(match.trim());
  });
  return out;
}

module.exports = {
  redactFreeText,
  maskPhone,
  maskEmail,
};
