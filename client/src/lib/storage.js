// localStorage can be missing or blocked (private mode, some in-app browsers). Never let it crash the app.
const memory = new Map();

export function load(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return memory.has(key) ? memory.get(key) : fallback;
  }
}

export function save(key, value) {
  memory.set(key, value);
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* kept in memory for this visit only */
  }
}

// A random id for this phone. crypto.getRandomValues works on plain http too
// (crypto.randomUUID does not, and phones on a LAN address are plain http).
export function deviceId() {
  let id = load('cs-device', null);
  if (typeof id !== 'string' || id.length < 8) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    id = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    save('cs-device', id);
  }
  return id;
}
