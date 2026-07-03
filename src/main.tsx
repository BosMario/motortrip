import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { applyTheme, loadThemeId } from './lib/theme'

applyTheme(loadThemeId()) // ตั้งธีมสีก่อน render

const rootEl = document.getElementById('root')!
document.getElementById('boot')?.remove() // เอา boot loader ออกก่อน mount
rootEl.innerHTML = ''

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
