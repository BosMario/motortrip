/** เมตร -> ข้อความ กม./ม. ภาษาไทย */
export function formatDistance(meters: number): string {
  if (!isFinite(meters) || meters <= 0) return '0 กม.'
  if (meters < 1000) return `${Math.round(meters)} ม.`
  return `${(meters / 1000).toFixed(1)} กม.`
}

/** วินาที -> "X ชม. Y นาที" (มี buffer 20% เผื่อพักตามสเปค) */
export function formatDuration(seconds: number, buffer = false): string {
  let s = seconds
  if (buffer) s = s * 1.2
  const totalMin = Math.round(s / 60)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h === 0) return `${m} นาที`
  if (m === 0) return `${h} ชม.`
  return `${h} ชม. ${m} นาที`
}

/** ระยะทางระหว่างสองพิกัด (haversine) เป็นเมตร */
export function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const la1 = (a.lat * Math.PI) / 180
  const la2 = (b.lat * Math.PI) / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4)
}

/** วันที่ YYYY-MM-DD -> ข้อความไทย เช่น "3 ก.ค. 2569" */
export function formatThaiDate(iso: string): string {
  if (!iso) return ''
  const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  return `${d} ${months[m - 1]} ${y + 543}`
}
