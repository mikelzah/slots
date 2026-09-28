export function mount(lifecycle) {
  const { document } = lifecycle;
  const form = document.getElementById('profileForm');
  const name = document.getElementById('profileName');
  const status = document.getElementById('profileStatus');
  const avatar = document.getElementById('profilePreview');
  const colors = [...form.querySelectorAll('[name="avatarColor"]')];
  const profile = AppProfile.read();
  name.value = profile.name;
  colors.forEach(input => { input.checked = input.value === profile.color; });
  const preview = () => {
    avatar.textContent = AppProfile.initials(name.value || 'Игрок');
    avatar.dataset.color = colors.find(input => input.checked)?.value || 'blue';
    status.textContent = '';
  };
  form.addEventListener('input', preview);
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!name.value.trim()) { status.textContent = 'Введите имя для профиля.'; name.focus(); return; }
    try {
      AppProfile.save({ name: name.value, color: colors.find(input => input.checked)?.value });
      name.value = AppProfile.read().name;
      status.textContent = 'Профиль сохранён. Имя обновлено во всём приложении.';
    } catch { status.textContent = 'Не удалось сохранить профиль. Разрешите хранение данных для этого сайта.'; }
  });
  const refresh = () => {
    const games = ['durak', 'checkers', 'minesweeper', 'doom'];
    let played = 0, wins = 0;
    games.forEach(game => Object.values(loadStats(game)).forEach(level => {
      played += Number(level.played) || 0; wins += Number(level.wins) || 0;
    }));
    document.getElementById('profilePlayed').textContent = played;
    document.getElementById('profileWins').textContent = wins;
    document.getElementById('profileAchievements').textContent = `${Object.keys(achLoadUnlocked()).length} / ${ACHIEVEMENTS.length}`;
  };
  preview(); refresh();
  return { resume: refresh };
}
