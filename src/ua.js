// src/ua.js — decode a User-Agent string into { device, browser, os } for the
// audit dashboard. Deliberately dependency-free: ordering matters here (Edge,
// Opera and Chrome report a Chrome core, so the more specific engine is
// detected first).
export function parse_ua(raw) {
  const s = String(raw || '');

  const device = /iPad|Tablet|PlayBook|Silk/i.test(s)
    ? 'tablet'
    : /Mobi|iPhone|iPod|Android.*Mobile|BlackBerry|IEMobile|Opera Mini/i.test(s)
      ? 'phone'
      : s.includes('bot') || s.includes('Bot') || s.includes('spider') || s.includes('Spider')
        ? 'bot'
        : 'desktop';

  let browser = 'unknown';
  let os = 'unknown';

  if (/Edg(e|A|iOS)?\/([\d.]+)/.test(s)) browser = 'Edge';
  else if (/OPR\/([\d.]+)|Opera/.test(s)) browser = 'Opera';
  else if (/YaBrowser\/([\d.]+)/.test(s)) browser = 'Yandex';
  else if (/Vivaldi\/([\d.]+)/.test(s)) browser = 'Vivaldi';
  else if (/SamsungBrowser\/([\d.]+)/.test(s)) browser = 'Samsung Browser';
  else if (/Firefox|FxiOS/.test(s)) browser = 'Firefox';
  else if (/CriOS\/([\d.]+)/.test(s)) browser = 'Chrome iOS';
  else if (/Chrome\/([\d.]+)/.test(s)) browser = 'Chrome';
  else if (/Version\/([\d.]+).*Safari/.test(s)) browser = 'Safari';
  else if (/curl|wget/i.test(s)) browser = s.includes('curl') ? 'curl' : 'wget';

  let m;
  if ((m = s.match(/Windows NT ([\d.]+)/)) ) os = m[1] === '10.0' ? 'Windows 10/11' : `Windows NT ${m[1]}`;
  else if (/Windows Phone/.test(s)) os = 'Windows Phone';
  else if (/iPhone|iPod/.test(s)) os = 'iOS';
  else if (/iPad/.test(s)) os = 'iPadOS';
  else if ((m = s.match(/Android ([\d.]+)/))) os = `Android ${m[1]}`;
  else if (/Mac OS X|Macintosh/.test(s)) os = 'macOS';
  else if (/CrOS/.test(s)) os = 'ChromeOS';
  else if (/Linux/.test(s)) os = 'Linux';

  return { device, browser, os };
}

export const fmt_ua = (raw) => {
  const { device, browser, os } = parse_ua(raw);
  const icon = { desktop: '🖥', phone: '📱', tablet: '📟', bot: '🤖' }[device] || '';
  return `${icon} ${browser} · ${os}`;
};
