import { defineConfig } from 'vite';

// The Arena preview proxies this dev server on a remote host, so the host
// check has to stay permissive.
export default defineConfig({
  server: { host: '0.0.0.0', port: 5173, strictPort: true, allowedHosts: true },
  preview: { host: '0.0.0.0', port: 4173, allowedHosts: true },
  build: { target: 'esnext', chunkSizeWarningLimit: 2500 },
});
