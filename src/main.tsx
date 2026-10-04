import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { initLocale } from './lib/i18n'
import { applyTheme, getSettings } from './lib/settings.ts'

applyTheme(getSettings().theme)
// Sprache vor dem ersten Rendern laden, sonst zeigt die Navigation kurzzeitig Deutsch
initLocale()

const root = document.getElementById('root')
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
