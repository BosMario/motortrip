import type { RouteData, Waypoint } from '../types'

const OSRM = 'https://router.project-osrm.org'

/**
 * คำนวณเส้นทางขับขี่ผ่าน waypoint ทั้งหมดด้วย OSRM public API
 * ใช้ profile "driving" (ใกล้เคียงมอเตอร์ไซค์ที่สุดในเซิร์ฟเวอร์ demo)
 */
export async function fetchRoute(waypoints: Waypoint[], signal?: AbortSignal): Promise<RouteData> {
  if (waypoints.length < 2) {
    throw new Error('ต้องมีอย่างน้อย 2 จุดเพื่อคำนวณเส้นทาง')
  }
  const coords = waypoints.map((w) => `${w.lng},${w.lat}`).join(';')
  const url = `${OSRM}/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=false`

  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`OSRM ตอบกลับผิดพลาด (${res.status})`)
  const data = await res.json()
  if (data.code !== 'Ok' || !data.routes?.length) {
    throw new Error('หาเส้นทางไม่ได้ ลองปรับตำแหน่งจุดแวะ')
  }

  const route = data.routes[0]
  const coordinates: [number, number][] = route.geometry.coordinates.map(
    ([lng, lat]: [number, number]) => [lat, lng]
  )
  const legs = (route.legs || []).map((l: { distance: number; duration: number }) => ({
    distance: l.distance,
    duration: l.duration,
  }))

  return {
    coordinates,
    distance: route.distance,
    duration: route.duration,
    legs,
  }
}
