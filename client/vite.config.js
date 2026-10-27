import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// During development the 3D site runs on :5173 and forwards API + live-update calls
// to the Express server on :4000, so the browser sees one origin.
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // lets phones on the same WiFi open http://<laptop-ip>:5173
    proxy: {
      '/api': 'http://localhost:4000',
      '/socket.io': { target: 'http://localhost:4000', ws: true },
    },
  },
  build: {
    // Rewrite modern syntax so older phones (iOS 14+, Android Chrome 87+) can still run the test page.
    target: ['es2020', 'safari14', 'chrome87', 'firefox78', 'edge88'],
    chunkSizeWarningLimit: 1600, // the 3D chunk (three.js) is large; this is expected
  },
});
