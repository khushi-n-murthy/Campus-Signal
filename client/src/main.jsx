import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { LiveProvider } from './lib/live.jsx';
import App from './App.jsx';
import '@fontsource-variable/archivo/wdth.css';
import { GameProvider } from './game/GameContext.jsx';
import GameLayer from './game/GameLayer.jsx';
import '@fontsource/press-start-2p'; // GAME: pixel fonts, bundled so they also work offline
import '@fontsource/vt323';
import './styles.css';
import './game/neon.css'; // GAME: game screens and sprites (scoped to gm-/px- classes, so the site theme is untouched)

// No <StrictMode> on purpose: it runs every effect twice, which tears down and rebuilds the WebGL
// canvas and its floating labels (in testing, a network label went missing with it on).
createRoot(document.getElementById('root')).render(
  <LiveProvider>
    <BrowserRouter>
      <GameProvider>
        <App />
        <GameLayer />
      </GameProvider>
    </BrowserRouter>
  </LiveProvider>,
);
