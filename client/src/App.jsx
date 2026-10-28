// The app shell: decides which view is showing. The 3D part is loaded only when needed.
import { lazy, Suspense, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { load, save } from './lib/storage.js';
import { useNet } from './components/Bits.jsx';
import { parseView } from './lib/routes.js';
import { TestPage } from './pages/TestPage.jsx';
import { PickRoomPage } from './pages/PickRoomPage.jsx';
import { AdvisorPage } from './pages/AdvisorPage.jsx';
import { AdminPage } from './pages/AdminPage.jsx';
import PlayPage from './game/PlayPage.jsx'; // GAME
import OfflineGuard from './game/OfflineGuard.jsx'; // GAME

const ThreeView = lazy(() => import('./ThreeView.jsx'));

export default function App() {
  const location = useLocation();
  const view = parseView(location.pathname);
  const [net] = useNet();
  const [lite, setLiteState] = useState(() => load('cs-lite', (navigator.hardwareConcurrency || 4) <= 4));
  const setLite = (v) => {
    setLiteState(v);
    save('cs-lite', v);
  };
  const is3D = view.kind === 'campus' || view.kind === 'building' || view.kind === 'room';

  if (is3D) {
    return (
      <div className="app3d">
        <Suspense fallback={<div className="loading3d">Loading the 3D campus…</div>}>
          <ThreeView view={view} net={net} lite={lite} />
        </Suspense>
        <LiteToggle lite={lite} setLite={setLite} />
        <OfflineGuard />
      </div>
    );
  }
  return (
    <div className="app-page">
      {view.kind === 'test' && <TestPage roomId={view.id} />}
      {view.kind === 'pick' && <PickRoomPage />}
      {view.kind === 'play' && <PlayPage />}
      {view.kind === 'advisor' && <AdvisorPage />}
      {view.kind === 'admin' && <AdminPage />}
      {view.kind === 'notfound' && (
        <main className="page">
          <h1>Page not found</h1>
          <Link to="/">Go to the campus map</Link>
        </main>
      )}
      <OfflineGuard />
      <nav className="page-nav">
        <Link to="/">← Campus map</Link>
      </nav>
    </div>
  );
}

function LiteToggle({ lite, setLite }) {
  return (
    <button type="button" className="lite-toggle" onClick={() => setLite(!lite)} title="Lite mode: fewer effects for slower phones">
      {lite ? 'Lite mode: on' : 'Lite mode: off'}
    </button>
  );
}
