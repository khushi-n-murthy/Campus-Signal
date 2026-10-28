// Small helpers for talking to the Express API. Errors carry the server's message.
export async function getJSON(url, { signal, headers } = {}) {
  const res = await fetch(url, { signal, headers: { Accept: 'application/json', ...headers } });
  return handle(res);
}

export async function postJSON(url, body, { method = 'POST', headers } = {}) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  return handle(res);
}

async function handle(res) {
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    const err = new Error(data?.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.details = data?.details;
    throw err;
  }
  return data;
}

// Adds ?carrier= when a network filter is chosen.
export function withNet(url, net) {
  if (!net || net === 'All') return url;
  return `${url}${url.includes('?') ? '&' : '?'}carrier=${encodeURIComponent(net)}`;
}
