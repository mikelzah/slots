/* Browser-local identity. This is not an authentication or account service. */
const AppProfile = (() => {
  const key = 'amsProfile';
  const colors = ['blue', 'teal', 'violet', 'amber'];
  function read() {
    try {
      const value = JSON.parse(localStorage.getItem(key)) || {};
      return {
        name: typeof value.name === 'string' && value.name.trim() ? value.name.trim().slice(0, 40) : 'Игрок',
        color: colors.includes(value.color) ? value.color : 'blue',
      };
    } catch { return { name: 'Игрок', color: 'blue' }; }
  }
  function initials(name) {
    return name.trim().split(/\s+/).slice(0, 2).map(word => Array.from(word)[0]).join('').toLocaleUpperCase('ru-RU');
  }
  function renderHeader() {
    const profile = read();
    document.querySelectorAll('[data-profile-name]').forEach(el => { el.textContent = profile.name; });
    document.querySelectorAll('[data-profile-avatar]').forEach(el => {
      el.textContent = initials(profile.name); el.dataset.color = profile.color;
    });
    document.querySelector('.header-account')?.setAttribute('aria-label', `Профиль: ${profile.name}`);
  }
  function save(profile) {
    const name = profile.name.trim();
    if (!name || name.length > 40) throw new Error('Введите имя от 1 до 40 символов.');
    localStorage.setItem(key, JSON.stringify({ name, color: colors.includes(profile.color) ? profile.color : 'blue' }));
    renderHeader();
    document.dispatchEvent(new Event('profile:updated'));
  }
  renderHeader();
  return { read, save, initials };
})();
