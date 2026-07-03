const NOMINATIM = 'https://nominatim.openstreetmap.org/search'
const NOMINATIM_REVERSE = 'https://nominatim.openstreetmap.org/reverse'

/** หาชื่อสถานที่จากพิกัด (สำหรับตั้งชื่อจุด "ตำแหน่งฉัน") */
export async function reverseGeocode(lat: number, lng: number, signal?: AbortSignal): Promise<string> {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lng),
    format: 'jsonv2',
    zoom: '16',
    'accept-language': 'th',
  })
  try {
    const res = await fetch(`${NOMINATIM_REVERSE}?${params}`, { signal, headers: { Accept: 'application/json' } })
    if (!res.ok) return 'ตำแหน่งของฉัน'
    const d = (await res.json()) as { name?: string; display_name?: string }
    return d.name || d.display_name?.split(',').slice(0, 2).join(' ') || 'ตำแหน่งของฉัน'
  } catch {
    return 'ตำแหน่งของฉัน'
  }
}

export interface SearchResult {
  name: string
  lat: number
  lng: number
  type: string
}

/**
 * ค้นหาสถานที่ด้วย Nominatim (เน้นประเทศไทย)
 * ตาม usage policy: จำกัด 1 req/วินาที -> ควรเรียกผ่าน debounce เท่านั้น
 */
export async function searchPlace(query: string, signal?: AbortSignal): Promise<SearchResult[]> {
  const q = query.trim()
  if (q.length < 2) return []
  const params = new URLSearchParams({
    q,
    format: 'jsonv2',
    addressdetails: '0',
    limit: '6',
    countrycodes: 'th',
    'accept-language': 'th',
  })
  const res = await fetch(`${NOMINATIM}?${params}`, {
    signal,
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`ค้นหาไม่สำเร็จ (${res.status})`)
  const data = (await res.json()) as Array<{
    display_name: string
    lat: string
    lon: string
    type: string
  }>
  return data.map((d) => ({
    name: d.display_name,
    lat: parseFloat(d.lat),
    lng: parseFloat(d.lon),
    type: d.type,
  }))
}
