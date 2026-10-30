// Lagrer navn, valg og trollboka lokalt i nettleseren. Spillet virker uten.
const KEY = 'troll-i-trappen-v1';
const defaults = () => ({ name: '', hair: 'brun', voice: true, sound: true, book: {} });

function load() {
  try {
    return { ...defaults(), ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return defaults();
  }
}

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* privat modus o.l. */ }
}

const data = load();

export const store = {
  get: () => data,
  set(patch) { Object.assign(data, patch); save(); },
  mark(typeId, field) {
    const e = (data.book[typeId] ||= { met: 0, friends: 0 });
    e[field]++;
    save();
  },
};
