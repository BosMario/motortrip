import L from 'leaflet'
import type { PoiKind, Rider } from '../types'

/** กันข้อความจากผู้ใช้คนอื่นแทรก HTML ลง divIcon */
function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}

/** หมุด waypoint แบบมีเลขลำดับ */
export function waypointIcon(index: number, custom = false): L.DivIcon {
  const bg = custom ? '#7c3aed' : '#ea580c'
  return L.divIcon({
    className: 'moto-marker',
    html: `<div style="
      width:30px;height:30px;border-radius:50% 50% 50% 0;
      background:${bg};transform:rotate(-45deg);
      border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.4);
      display:flex;align-items:center;justify-content:center;">
      <span style="transform:rotate(45deg);color:#fff;font-weight:700;font-size:13px;font-family:Sarabun,sans-serif;">${index + 1}</span>
    </div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 30],
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
  const ring = isMe ? '#ffffff' : '#ffffff'
  const pulse = isMe ? 'box-shadow:0 0 0 4px rgba(234,88,12,.35);' : ''
  return L.divIcon({
    className: 'moto-marker',
    html: `<div style="display:flex;flex-direction:column;align-items:center;opacity:${stale ? 0.45 : 1}">
      <div style="width:34px;height:34px;border-radius:50%;background:${esc(r.color)};border:3px solid ${ring};${pulse}
        box-shadow:0 2px 6px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;font-size:16px;">${esc(r.emoji)}</div>
      <span style="margin-top:2px;background:${esc(r.color)};color:#fff;font-size:10px;font-weight:700;
        padding:1px 6px;border-radius:8px;white-space:nowrap;font-family:Sarabun,sans-serif;box-shadow:0 1px 3px rgba(0,0,0,.3)">${esc(r.name || 'ไรเดอร์')}${isMe ? ' (ฉัน)' : ''}</span>
    </div>`,
    iconSize: [34, 50],
    iconAnchor: [17, 42],
    popupAnchor: [0, -42],
  })
}
