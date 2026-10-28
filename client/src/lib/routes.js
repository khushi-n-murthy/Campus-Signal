// Turns the address bar into "which view is this?". Pure, so it can be tested in Node.

function safeDecode(part) {
  try {
    return decodeURIComponent(part);
  } catch {
    return part; // a broken %-escape in the address must not crash the app
  }
}

// "/" -> campus, "/b/A" -> building A, "/r/A-101" -> room, everything else -> a normal page.
export function parseView(pathname) {
  const parts = pathname.split('/').filter(Boolean).map(safeDecode);
  if (parts.length === 0) return { kind: 'campus' };
  if (parts[0] === 'b' && parts[1]) return { kind: 'building', id: parts[1].toUpperCase() };
  if (parts[0] === 'r' && parts[1]) return { kind: 'room', id: parts[1].toUpperCase() };
  if (parts[0] === 't' && parts[1]) return { kind: 'test', id: parts[1].toUpperCase() };
  if (parts[0] === 'test') return { kind: 'pick' };
  if (parts[0] === 'play') return { kind: 'play' }; // GAME
  if (parts[0] === 'advisor') return { kind: 'advisor' };
  if (parts[0] === 'admin') return { kind: 'admin' };
  return { kind: 'notfound' };
}
