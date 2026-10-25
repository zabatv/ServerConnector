//не удалять
// src/destination.js — validation for the per-link destination field.
//
// Two destination kinds:
//   internal  — the profile page on this domain (default)
//   external  — any https URL the admin saved
//
// There is no open-redirect surface: the hop endpoint reads the URL from the
// stored record and ignores request parameters entirely.

export const DESTINATION_TYPES = ['internal', 'external'];
export const ROLES = ['', 'friend', 'rival', 'teammate', 'caster'];

export const ROLE_LABELS = {
  '': '',
  friend: 'ДРУГ',
  rival: 'СОПЕРНИК',
  teammate: 'СОКОМАНДНИК',
  caster: 'КАСТЕР',
};

const MAX_LEN = 2048;

// Разрешён любой https-хост — поле ведения задаёт сам админ (RESTful: https-only,
// без credentials, стандартный порт). faceit.com подсказка убрана.
export function host_of(url) {
  try { return new URL(url).hostname.toLowerCase(); } catch { return ''; }
}

/**
 * @returns {{ok: boolean, type: string, url: string, host: string, scheme?: string, insecure?: boolean, error?: string}}
 */
export function validate_destination(type, raw_url) {
  const kind = String(type || 'internal').toLowerCase();
  if (!DESTINATION_TYPES.includes(kind)) {
    return { ok: false, type: 'internal', url: '', host: '', error: 'Неизвестный тип назначения.' };
  }
  if (kind === 'internal') {
    return { ok: true, type: 'internal', url: '', host: '' };
  }

  const value = String(raw_url || '').trim();
  if (!value) {
    return { ok: false, type: kind, url: '', host: '', error: 'Укажи адрес назначения.' };
  }
  if (value.length > MAX_LEN) {
    return { ok: false, type: kind, url: '', host: '', error: `Адрес длиннее ${MAX_LEN} символов.` };
  }
  if (/\s/.test(value)) {
    return { ok: false, type: kind, url: '', host: '', error: 'В адресе не должно быть пробелов.' };
  }

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return {
      ok: false, type: kind, url: '', host: '',
      error: 'Это не похоже на адрес. Нужен полный URL, например https://cup.example/bracket.',
    };
  }

  if (parsed.protocol !== 'https:') {
    return {
      ok: false, type: kind, url: '', host: '',
      error: `Схема ${parsed.protocol} не поддерживается — только https.`,
    };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, type: kind, url: '', host: '', error: 'Учётные данные в адресе не допускаются.' };
  }
  if (!parsed.hostname || !parsed.hostname.includes('.')) {
    return { ok: false, type: kind, url: '', host: '', error: 'У адреса нет нормального домена.' };
  }
  if (parsed.port && parsed.port !== '443') {
    return { ok: false, type: kind, url: '', host: '', error: `Порт ${parsed.port} не поддерживается — только 443.` };
  }

  return {
    ok: true,
    type: kind,
    url: parsed.href,
    host: parsed.hostname.toLowerCase(),
    scheme: 'https',
  };
}
