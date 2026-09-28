import test from 'node:test';
import assert from 'node:assert/strict';
import { createLifecycle } from '../lifecycle.js';

function environment(run) {
  const names = ['performance', 'document', 'setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame'];
  const saved = new Map(names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  let clock = 0, next = 1;
  const tasks = new Map();
  const values = {
    performance: { now: () => clock }, document: new EventTarget(),
    setTimeout(fn, delay) { const id = next++; tasks.set(id, { fn, at: clock + delay }); return id; },
    clearTimeout(id) { tasks.delete(id); },
    requestAnimationFrame(fn) { const id = next++; tasks.set(id, { fn, at: clock + 16 }); return id; },
    cancelAnimationFrame(id) { tasks.delete(id); },
  };
  const advance = ms => {
    const end = clock + ms;
    for (;;) {
      const candidate = [...tasks].filter(([, task]) => task.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!candidate) break;
      const [id, task] = candidate;
      clock = task.at; tasks.delete(id); task.fn(clock);
    }
    clock = end;
  };
  try {
    for (const name of names) Object.defineProperty(globalThis, name, { configurable: true, writable: true, value: values[name] });
    run({ advance, tasks, life: createLifecycle({ querySelector: () => null }) });
  } finally {
    for (const name of names) {
      if (saved.get(name)) Object.defineProperty(globalThis, name, saved.get(name)); else delete globalThis[name];
    }
  }
}

test('a delayed bot action keeps its remaining delay across navigation', () => environment(({life, advance}) => {
  let moves = 0;
  life.setTimeout(() => moves++, 600);
  advance(200); life.pause(); advance(5000);
  assert.equal(moves, 0); assert.equal(life.now(), 200);
  life.resume(); advance(399); assert.equal(moves, 0);
  advance(1); assert.equal(moves, 1); assert.equal(life.now(), 600);
}));

test('intervals and animation frames pause without duplicate callbacks', () => environment(({life, advance}) => {
  let ticks = 0, frames = 0;
  const interval = life.setInterval(() => ticks++, 100);
  const draw = () => { frames++; life.requestAnimationFrame(draw); };
  life.requestAnimationFrame(draw);
  advance(100); assert.equal(ticks, 1); assert.equal(frames, 6);
  life.pause(); life.pause(); advance(1000);
  assert.equal(ticks, 1); assert.equal(frames, 6);
  life.resume(); life.resume(); advance(100);
  assert.equal(ticks, 2); assert.equal(frames, 12);
  life.clearInterval(interval); advance(100); assert.equal(ticks, 2);
  life.dispose(); const last = frames; advance(1000); assert.equal(frames, last);
}));

test('inactive games ignore global input and dispose removes listeners', () => environment(({life}) => {
  const target = new EventTarget(); let hits = 0;
  life.listen(target, 'keydown', () => hits++);
  target.dispatchEvent(new Event('keydown')); assert.equal(hits, 1);
  life.pause(); target.dispatchEvent(new Event('keydown')); assert.equal(hits, 1);
  life.resume(); target.dispatchEvent(new Event('keydown')); assert.equal(hits, 2);
  life.dispose(); target.dispatchEvent(new Event('keydown')); assert.equal(hits, 2);
}));

test('new game clears pending bot actions; disposed views cannot restart work', () => environment(({life, advance, tasks}) => {
  let moves = 0;
  life.setTimeout(() => moves++, 500); life.clearTimers(); advance(600);
  assert.equal(moves, 0);
  life.dispose(); life.resume(); life.setTimeout(() => moves++, 20); life.requestAnimationFrame(() => moves++);
  advance(100); assert.equal(moves, 0); assert.equal(tasks.size, 0);
}));

test('timers scheduled during pause begin only after resume', () => environment(({life, advance}) => {
  let fired = false;
  life.pause(); life.setTimeout(() => { fired = true; }, 50); advance(1000);
  assert.equal(fired, false);
  life.resume(); advance(49); assert.equal(fired, false);
  advance(1); assert.equal(fired, true);
}));
