import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { LiveProvider } from './lib/live.jsx';
import App from './App.jsx';
import './styles.css';

// No <StrictMode> on purpose: it runs every effect twice, which tears down and rebuilds the WebGL
// canvas and its floating labels (in testing, a network label went missing with it on).
createRoot(document.getElementById('root')).render(
  <LiveProvider>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </LiveProvider>,
);
