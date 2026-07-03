import type { SharePayload, Trip, Waypoint } from '../types'
import { uid } from './format'

/** base64url encode ที่รองรับ unicode (ชื่อไทย) */
function b64urlEncode(str: string): string {
  const bytes = new TextEncoder().encode(str)
  let bin = ''
  bytes.forEach((b) => (bin += String.fromCharCode(b)))
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function b64urlDecode(str: string): string {
  const pad = str.length % 4 ? '='.repeat(4 - (str.length % 4)) : ''
  const bin = atob(str.replace(/-/g, '+').replace(/_/g, '/') + pad)
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

/** สร้าง URL แชร์ทริป (เก็บใน hash เพื่อไม่ให้ถูกส่งไป server) */
export function encodeTripToUrl(trip: Trip): string {
  const payload: SharePayload = {
    n: trip.name,
    d: trip.date,
    w: trip.waypoints.map((w) => {
      const base: [string, number, number, 0 | 1, string?] = [
        w.name,
        +w.lat.toFixed(5),
        +w.lng.toFixed(5),
        w.custom ? 1 : 0,
      ]
      if (w.note) base[4] = w.note
      return base
    }),
  }
  const code = b64urlEncode(JSON.stringify(payload))
  const base = typeof location !== 'undefined' ? location.origin + location.pathname : ''
  return `${base}#t=${code}`
}

/** อ่านทริปจาก hash (#t=...) คืน null ถ้าไม่มี/พัง */
export function decodeTripFromUrl(hash = location.hash): Trip | null {
  const m = hash.match(/[#&]t=([^&]+)/)
  if (!m) return null
  try {
    const payload = JSON.parse(b64urlDecode(m[1])) as SharePayload
    const waypoints: Waypoint[] = payload.w.map((w) => ({
      id: uid(),
      name: w[0],
      lat: w[1],
      lng: w[2],
      custom: w[3] === 1,
      note: w[4],
    }))
    return {
      id: uid(),
      name: payload.n || 'ทริปที่แชร์มา',
      date: payload.d || '',
      waypoints,
      updatedAt: Date.now(),
    }
  } catch {
    return null
  }
}

export function googleMapsLink(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
}

/**
 * ลิงก์นำทาง Google Maps ทั้งทริป (turn-by-turn)
 * origin = จุดแรก, destination = จุดสุดท้าย, waypoints = จุดกลาง (Google จำกัด ~9 จุด)
 */
export function googleDirectionsLink(wps: { lat: number; lng: number }[]): string {
  if (wps.length < 2) return ''
  const o = wps[0]
  const d = wps[wps.length - 1]
  const mid = wps.slice(1, -1).slice(0, 8) // จำกัดจุดกลาง 8 จุด
  const params = new URLSearchParams({
    api: '1',
    origin: `${o.lat},${o.lng}`,
    destination: `${d.lat},${d.lng}`,
    travelmode: 'driving',
  })
  let url = `https://www.google.com/maps/dir/?${params}`
  if (mid.length) url += `&waypoints=${mid.map((w) => `${w.lat},${w.lng}`).join('%7C')}`
  return url
}

/**
 * ลิงก์ค้นร้านบน Google Maps ด้วย "ชื่อร้าน + พิกัด"
 * หน้าที่เปิดจะมีรูปจริง เมนู รีวิว เวลาเปิด-ปิด ของร้านนั้น (ข้อมูลจาก Google)
 */
export function googlePlaceLink(name: string, lat: number, lng: number): string {
  const q = encodeURIComponent(`${name} ${lat},${lng}`)
  return `https://www.google.com/maps/search/?api=1&query=${q}`
}

/** แชร์ผ่าน Web Share API (iOS share sheet) หรือ fallback copy */
export async function shareUrl(url: string, title: string): Promise<'shared' | 'copied'> {
  if (navigator.share) {
    try {
      await navigator.share({ title, text: title, url })
      return 'shared'
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'shared'
      // ตกไป copy
    }
  }
  await navigator.clipboard.writeText(url)
  return 'copied'
}
