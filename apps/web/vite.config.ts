import path from "path"
import fs from "fs"
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Repo name -> the sub-path GitHub Pages serves the site from.
// If your repo is NOT named "StatLens", change this one string.
const REPO = 'StatLens'

// GitHub Pages has no server-side rewrites, so a deep link like /StatLens/dashboard
// would 404. Publishing a copy of index.html as 404.html makes Pages hand the SPA
// back for any unknown path, and React Router then renders the right route.
function spa404() {
  return {
    name: 'spa-404',
    // writeBundle runs after Vite has written dist/ to disk, and gives us the
    // real output dir - more reliable than guessing it from __dirname.
    writeBundle(options: { dir?: string }) {
      const outDir = options.dir ?? path.resolve(__dirname, 'dist')
      const index = path.join(outDir, 'index.html')
      const target = path.join(outDir, '404.html')
      if (fs.existsSync(index)) {
        fs.copyFileSync(index, target)
        console.log(`\n  \x1b[32m✓ spa-404:\x1b[0m wrote ${target}`)
      } else {
        console.warn(`\n  \x1b[31m✗ spa-404: index.html NOT found at ${index}\x1b[0m`)
      }
    },
  }
}

export default defineConfig(({ command }) => ({
  // Absolute base in production so assets resolve from nested routes
  // (e.g. /StatLens/workbook/123). Root in dev so `npm run dev` stays at "/".
  base: command === 'build' ? `/${REPO}/` : '/',
  plugins: [
    react(), 
    spa404(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'StatLens.ico', 'icons.svg'],
      manifest: {
        name: 'StatLens',
        short_name: 'StatLens',
        description: 'Browser-based statistical analysis',
        theme_color: '#ffffff',
        icons: [
          {
            src: 'favicon.svg',
            sizes: '192x192',
            type: 'image/svg+xml'
          },
          {
            src: 'favicon.svg',
            sizes: '512x512',
            type: 'image/svg+xml'
          }
        ]
      },
      workbox: {
        // increase maximum file size to cache (Pyodide can have large wasm files, e.g. 10MB)
        maximumFileSizeToCacheInBytes: 50 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'jsdelivr-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 365
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/files\.pythonhosted\.org\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'pypi-wheels-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 365
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/pypi\.org\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'pypi-api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 365
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}))
