const NOMINATIM = 'https://nominatim.openstreetmap.org/search'

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
