// IT evidence report: rooms + networks that are reliably bad, with the numbers behind each one.
import { useApi } from '../lib/useApi.js';
import { ScoreBadge } from '../components/Bits.jsx';

function downloadCsv(zones) {
  const header = ['room', 'building', 'floor', 'network', 'median_score', 'median_download_mbps', 'median_loss_pct', 'tests', 'phones', 'bad_hours'];
  const lines = zones.map((z) => [z.roomId, z.buildingId, z.floor, z.carrier, z.score, z.downMbps, z.lossPct, z.samples, z.devices, z.badHours.join(' ')].join(','));
  const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `campussignal-deadzones-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000); // give the download time to start
}

export function AdminPage() {
  const { data, error } = useApi('/api/admin/deadzones');
  if (error) return <main className="page"><p className="error">{error.message}</p></main>;
  if (!data) return <main className="page"><p>Loading…</p></main>;
  const { rule, zones, windowDays } = data;
  return (
    <main className="page wide">
      <p className="eyebrow">CampusSignal · for IT</p>
      <h1>Dead-zone report</h1>
      <p className="muted">
        A room is listed for a network when its median score over the last {windowDays} days is below {rule.threshold}, from at
        least {rule.minSamples} tests by at least {rule.minDevices} different phones.
      </p>
      {zones.length === 0 ? (
        <p>No room meets the rule right now.</p>
      ) : (
        <>
          <button type="button" className="button" onClick={() => downloadCsv(zones)}>Download CSV</button>
          <table className="slots">
            <thead>
              <tr><th>Room</th><th>Network</th><th>Score</th><th>Download</th><th>Loss</th><th>Evidence</th><th>Worst hours</th></tr>
            </thead>
            <tbody>
              {zones.map((z) => (
                <tr key={`${z.roomId}-${z.carrier}`}>
                  <td>{z.roomId}<div className="muted small">{z.buildingId} · floor {z.floor}</div></td>
                  <td>{z.carrier}</td>
                  <td><ScoreBadge score={z.score} /></td>
                  <td>{z.downMbps} Mbps</td>
                  <td>{z.lossPct}%</td>
                  <td>{z.samples} tests, {z.devices} phones</td>
                  <td>{z.badHours.map((h) => `${h}:00`).join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </main>
  );
}
