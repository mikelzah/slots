const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../profile-store.js'), 'utf8');
function profileContext(value) {
  const storage = new Map(value === undefined ? [] : [['amsProfile', value]]);
  const name = { textContent: '' }, avatar = { textContent: '', dataset: {} };
  const context = vm.createContext({
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, item) => storage.set(key, item) },
    Event,
    document: {
      querySelectorAll: selector => selector === '[data-profile-name]' ? [name] : [avatar],
      querySelector: () => ({ setAttribute() {} }), dispatchEvent() {},
    },
  });
  vm.runInContext(source, context);
  return { api: vm.runInContext('AppProfile', context), storage, name, avatar };
}
test('profile defaults safely when storage is empty or malformed', () => {
  for (const value of [undefined, '{broken', 'null', '{"name":42,"color":"unknown"}']) {
    const { api, name } = profileContext(value);
    assert.equal(api.read().name, 'Игрок'); assert.equal(api.read().color, 'blue');
    assert.equal(name.textContent, 'Игрок');
  }
});
test('saved name and color update the header and survive a new session', () => {
  const { api, storage, name, avatar } = profileContext();
  api.save({ name: '  Анна Иванова  ', color: 'teal' });
  assert.equal(name.textContent, 'Анна Иванова'); assert.equal(avatar.textContent, 'АИ');
  assert.equal(avatar.dataset.color, 'teal');
  const next = profileContext(storage.get('amsProfile'));
  assert.equal(next.api.read().name, 'Анна Иванова'); assert.equal(next.api.read().color, 'teal');
});
test('invalid names are rejected without overwriting a saved profile', () => {
  const { api, storage } = profileContext();
  api.save({ name: 'Игрок', color: 'blue' });
  const before = storage.get('amsProfile');
  assert.throws(() => api.save({ name: '   ', color: 'teal' }));
  assert.throws(() => api.save({ name: 'a'.repeat(41), color: 'teal' }));
  assert.equal(storage.get('amsProfile'), before);
});
