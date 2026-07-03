import L from 'leaflet'
import type { PoiKind, Rider } from '../types'

/** กันข้อความจากผู้ใช้คนอื่นแทรก HTML ลง divIcon */
function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}

/**
 * หมุด waypoint — แยกจุดเริ่ม (เขียว ▶) / สิ้นสุด (แดง 🏁) / จุดแวะ (ส้ม เลข) / ปักเอง (ม่วง)
 * มี pulse ที่จุดเริ่ม-สิ้นสุด + badge อากาศ (ถ้ามี)
 */
export function waypointIcon(index: number, total: number, custom = false, weatherEmoji?: string): L.DivIcon {
  const isStart = index === 0 && !custom
  const isEnd = index === total - 1 && total > 1 && !custom

  let bg: string, inner: string, label = '', labelBg = '', ring = ''
  if (custom) {
    bg = 'linear-gradient(135deg,#a855f7,#6d28d9)'
    inner = String(index + 1)
  } else if (isStart) {
    bg = 'linear-gradient(135deg,#22c55e,#15803d)'
    inner = '▶'
    label = 'เริ่ม'
    labelBg = '#15803d'
    ring = 'rgba(34,197,94,.5)'
  } else if (isEnd) {
    bg = 'linear-gradient(135deg,#ef4444,#991b1b)'
    inner = '🏁'
    label = 'สิ้นสุด'
    labelBg = '#991b1b'
    ring = 'rgba(239,68,68,.5)'
  } else {
    bg = 'linear-gradient(135deg,#ff7a45,#ff2d55)'
    inner = String(index + 1)
  }

  const pulse = ring ? `<span class="moto-pulse-ring" style="background:${ring}"></span>` : ''
  const wx = weatherEmoji ? `<span class="wx-badge">${esc(weatherEmoji)}</span>` : ''
  const lbl = label ? `<span class="wp-label" style="background:${labelBg}">${label}</span>` : ''

  return L.divIcon({
    className: 'moto-marker',
    html: `<div class="wp-wrap">${pulse}<div class="wp-pin" style="background:${bg}"><span>${inner}</span></div>${wx}${lbl}</div>`,
    iconSize: [44, 58],
    iconAnchor: [22, 30],
    popupAnchor: [0, -30],
  })
}

/** หมุด POI: คาเฟ่ = ส้ม, ร้านอาหาร = เขียว, ปั๊ม = น้ำเงิน */
export function poiIcon(kind: PoiKind): L.DivIcon {
  const bg = kind === 'cafe' ? '#f59e0b' : kind === 'fuel' ? '#2563eb' : '#16a34a'
  const emoji = kind === 'cafe' ? '☕' : kind === 'fuel' ? '⛽' : '🍜'
  return L.divIcon({
    className: 'moto-marker',
    html: `<div style="
      width:22px;height:22px;border-radius:50%;
      background:${bg};border:2px solid #fff;
      box-shadow:0 1px 4px rgba(0,0,0,.4);
      display:flex;align-items:center;justify-content:center;font-size:11px;">${emoji}</div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -11],
  })
}

/** หมุดไรเดอร์สด: วงกลมสีประจำตัว + emoji + ป้ายชื่อ (จางลงเมื่อขาดการอัปเดต) */
export function riderIcon(r: Rider, isMe = false): L.DivIcon {
  const stale = r.ts ? Date.now() - r.ts > 20000 : false
  // จางลงเมื่อขาดการอัปเดต; ถ้า live ให้มี pulse ระริก
  const livePulse = !stale ? `<span class="rider-pulse" style="background:${esc(r.color)}66"></span>` : ''
  const meRing = isMe ? 'box-shadow:0 0 0 3px rgba(255,255,255,.35),0 2px 6px rgba(0,0,0,.5);' : ''
  return L.divIcon({
    className: 'moto-marker',
    html: `<div class="rider-wrap" style="opacity:${stale ? 0.45 : 1}">
      <div class="rider-dot" style="background:${esc(r.color)};${meRing}">${livePulse}${esc(r.emoji)}</div>
      <span style="margin-top:2px;background:${esc(r.color)};color:#fff;font-size:10px;font-weight:700;
        padding:1px 6px;border-radius:8px;white-space:nowrap;font-family:Sarabun,sans-serif;box-shadow:0 1px 3px rgba(0,0,0,.4)">${esc(r.name || 'ไรเดอร์')}${isMe ? ' (ฉัน)' : ''}</span>
    </div>`,
    iconSize: [34, 50],
    iconAnchor: [17, 42],
    popupAnchor: [0, -42],
  })
}
