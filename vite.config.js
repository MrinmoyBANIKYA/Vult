import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, URL } from 'node:url';

// OCR engine files (Tesseract worker, WebAssembly core, English model), served from /ocr in development and
// copied into the build, so scanned filings are read without fetching anything from a CDN.
const OCR_FILES = () => {
  const root = fileURLToPath(new URL('./node_modules', import.meta.url));
  const core = path.join(root, 'tesseract.js-core');
  return {
    'ocr/worker.min.js': path.join(root, 'tesseract.js', 'dist', 'worker.min.js'),
    'ocr/lang/eng.traineddata.gz': path.join(root, '@tesseract.js-data', 'eng', '4.0.0_best_int', 'eng.traineddata.gz'),
    ...Object.fromEntries(
      fs
        .readdirSync(core)
        .filter(name => /^tesseract-core.*\.(wasm\.js|wasm|js)$/.test(name))
        .map(name => [`ocr/core/${name}`, path.join(core, name)])
    )
  };
};
const TYPES = { '.js': 'text/javascript', '.wasm': 'application/wasm', '.gz': 'application/gzip' };
function ocrAssets() {
  return {
    name: 'vult-ocr-assets',
    configureServer(server) {
      const files = OCR_FILES();
      server.middlewares.use((req, res, next) => {
        const file = files[decodeURIComponent((req.url || '').split('?')[0]).replace(/^\//, '')];
        if (!file) return next();
        res.setHeader('content-type', TYPES[path.extname(file)] || 'application/octet-stream');
        fs.createReadStream(file).pipe(res);
      });
    },
    generateBundle() {
      for (const [fileName, file] of Object.entries(OCR_FILES()))
        this.emitFile({ type: 'asset', fileName, source: fs.readFileSync(file) });
    }
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), ocrAssets()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) }
  },
  server: {
    port: 5173,
    open: true,
    // The Vult engine (npm run engine) runs model calls and workbook recalculation.
    proxy: { '/engine': { target: `http://127.0.0.1:${process.env.VULT_ENGINE_PORT || 8787}`, changeOrigin: false } }
  },
  preview: { port: 4173 },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 700,
    rolldownOptions: {
      output: {
        // Split heavy vendors so the app shell loads first and libraries cache well between releases.
        advancedChunks: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/, priority: 30 },
            {
              name: 'charts',
              test: /node_modules[\\/](recharts|d3-[a-z-]+|victory-vendor|@reduxjs|immer|reselect|es-toolkit|decimal\.js-light)[\\/]/,
              priority: 20
            },
            { name: 'flow', test: /node_modules[\\/]@xyflow[\\/]/, priority: 20 },
            {
              name: 'motion',
              test: /node_modules[\\/](framer-motion|motion-dom|motion-utils|@number-flow|number-flow)[\\/]/,
              priority: 20
            },
            { name: 'radix', test: /node_modules[\\/](@radix-ui|cmdk)[\\/]/, priority: 20 },
            { name: 'supabase', test: /node_modules[\\/]@supabase[\\/]/, priority: 20 },
            // ExcelJS, docx and pdf.js stay out of the shared vendor chunk: only the lazily loaded Filing desk uses them.
            { name: 'vendor', test: /node_modules[\\/](?!(exceljs|docx|pdfjs-dist)[\\/])/, priority: 10 }
          ]
        }
      }
    }
  }
});
