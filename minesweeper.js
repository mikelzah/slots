export function mount(lifecycle) {
const { document, setTimeout, setInterval, clearTimeout, clearInterval, requestAnimationFrame, cancelAnimationFrame } = lifecycle;
const performance = { now: lifecycle.now };
(() => {
  'use strict';
  const board = document.getElementById('mineBoard');
  const status = document.getElementById('mineStatus');
  const level = document.getElementById('mineDifficulty');
  const flagButton = document.getElementById('flagMode');
  const timer = document.getElementById('mineTimer');
  let game, buttons, startedAt, interval, flagMode = false, recorded = false;

  function updateTimer() {
    timer.textContent = startedAt === null ? '0' : Math.floor((performance.now() - startedAt) / 1000);
  }

  function render() {
    const finished = game.state === 'won' || game.state === 'lost';
    buttons.forEach((button, i) => {
      const cell = game.cells[i];
      const mine = finished && cell.mine;
      const wrong = game.state === 'lost' && cell.flag && !cell.mine;
      button.className = 'mine-cell' + (cell.open ? ' is-open' : '') +
        (mine ? ' is-mine' : '') + (wrong ? ' is-wrong' : '') +
        (i === game.exploded ? ' is-exploded' : '');
      button.textContent = wrong ? '✕' : cell.flag ? '🚩' : mine ? '💣' : cell.open ? cell.adjacent || '' : '';
      button.dataset.number = cell.open ? cell.adjacent : '';
      const description = wrong ? 'ошибочный флаг' : cell.flag ? 'флаг' : mine ? 'мина' :
        cell.open ? (cell.adjacent ? `мин рядом: ${cell.adjacent}` : 'пусто') : 'закрыто';
      button.setAttribute('aria-label', `Ряд ${Math.floor(i / game.cols) + 1}, столбец ${i % game.cols + 1}: ${description}`);
      button.setAttribute('aria-disabled', String(finished));
    });
    document.getElementById('mineCount').textContent = game.mines - game.flags;
    document.getElementById('mineProgress').textContent = `${game.opened} / ${game.cells.length - game.mines}`;
    status.textContent = game.state === 'won' ? 'Победа! Все безопасные клетки открыты.' :
      game.state === 'lost' ? 'Мина! Попробуйте ещё раз — начните новую игру.' :
      game.state === 'ready' ? 'Откройте любую клетку — первый ход безопасен.' :
      flagMode ? 'Режим флажков: нажмите на клетку, чтобы поставить или убрать флаг.' : 'Найдите все безопасные клетки.';
    status.dataset.state = game.state;
    if (finished && !recorded) {
      recorded = true;
      clearInterval(interval);
      updateTimer();
      try { recordGameResult('minesweeper', level.value, game.state === 'won' ? 'win' : 'loss'); }
      catch { status.textContent += ' Браузер не разрешил сохранить статистику.'; }
    }
  }

  function act(index, flag = false) {
    const before = game.state;
    if (flag) game.toggleFlag(index);
    else game.reveal(index);
    if (before === 'ready' && game.state !== 'ready') {
      startedAt = performance.now();
      interval = setInterval(updateTimer, 250);
    }
    render();
  }

  function setFlagMode(value) {
    flagMode = value;
    flagButton.setAttribute('aria-pressed', String(value));
    flagButton.textContent = value ? '🚩 Флажки: вкл.' : '🚩 Флажки: выкл.';
  }

  function newGame() {
    clearInterval(interval);
    startedAt = null;
    recorded = false;
    setFlagMode(false);
    game = new Minesweeper(level.value);
    updateTimer();
    board.style.setProperty('--mine-cols', game.cols);
    board.setAttribute('aria-label', `Поле ${game.rows} на ${game.cols}, мин: ${game.mines}`);
    board.replaceChildren();
    buttons = game.cells.map((_, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.tabIndex = index === 0 ? 0 : -1;
      button.addEventListener('click', () => act(index, flagMode));
      button.addEventListener('contextmenu', event => { event.preventDefault(); act(index, true); });
      button.addEventListener('focus', () => {
        buttons.forEach(b => { b.tabIndex = -1; });
        button.tabIndex = 0;
      });
      button.addEventListener('keydown', event => {
        if (event.code === 'KeyF') { event.preventDefault(); act(index, true); return; }
        const row = Math.floor(index / game.cols), col = index % game.cols;
        const targets = {
          ArrowLeft: row * game.cols + Math.max(0, col - 1),
          ArrowRight: row * game.cols + Math.min(game.cols - 1, col + 1),
          ArrowUp: Math.max(0, row - 1) * game.cols + col,
          ArrowDown: Math.min(game.rows - 1, row + 1) * game.cols + col,
        };
        if (Object.hasOwn(targets, event.key)) {
          event.preventDefault(); buttons[targets[event.key]].focus();
        }
      });
      board.appendChild(button);
      return button;
    });
    render();
  }

  document.getElementById('newGameBtn').addEventListener('click', newGame);
  level.addEventListener('change', newGame);
  flagButton.addEventListener('click', () => { setFlagMode(!flagMode); render(); });
  initStatsPanel('minesweeper');
  newGame();
})();

}
