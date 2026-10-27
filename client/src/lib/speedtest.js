// The 10-second network test that runs on the phone: ping -> download -> upload.
// onProgress({ phase, fraction, text }) is called often so the UI can animate.

const MAX_DOWNLOAD_BYTES = 25e6; // keeps one test under ~25 MB of mobile data

// A fetch that gives up after `ms`. (AbortSignal.timeout() would be shorter, but it does not exist
// on iPhones before iOS 16 or Firefox before 100; there every ping would wrongly count as lost.)
async function fetchWithTimeout(url, ms) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { cache: 'no-store', signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}
const bust = (path) => `${path}${path.includes('?') ? '&' : '?'}r=${Math.random().toString(36).slice(2)}`;

export function median(values) {
  const v = [...values].sort((a, b) => a - b);
  if (!v.length) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

// Jitter = average jump between consecutive ping times.
export function jitter(times) {
  if (times.length < 2) return times.length ? 0 : null;
  let sum = 0;
  for (let i = 1; i < times.length; i++) sum += Math.abs(times[i] - times[i - 1]);
  return sum / (times.length - 1);
}

async function pingTest(count, onProgress) {
  const times = [];
  let lost = 0;
  await fetch(bust('/api/ping'), { cache: 'no-store' }).catch(() => {}); // warm-up: opens the connection
  for (let i = 0; i < count; i++) {
    const t0 = performance.now();
    try {
      const res = await fetchWithTimeout(bust('/api/ping'), 1500);
      if (!res.ok) throw new Error(`ping ${res.status}`);
      times.push(performance.now() - t0);
    } catch {
      lost += 1;
    }
    onProgress({ phase: 'ping', fraction: (i + 1) / count, text: times.length ? `${Math.round(median(times))} ms` : '…' });
  }
  return {
    latencyMs: times.length ? Math.round(median(times)) : null,
    jitterMs: times.length ? Math.round(jitter(times)) : null,
    lossPct: Math.round((lost / count) * 1000) / 10,
  };
}

async function downloadTest(seconds, streams, onProgress) {
  let bytes = 0;
  const start = performance.now();
  const stopAt = start + seconds * 1000;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), seconds * 1000 + 500);
  const mbps = () => (bytes * 8) / Math.max((performance.now() - start) / 1000, 0.001) / 1e6;

  const one = async () => {
    while (performance.now() < stopAt && bytes < MAX_DOWNLOAD_BYTES) {
      const res = await fetch(bust('/api/dl?mb=4'), { cache: 'no-store', signal: ctrl.signal });
      if (!res.ok) throw new Error(`download failed (${res.status})`);
      const reader = res.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.length;
        onProgress({ phase: 'download', fraction: Math.min(1, (performance.now() - start) / (seconds * 1000)), text: `${mbps().toFixed(1)} Mbps` });
        if (performance.now() >= stopAt || bytes >= MAX_DOWNLOAD_BYTES) {
          ctrl.abort();
          break;
        }
      }
    }
  };
  await Promise.allSettled(Array.from({ length: streams }, one)); // parallel streams fill the pipe
  clearTimeout(timer);
  return Math.round(mbps() * 10) / 10;
}

// Upload uses XMLHttpRequest because it reports bytes sent while a request is still going.
function uploadTest(seconds, onProgress) {
  return new Promise((resolve) => {
    const chunk = new Uint8Array(1024 * 1024);
    for (let i = 0; i < chunk.length; i += 65536) crypto.getRandomValues(chunk.subarray(i, i + 65536));
    const blob = new Blob([chunk]);
    const start = performance.now();
    const stopAt = start + seconds * 1000;
    let finished = 0;
    let inFlight = 0;
    let xhr = null;
    const mbps = () => ((finished + inFlight) * 8) / Math.max((performance.now() - start) / 1000, 0.001) / 1e6;
    const done = () => {
      clearTimeout(timer);
      resolve(Math.round(mbps() * 10) / 10);
    };
    const timer = setTimeout(() => {
      xhr?.abort();
      done();
    }, seconds * 1000);
    const next = () => {
      if (performance.now() >= stopAt) return;
      xhr = new XMLHttpRequest();
      inFlight = 0;
      xhr.open('POST', bust('/api/ul'));
      xhr.upload.onprogress = (e) => {
        inFlight = e.loaded;
        onProgress({ phase: 'upload', fraction: Math.min(1, (performance.now() - start) / (seconds * 1000)), text: `${mbps().toFixed(1)} Mbps` });
      };
      xhr.onload = () => {
        finished += blob.size;
        inFlight = 0;
        next();
      };
      xhr.onerror = () => {
        inFlight = 0;
      };
      xhr.send(blob);
    };
    next();
  });
}

export function connectionType() {
  const t = navigator.connection?.type;
  return ['wifi', 'cellular', 'ethernet'].includes(t) ? t : 'unknown';
}

export async function runSpeedTest(onProgress = () => {}, { downloadSeconds = 6, uploadSeconds = 3 } = {}) {
  const ping = await pingTest(10, onProgress);
  if (ping.lossPct === 100) {
    return { downMbps: 0, upMbps: 0, ...ping, connType: connectionType() };
  }
  const downMbps = await downloadTest(downloadSeconds, 3, onProgress);
  const upMbps = await uploadTest(uploadSeconds, onProgress);
  return { downMbps, upMbps, ...ping, connType: connectionType() };
}
