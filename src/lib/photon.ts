import { searchPlace, type SearchResult } from './nominatim'

const PHOTON = 'https://photon.komoot.io/api/'

interface PhotonProps {
  name?: string
  street?: string
  housenumber?: string
  district?: string
  city?: string
  county?: string
  state?: string
  country?: string
  countrycode?: string
  osm_value?: string
  type?: string
}

/** ประกอบชื่อ + บริบท (อำเภอ/จังหวัด) แบบอ่านง่าย */
function buildName(p: PhotonProps): string {
  const area = p.district || p.city || p.county
  const parts = [p.name, p.street && p.name !== p.street ? p.street : null, area, p.state].filter(Boolean)
  return parts.join(', ') || 'สถานที่'
}

/** ค้นหาด้วย Photon (Komoot) — ฟรี ไม่ต้อง key, ค้นเก่งกว่า/พิมพ์ไม่ครบก็เจอ; bias มาไทย */
export async function searchPhoton(query: string, signal?: AbortSignal): Promise<SearchResult[]> {
  const q = query.trim()
  if (q.length < 2) return []
  const params = new URLSearchParams({ q, limit: '7', lat: '15.87', lon: '100.99' }) // bias กลางไทย
  const res = await fetch(`${PHOTON}?${params}`, { signal, headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`ค้นหาไม่สำเร็จ (${res.status})`)
  const data = (await res.json()) as { features?: { geometry: { coordinates: [number, number] }; properties: PhotonProps }[] }
  const feats = data.features || []
  // ดันผลลัพธ์ในไทยขึ้นก่อน
  feats.sort((a, b) => (b.properties.countrycode === 'TH' ? 1 : 0) - (a.properties.countrycode === 'TH' ? 1 : 0))
  return feats.map((f) => ({
    name: buildName(f.properties),
    lat: f.geometry.coordinates[1],
    lng: f.geometry.coordinates[0],
    type: f.properties.osm_value || f.properties.type || '',
  }))
}

/** ค้นหาหลัก: Photon ก่อน (ค้นเก่ง) ถ้าไม่เจอค่อย fallback Nominatim */
export async function searchPlaces(query: string, signal?: AbortSignal): Promise<SearchResult[]> {
  try {
    const r = await searchPhoton(query, signal)
    if (r.length) return r
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e
  }
  return searchPlace(query, signal)
}
