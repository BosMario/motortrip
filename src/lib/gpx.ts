import type { Waypoint } from '../types'

const esc = (s: string) => s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c] as string)

/** สร้างไฟล์ GPX จากจุดแวะ + เส้นทาง (ใช้กับ Garmin / แอปนำทางอื่นได้) */
export function buildGPX(name: string, waypoints: Waypoint[], routeCoords?: [number, number][]): string {
  const wpts = waypoints
    .map((w) => `  <wpt lat="${w.lat}" lon="${w.lng}">\n    <name>${esc(w.name)}</name>\n  </wpt>`)
    .join('\n')
  const trk =
    routeCoords && routeCoords.length
      ? `  <trk>\n    <name>${esc(name)}</name>\n    <trkseg>\n${routeCoords
          .map(([lat, lng]) => `      <trkpt lat="${lat}" lon="${lng}"></trkpt>`)
          .join('\n')}\n    </trkseg>\n  </trk>`
      : ''
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="SAKTECHTRIP" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>${esc(name)}</name></metadata>
${wpts}
${trk}
</gpx>`
}

export interface ParsedGPX {
  name: string
  waypoints: { name: string; lat: number; lng: number }[]
}

/** อ่านไฟล์ GPX → ชื่อ + จุดแวะ (ใช้ wpt/rtept ก่อน, ถ้าไม่มีค่อยสุ่มจาก trkpt) */
export function parseGPX(xml: string): ParsedGPX | null {
  let doc: Document
  try {
    doc = new DOMParser().parseFromString(xml, 'application/xml')
  } catch {
    return null
  }
  if (doc.querySelector('parsererror')) return null

  const name = doc.querySelector('metadata > name, gpx > name, trk > name')?.textContent?.trim() || 'ทริปนำเข้า GPX'

  const readPts = (sel: string) =>
    Array.from(doc.querySelectorAll(sel)).map((el, i) => ({
      name: el.querySelector('name')?.textContent?.trim() || `จุด ${i + 1}`,
      lat: parseFloat(el.getAttribute('lat') || ''),
      lng: parseFloat(el.getAttribute('lon') || ''),
    }))

  let pts = readPts('wpt')
  if (!pts.length) pts = readPts('rtept')
  if (!pts.length) {
    // มีแต่ track → สุ่มจุดมาไม่เกิน ~12 จุด (จุดแรก/สุดท้าย + เว้นช่วง)
    const all = readPts('trkpt')
    if (all.length) {
      const step = Math.max(1, Math.floor(all.length / 10))
      pts = all.filter((_, i) => i % step === 0 || i === all.length - 1).map((p, i) => ({ ...p, name: `จุด ${i + 1}` }))
    }
  }

  const waypoints = pts.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
  if (!waypoints.length) return null
  return { name, waypoints }
}
