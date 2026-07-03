export interface Theme {
  id: string
  name: string
  rgb: string // "R G B" สำหรับ --accent-rgb
  g1: string
  g2: string
}

export const THEMES: Theme[] = [
  { id: 'orange', name: 'ส้ม-แดง', rgb: '255 90 31', g1: '#ff7a45', g2: '#ff2d55' },
  { id: 'red', name: 'แดง', rgb: '239 68 68', g1: '#f87171', g2: '#dc2626' },
  { id: 'blue', name: 'น้ำเงิน', rgb: '59 130 246', g1: '#60a5fa', g2: '#2563eb' },
  { id: 'green', name: 'เขียว', rgb: '16 185 129', g1: '#34d399', g2: '#059669' },
  { id: 'purple', name: 'ม่วง', rgb: '168 85 247', g1: '#c084fc', g2: '#7c3aed' },
  { id: 'pink', name: 'ชมพู', rgb: '236 72 153', g1: '#f472b6', g2: '#db2777' },
  { id: 'cyan', name: 'ฟ้า', rgb: '34 211 238', g1: '#67e8f9', g2: '#0891b2' },
]

const KEY = 'moto-theme-v1'

export function applyTheme(id: string): void {
  const t = THEMES.find((x) => x.id === id) || THEMES[0]
  const r = document.documentElement
  r.style.setProperty('--accent-rgb', t.rgb)
  r.style.setProperty('--g1', t.g1)
  r.style.setProperty('--g2', t.g2)
  // theme-color ของ Safari bar
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', '#08080a')
}

export function loadThemeId(): string {
  return localStorage.getItem(KEY) || 'orange'
}

export function saveThemeId(id: string): void {
  localStorage.setItem(KEY, id)
  applyTheme(id)
}
