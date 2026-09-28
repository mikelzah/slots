/* Pure game rules, shared by the browser and Node's built-in test runner. */
(function (root) {
  'use strict';
  const LEVELS = {
    easy: { rows: 9, cols: 9, mines: 10 },
    medium: { rows: 16, cols: 16, mines: 40 },
    hard: { rows: 16, cols: 30, mines: 99 },
  };

  class Minesweeper {
    constructor(level = 'easy', random = Math.random) {
      if (!Object.hasOwn(LEVELS, level)) throw new Error('Unknown difficulty');
      Object.assign(this, LEVELS[level]);
      this.random = random;
      this.state = 'ready';
      this.opened = 0;
      this.flags = 0;
      this.exploded = -1;
      this.cells = Array.from({ length: this.rows * this.cols }, () => ({
        mine: false, open: false, flag: false, adjacent: 0,
      }));
    }

    neighbors(index) {
      const row = Math.floor(index / this.cols), col = index % this.cols;
      const result = [];
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const y = row + dy, x = col + dx;
          if ((dx || dy) && y >= 0 && y < this.rows && x >= 0 && x < this.cols) {
            result.push(y * this.cols + x);
          }
        }
      }
      return result;
    }

    plant(first) {
      const safe = new Set([first, ...this.neighbors(first)]);
      const candidates = this.cells.map((_, i) => i).filter(i => !safe.has(i));
      for (let i = 0; i < this.mines; i++) {
        const j = i + Math.floor(this.random() * (candidates.length - i));
        [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
        this.cells[candidates[i]].mine = true;
      }
      this.cells.forEach((cell, i) => {
        cell.adjacent = this.neighbors(i).filter(n => this.cells[n].mine).length;
      });
      this.state = 'playing';
    }

    toggleFlag(index) {
      const cell = this.cells[index];
      if (!cell || cell.open || this.state === 'won' || this.state === 'lost') return;
      if (!cell.flag && this.flags >= this.mines) return;
      cell.flag = !cell.flag;
      this.flags += cell.flag ? 1 : -1;
    }

    reveal(index) {
      const cell = this.cells[index];
      if (!cell || cell.flag || this.state === 'won' || this.state === 'lost') return;
      if (this.state === 'ready') this.plant(index);
      let pending = [index];
      if (cell.open) {
        const neighbors = this.neighbors(index);
        if (!cell.adjacent || neighbors.filter(n => this.cells[n].flag).length !== cell.adjacent) return;
        pending = neighbors;
      }
      while (pending.length) {
        const current = pending.pop(), next = this.cells[current];
        if (next.open || next.flag) continue;
        next.open = true;
        if (next.mine) {
          this.exploded = current;
          this.state = 'lost';
          return;
        }
        this.opened++;
        if (next.adjacent === 0) pending.push(...this.neighbors(current));
      }
      if (this.opened === this.cells.length - this.mines) {
        this.state = 'won';
        this.cells.forEach(c => { if (c.mine) c.flag = true; });
        this.flags = this.mines;
      }
    }
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { Minesweeper, LEVELS };
  else root.Minesweeper = Minesweeper;
})(globalThis);
