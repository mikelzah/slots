/* A game keeps its DOM and state while inactive; only its clock and inputs pause. */
export function createLifecycle(root) {
  let active = true, disposed = false, offset = 0, pausedAt = 0, nextId = 1;
  const timers = new Map(), frames = new Map(), listeners = [];
  const now = () => (active ? globalThis.performance.now() : pausedAt) - offset;
  const arm = timer => {
    if (!active || disposed) return;
    timer.due = now() + timer.remaining;
    timer.native = globalThis.setTimeout(() => {
      if (!active || disposed) return;
      if (!timer.repeat) timers.delete(timer.id);
      timer.callback(...timer.args);
      if (timer.repeat && timers.has(timer.id)) { timer.remaining = timer.delay; arm(timer); }
    }, timer.remaining);
  };
  const schedule = (callback, delay = 0, repeat = false, args = []) => {
    if (disposed) return 0;
    const id = nextId++;
    const timer = { id, callback, delay, remaining: delay, repeat, args, native: null };
    timers.set(id, timer); arm(timer); return id;
  };
  const clear = id => { globalThis.clearTimeout(timers.get(id)?.native); timers.delete(id); };
  const armFrame = frame => {
    frame.native = globalThis.requestAnimationFrame(() => {
      frames.delete(frame.id);
      if (active && !disposed) frame.callback(now());
    });
  };
  const api = {
    now,
    setTimeout: (callback, delay, ...args) => schedule(callback, delay, false, args),
    setInterval: (callback, delay, ...args) => schedule(callback, delay, true, args),
    clearTimeout: clear,
    clearInterval: clear,
    clearTimers() { [...timers.keys()].forEach(clear); },
    requestAnimationFrame(callback) {
      if (disposed) return 0;
      const id = nextId++, frame = { id, callback, native: null };
      frames.set(id, frame); if (active) armFrame(frame); return id;
    },
    cancelAnimationFrame(id) { globalThis.cancelAnimationFrame(frames.get(id)?.native); frames.delete(id); },
    listen(target, type, callback, options) {
      const wrapped = event => { if (active && !disposed) callback(event); };
      target.addEventListener(type, wrapped, options);
      listeners.push(() => target.removeEventListener(type, wrapped, options));
    },
    pause() {
      if (!active || disposed) return;
      const time = now(); pausedAt = globalThis.performance.now(); active = false;
      timers.forEach(timer => { globalThis.clearTimeout(timer.native); timer.remaining = Math.max(0, timer.due - time); });
      frames.forEach(frame => globalThis.cancelAnimationFrame(frame.native));
    },
    resume() {
      if (active || disposed) return;
      offset += globalThis.performance.now() - pausedAt; active = true;
      timers.forEach(arm); frames.forEach(armFrame);
    },
    dispose() {
      api.pause(); disposed = true; timers.clear(); frames.clear(); listeners.forEach(remove => remove());
    },
  };
  const nativeDocument = globalThis.document;
  api.document = new Proxy(nativeDocument, {
    get(target, property) {
      if (property === 'getElementById') return id => root.querySelector(`[id="${CSS.escape(id)}"]`);
      if (property === 'querySelector') return selector => root.querySelector(selector);
      if (property === 'querySelectorAll') return selector => root.querySelectorAll(selector);
      if (property === 'addEventListener') return (type, callback, options) => api.listen(target, type, callback, options);
      const value = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
  return api;
}
