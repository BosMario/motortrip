import type { Poi } from '../types'

const cache = new Map<string, string | null>()

/** URL รูปย่อจาก Wikimedia Commons (ฟรี ไม่ต้อง key) — <img> ตามรีไดเรกต์ได้เลย */
export function commonsThumb(file: string, width = 400): string {
  const f = file.replace(/^File:/i, '').trim()
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(f)}?width=${width}`
}

/** รูปที่ได้ทันทีโดยไม่ต้อง fetch: image tag หรือ wikimedia_commons ที่เป็นไฟล์ */
export function instantPhoto(poi: Poi): string | null {
  if (poi.image) return poi.image
  if (poi.commons && /^File:/i.test(poi.commons)) return commonsThumb(poi.commons)
  return null
}

/** ดึงรูปจาก Wikidata P18 (async + cache) — origin=* จึงเรียกจาก browser ได้ */
async function fetchWikidataPhoto(qid: string, signal?: AbortSignal): Promise<string | null> {
  if (cache.has(qid)) return cache.get(qid) as string | null
  try {
    const res = await fetch(
      `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${qid}&props=claims&format=json&origin=*`,
      { signal },
    )
    const data = await res.json()
    const file = data?.entities?.[qid]?.claims?.P18?.[0]?.mainsnak?.datavalue?.value
    const url = file ? commonsThumb(file) : null
    cache.set(qid, url)
    return url
  } catch {
    return null
  }
}

/** คืน URL รูปของ POI — ลอง instant ก่อน, ไม่มีค่อยดึงจาก Wikidata */
export async function resolvePhoto(poi: Poi, signal?: AbortSignal): Promise<string | null> {
  const inst = instantPhoto(poi)
  if (inst) return inst
  if (poi.wikidata && /^Q\d+$/.test(poi.wikidata)) return fetchWikidataPhoto(poi.wikidata, signal)
  return null
}
