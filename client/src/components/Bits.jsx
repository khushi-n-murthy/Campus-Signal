// Small shared UI pieces.
import { Link, useSearchParams } from 'react-router';
import { LEGEND, NETWORKS, NO_DATA, scoreHex, scoreWord } from '../lib/colors.js';

export function useNet() {
  const [params, setParams] = useSearchParams();
  const net = params.get('net') || 'All';
  const setNet = (n) => {
    const next = new URLSearchParams(params);
    if (n === 'All') next.delete('net');
    else next.set('net', n);
    setParams(next, { replace: true });
  };
  return [net, setNet];
}

// Keeps ?net= when moving between views.
export function NetLink({ to, children, ...rest }) {
  const [params] = useSearchParams();
  const net = params.get('net');
  return (
    <Link to={net ? `${to}?net=${encodeURIComponent(net)}` : to} {...rest}>
      {children}
    </Link>
  );
}

export function NetworkFilter() {
  const [net, setNet] = useNet();
  return (
    <div className="chips" role="group" aria-label="Network">
      {NETWORKS.map((n) => (
        <button key={n} type="button" className={n === net ? 'chip on' : 'chip'} onClick={() => setNet(n)}>
          {n}
        </button>
      ))}
    </div>
  );
}

export function ScoreBadge({ score, big = false }) {
  return (
    <span className={big ? 'score big' : 'score'} style={{ '--c': scoreHex(score), '--s': score == null ? 0 : Math.min(100, Math.max(0, score)) }}>
      {score == null ? '–' : Math.round(score)}
    </span>
  );
}

// inline: the copy shown inside the bottom sheet on phones (the floating one would cover the 3D view).
export function Legend({ practice, inline = false }) {
  const gradient = `linear-gradient(90deg, ${LEGEND.map((l) => `${l.color} ${l.score}%`).join(', ')})`;
  return (
    <div className={inline ? 'legend inline' : 'legend'}>
      <div className="bar" style={{ background: gradient }} />
      <div className="ticks">
        {/* each word sits in the middle of its score band: 0-30, 30-55, 55-75, 75-100 */}
        <span style={{ left: '15%' }}>Dead</span>
        <span style={{ left: '42.5%' }}>Weak</span>
        <span style={{ left: '65%' }}>Good</span>
        <span style={{ left: '87.5%' }}>Strong</span>
      </div>
      <div className="nodata">
        <i style={{ background: NO_DATA }} /> no tests yet
      </div>
      {practice && <div className="practice">Showing practice data</div>}
    </div>
  );
}

export function NetworkCard({ n }) {
  return (
    <div className="net-card" style={{ '--c': scoreHex(n.score), '--s': n.score == null ? 0 : Math.min(100, Math.max(0, n.score)) }}>
      <div className="row">
        <b>{n.carrier}</b>
        <ScoreBadge score={n.score} />
      </div>
      <div className="muted">{scoreWord(n.score)}</div>
      <div className="metrics">
        <span>↓ {n.downMbps ?? '–'} Mbps</span>
        <span>↑ {n.upMbps ?? '–'} Mbps</span>
        <span>{n.latencyMs ?? '–'} ms</span>
        <span>{n.lossPct ?? '–'}% loss</span>
      </div>
      <div className="muted small">
        {n.samples} tests · {n.devices} phones · {n.confidence} confidence
      </div>
    </div>
  );
}
