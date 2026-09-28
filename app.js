import { createLifecycle } from './lifecycle.js';

const routes = {
  slot: { page: 'index', title: 'Слот-Симулятор', module: './script.js' },
  durak: { page: 'durak', title: 'Дурак Онлайн', module: './durak.js' },
  checkers: { page: 'checkers', title: 'Шашки', module: './checkers.js' },
  minesweeper: { page: 'minesweeper', title: 'Сапёр', module: './minesweeper.js' },
  doom: { page: 'doom', title: 'Doom', module: './doom.js' },
  achievements: { page: 'achievements', title: 'Достижения' },
  profile: { page: 'profile', title: 'Мой профиль', module: './profile.js' },
};
const cache = new Map();
let current = null, revision = 0, firebasePromise;
function closeMenu() {
  document.getElementById('siteSidebar').classList.remove('nav-open');
  document.querySelector('.menu-toggle').setAttribute('aria-expanded', 'false');
}
const initial = document.querySelector('main');
const initialPage = location.pathname.split('/').pop()?.replace('.html', '') || 'index';
const initialKey = Object.keys(routes).find(key => routes[key].page === initialPage) || 'slot';
const initialMarkup = initial.innerHTML;
const routeNotice = document.createElement('div');
routeNotice.className = 'route-notice';
routeNotice.setAttribute('role', 'status');
routeNotice.hidden = true;
document.querySelector('.page').prepend(routeNotice);

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const timer = setTimeout(() => { script.remove(); reject(new Error('Connection timed out')); }, 12000);
    script.src = src;
    script.onload = () => { clearTimeout(timer); resolve(); };
    script.onerror = () => { clearTimeout(timer); script.remove(); reject(new Error('Connection unavailable')); };
    document.head.appendChild(script);
  });
}
function prepareOnline() {
  if (!firebasePromise) {
    firebasePromise = (async () => {
      if (!globalThis.firebase) await loadScript('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
      if (!globalThis.firebase.database) await loadScript('https://www.gstatic.com/firebasejs/10.14.1/firebase-database-compat.js');
    })().then(() => document.dispatchEvent(new Event('firebase-ready'))).catch(() => {
      firebasePromise = null;
      document.dispatchEvent(new Event('firebase-ready'));
    });
  }
}

async function navigate(key) {
  if (!routes[key]) { location.replace('#slot'); return; }
  const ticket = ++revision;
  if (current?.key === key) { routeNotice.hidden = true; closeMenu(); return; }
  const route = routes[key];
  routeNotice.textContent = `Открываем «${route.title}»…`;
  routeNotice.hidden = false;
  let view = cache.get(key);
  try {
    if (!view) {
      const markup = key === initialKey ? initialMarkup : await fetch(`${route.page}.html`).then(async response => {
        if (!response.ok) throw new Error('Page unavailable');
        const parsed = new DOMParser().parseFromString(await response.text(), 'text/html');
        const content = parsed.querySelector('main');
        if (!content) throw new Error('Invalid game page');
        return content.innerHTML;
      });
      const gameModule = route.module ? await import(route.module) : null;
      if (ticket !== revision) return;
      const node = document.createElement('main');
      node.className = 'content'; node.id = 'mainContent'; node.tabIndex = -1;
      node.innerHTML = markup;
      view = { key, node, module: gameModule, lifecycle: createLifecycle(node), scroll: 0, mounted: false };
    }
    if (ticket !== revision) return;
    if (current) {
      current.scroll = window.scrollY;
      current.controller?.pause?.();
      current.lifecycle.pause();
    }
    document.querySelector('main').replaceWith(view.node);
    document.body.className = `app-page page-${route.page}${key === 'minesweeper' ? ' mine-page' : ''}`;
    const previous = current;
    current = view;
    try {
      if (!view.mounted) {
        view.controller = view.module?.mount(view.lifecycle);
        if (key === 'achievements') initAchievementsPage();
        view.mounted = true;
        cache.set(key, view);
        document.dispatchEvent(new CustomEvent('app:mounted', { detail: { root: view.node } }));
      } else {
        view.lifecycle.resume();
        view.controller?.resume?.();
        if (key === 'achievements') renderAchievementsPage();
        else if (key !== 'slot') renderStats(key);
      }
    } catch (error) {
      view.lifecycle.dispose(); cache.delete(key);
      current = previous;
      if (previous) {
        view.node.replaceWith(previous.node); previous.lifecycle.resume();
        document.body.className = `app-page page-${routes[previous.key].page}${previous.key === 'minesweeper' ? ' mine-page' : ''}`;
      }
      throw error;
    }
    document.title = `АМС-КОМПЛЕКС · ${route.title}`;
    document.querySelectorAll('.game-nav a').forEach(link => {
      const active = link.hash === `#${key}`;
      link.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
    });
    closeMenu();
    routeNotice.hidden = true;
    if (previous) {
      const heading = view.node.querySelector('h1') || view.node;
      heading.tabIndex = -1; heading.focus({ preventScroll: true });
    }
    window.scrollTo({ top: view.scroll, behavior: 'instant' });
    if (key === 'durak') {
      prepareOnline();
      document.dispatchEvent(new Event('firebase-ready'));
    }
  } catch (error) {
    if (ticket !== revision) return;
    routeNotice.textContent = 'Не удалось открыть игру. Проверьте соединение. ';
    const retry = document.createElement('button');
    retry.type = 'button'; retry.textContent = 'Повторить';
    retry.addEventListener('click', () => navigate(key));
    routeNotice.appendChild(retry);
    console.error('Game navigation failed:', error);
  }
}

document.addEventListener('click', event => {
  const link = event.target.closest('a[href]');
  if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const url = new URL(link.href, location.href);
  const key = url.hash.slice(1);
  if (url.origin !== location.origin || !routes[key]) return;
  event.preventDefault();
  if (location.hash === url.hash) navigate(key); else location.hash = key;
});
window.addEventListener('hashchange', () => navigate(location.hash.slice(1) || 'slot'));
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { current?.controller?.pause?.(); current?.lifecycle.pause(); }
  else current?.lifecycle.resume();
});
document.addEventListener('app:pause', () => { current?.controller?.pause?.(); current?.lifecycle.pause(); });
document.addEventListener('app:resume', () => { if (!document.hidden) current?.lifecycle.resume(); });
// Legacy game URLs remain valid entry points, but subsequent navigation uses one document.
const firstKey = location.hash.slice(1) || initialKey;
history.replaceState(null, '', `index.html#${routes[firstKey] ? firstKey : 'slot'}`);
navigate(routes[firstKey] ? firstKey : 'slot');
