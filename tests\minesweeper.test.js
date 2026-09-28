const test = require('node:test');
const assert = require('node:assert/strict');
const { Minesweeper, LEVELS } = require('../minesweeper-engine.js');

function seeded(seed) {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
}

test('all levels: correct mine counts, safe first area, accurate numbers and flood fill', () => {
  for (const [level, config] of Object.entries(LEVELS)) {
    for (let seed = 1; seed <= 30; seed++) {
      const game = new Minesweeper(level, seeded(seed));
      const first = seed % 3 === 0 ? 0 : seed % 3 === 1 ? game.cells.length - 1 : Math.floor(game.cells.length / 2);
      game.reveal(first);
      assert.equal(game.cells.filter(c => c.mine).length, config.mines);
      for (const index of [first, ...game.neighbors(first)]) assert.equal(game.cells[index].mine, false);
      assert.equal(game.cells[first].adjacent, 0);
      game.cells.forEach((cell, index) => {
        assert.equal(cell.adjacent, game.neighbors(index).filter(i => game.cells[i].mine).length);
        if (cell.open && !cell.adjacent) {
          for (const neighbor of game.neighbors(index)) assert.equal(game.cells[neighbor].open, true);
        }
      });
      assert.equal(game.opened, game.cells.filter(c => c.open).length);
    }
  }
});

test('flags do not start a game, protect cells and cannot exceed the mine count', () => {
  const game = new Minesweeper('easy', seeded(7));
  for (let i = 0; i <= game.mines; i++) game.toggleFlag(i);
  assert.equal(game.flags, 10);
  assert.equal(game.cells[10].flag, false);
  game.reveal(0);
  assert.equal(game.state, 'ready');
  game.toggleFlag(0);
  assert.equal(game.flags, 9);
  game.reveal(0);
  assert.equal(game.state, 'playing');
  assert.equal(game.cells[1].open, false);
  game.toggleFlag(0);
  assert.equal(game.cells[0].flag, false);
});

test('mine loses immediately; terminal states ignore actions', () => {
  const game = new Minesweeper('easy', seeded(5));
  game.reveal(40);
  const mine = game.cells.findIndex(c => c.mine);
  game.reveal(mine);
  assert.equal(game.state, 'lost');
  assert.equal(game.exploded, mine);
  const snapshot = JSON.stringify(game);
  game.reveal(0); game.toggleFlag(0);
  assert.equal(JSON.stringify(game), snapshot);
});

test('revealing all safe cells wins without requiring flags', () => {
  const game = new Minesweeper('hard', seeded(42));
  game.reveal(200);
  game.cells.forEach((cell, i) => { if (!cell.mine) game.reveal(i); });
  assert.equal(game.state, 'won');
  assert.equal(game.opened, game.cells.length - game.mines);
  assert.equal(game.flags, game.mines);
  const snapshot = JSON.stringify(game);
  game.reveal(0); game.toggleFlag(0);
  assert.equal(JSON.stringify(game), snapshot);
});

function chordBoard() {
  const game = new Minesweeper('easy');
  game.cells[0].mine = true;
  game.cells.forEach((cell, i) => { cell.adjacent = game.neighbors(i).filter(n => game.cells[n].mine).length; });
  game.state = 'playing';
  game.reveal(10);
  return game;
}

test('chording requires matching flags, opens safe neighbors with correct flags', () => {
  const game = chordBoard();
  game.reveal(10);
  assert.equal(game.opened, 1);
  game.toggleFlag(0);
  game.reveal(10);
  assert.notEqual(game.state, 'lost');
  game.neighbors(10).filter(i => i !== 0).forEach(i => assert.equal(game.cells[i].open, true));
});

test('chording with a misplaced flag loses', () => {
  const game = chordBoard();
  game.toggleFlag(1);
  game.reveal(10);
  assert.equal(game.state, 'lost');
});

test('neighbors do not wrap across edges; each new instance is clean', () => {
  const game = new Minesweeper();
  assert.deepEqual(game.neighbors(0), [1, 9, 10]);
  assert.deepEqual(game.neighbors(80), [70, 71, 79]);
  assert.equal(game.state, 'ready');
  assert.equal(game.flags, 0);
  assert.equal(game.opened, 0);
  assert.equal(game.cells.some(c => c.mine || c.flag || c.open), false);
});
