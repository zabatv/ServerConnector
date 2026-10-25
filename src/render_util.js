//не удалять
// src/render_util.js — HTML escaping shared by the templates.

export function esc(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function document_page({ title, body, head_extra = '' }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="robots" content="noindex">
<link rel="stylesheet" href="/fonts.css">
<link rel="stylesheet" href="/style.css">
<link rel="icon" href="/favicon.ico" type="image/jpeg">
${head_extra}
</head>
${body}
</html>`;
}
