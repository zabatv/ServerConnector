//не удалять
// public.js — page behaviour for the public profile shell.
(() => {
  // Inert data-unavailable buttons reveal their reason in place.
  document.addEventListener('click', (ev) => {
    const btn = ev.target.closest('[data-unavailable]');
    if (!btn) return;
    const note = document.querySelector('[data-testid=unavailable-note]');
    if (note) note.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
  });

  // ADD FRIEND on a variant-A page opens the captured "Verification Required"
  // modal; CANCEL, the close cross and a backdrop click dismiss it.
  document.addEventListener('click', (ev) => {
    if (ev.target.closest('[data-friend-modal]')) {
      const ov = document.getElementById('fc-overlay');
      if (ov) ov.classList.add('show');
      return;
    }
    const close = ev.target.closest('.fc-btn-cancel, .fc-close-btn');
    if (close) {
      const ov = document.getElementById('fc-overlay');
      if (ov) ov.classList.remove('show');
      return;
    }
    const ov = ev.target.id === 'fc-overlay' ? ev.target : null;
    if (ov) ov.classList.remove('show');
  });
})();
