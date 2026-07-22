import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import '@fontsource/inter'
import '@fontsource/roboto'
import '@fontsource/lato'
import '@fontsource/open-sans'
import '@fontsource/source-sans-3'
import '@fontsource/nunito-sans'
import '@fontsource/montserrat'
import '@fontsource/arimo'
import '@fontsource/ibm-plex-sans'
import '@fontsource/merriweather'
import '@fontsource/roboto-slab'
import '@fontsource/ibm-plex-serif'
import '@fontsource/roboto-mono'
import '@fontsource/ibm-plex-mono'
import '@fontsource/jetbrains-mono'
import App from './App.tsx'
import { registerSW } from 'virtual:pwa-register'

// Register service worker for PWA
registerSW({ immediate: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
