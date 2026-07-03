import type { SavedPlace, Trip } from '../types'

const KEY = 'moto-trips-v1'
const PLACES_KEY = 'moto-places-v1'

export function loadTrips(): Trip[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const arr = JSON.parse(raw) as Trip[]
    return Array.isArray(arr) ? arr.sort((a, b) => b.updatedAt - a.updatedAt) : []
  } catch {
    return []
  }
}

export function saveTrips(trips: Trip[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(trips))
  } catch {
    // localStorage เต็ม/ปิดใช้งาน — เงียบไว้
  }
}

export function upsertTrip(trip: Trip): Trip[] {
  const trips = loadTrips()
  const idx = trips.findIndex((t) => t.id === trip.id)
  if (idx >= 0) trips[idx] = trip
  else trips.push(trip)
  saveTrips(trips)
  return loadTrips()
}

export function deleteTrip(id: string): Trip[] {
  const trips = loadTrips().filter((t) => t.id !== id)
  saveTrips(trips)
  return trips
}

// ---------- สถานที่ที่บันทึกไว้ (favorites) ----------

/** คีย์ระบุร้านซ้ำจากตำแหน่ง (ป้องกันบันทึกร้านเดียวกันซ้ำ) */
export function placeKey(p: { name: string; lat: number; lng: number }): string {
  return `${p.name}|${p.lat.toFixed(4)}|${p.lng.toFixed(4)}`
}

export function loadPlaces(): SavedPlace[] {
  try {
    const raw = localStorage.getItem(PLACES_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw) as SavedPlace[]
    return Array.isArray(arr) ? arr.sort((a, b) => b.savedAt - a.savedAt) : []
  } catch {
    return []
  }
}

export function savePlaces(places: SavedPlace[]): void {
  try {
    localStorage.setItem(PLACES_KEY, JSON.stringify(places))
  } catch {
    // เงียบไว้
  }
}

/** สลับบันทึก/ยกเลิกบันทึกร้าน คืนรายการล่าสุด */
export function togglePlace(place: SavedPlace): SavedPlace[] {
  const places = loadPlaces()
  const k = placeKey(place)
  const idx = places.findIndex((p) => placeKey(p) === k)
  if (idx >= 0) places.splice(idx, 1)
  else places.unshift(place)
  savePlaces(places)
  return loadPlaces()
}

export function deletePlace(key: string): SavedPlace[] {
  const places = loadPlaces().filter((p) => placeKey(p) !== key)
  savePlaces(places)
  return places
}
