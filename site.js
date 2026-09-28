/* Shared navigation, keyboard support and accessible modal behavior. */
(() => {
  'use strict';
  document.documentElement.classList.add('js');
  document.querySelector('.skip-link')?.addEventListener('click', event => {
    event.preventDefault(); document.getElementById('mainContent')?.focus();
  });
  const toggle = document.querySelector('.menu-toggle');
  const sidebar = document.getElementById('siteSidebar');
  toggle?.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(open));
    sidebar.classList.toggle('nav-open', open);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && sidebar?.classList.contains('nav-open')) {
      sidebar.classList.remove('nav-open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.focus();
    }
  });

  function setupView(root) {
  // The game scripts own selection; reflect their state for assistive tools.
  root.querySelectorAll('.method-tabs').forEach(group => {
    group.setAttribute('role', 'group');
    const update = () => group.querySelectorAll('.method-tab').forEach(button => {
      button.setAttribute('aria-pressed', String(button.classList.contains('active')));
    });
    update();
    new MutationObserver(update).observe(group, { subtree: true, attributes: true, attributeFilter: ['class'] });
  });
  const filters = root.querySelectorAll('[data-ach-filter]');
  let selected = 'all';
  const applyFilter = () => root.querySelectorAll('.ach-group').forEach(group => {
    group.hidden = selected !== 'all' && group.dataset.game !== selected;
  });
  filters.forEach(button => button.addEventListener('click', () => {
    selected = button.dataset.achFilter;
    filters.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    applyFilter();
  }));
  const list = root.querySelector('#achList');
  if (list) new MutationObserver(applyFilter).observe(list, { childList: true });
  }
  document.addEventListener('app:mounted', event => setupView(event.detail.root));

  const overlay = document.getElementById('paywallOverlay');
  if (overlay) {
    const modal = overlay.querySelector('.modal');
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'Демонстрация модулей АМС PRO');
    let previousFocus, wasOpen = false;
    const focusable = () => [...modal.querySelectorAll('button, input, a[href], select, [tabindex="0"]')]
      .filter(el => !el.disabled && el.getClientRects().length);
    const updateModal = () => {
      const open = !overlay.classList.contains('hidden');
      if (open && !wasOpen) {
        document.dispatchEvent(new Event('app:pause'));
        previousFocus = document.activeElement;
        document.querySelector('.page').inert = true;
        document.querySelector('.topbar').inert = true;
        document.body.style.overflow = 'hidden';
        focusable()[0]?.focus();
      } else if (!open && wasOpen) {
        document.dispatchEvent(new Event('app:resume'));
        document.querySelector('.page').inert = false;
        document.querySelector('.topbar').inert = false;
        document.body.style.overflow = '';
        previousFocus?.focus();
      } else if (open && !document.activeElement?.getClientRects().length) {
        focusable()[0]?.focus();
      }
      wasOpen = open;
    };
    new MutationObserver(updateModal).observe(overlay, { attributes: true, subtree: true, attributeFilter: ['class'] });
    modal.addEventListener('keydown', event => {
      if (event.key !== 'Tab') return;
      const items = focusable(), first = items[0], last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    });
  }

})();
