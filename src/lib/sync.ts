/** ฐาน URL ของ Worker (แปลง ws/wss → http/https) */
function syncBase(): string {
  const base = (import.meta.env.VITE_GROUP_WS as string | undefined)?.trim()
  if (base) return base.replace(/^ws/, 'http').replace(/\/$/, '') // wss:// → https://
  const proto = location.protocol === 'https:' ? 'https' : 'http'
  return `${proto}://${location.host}`
}

/** สุ่มรหัส sync 8 ตัว (อ่านง่าย ไม่ปน 0/O/1/I) */
export function makeSyncCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const a = new Uint8Array(8)
  crypto.getRandomValues(a)
  return Array.from(a, (b) => chars[b % chars.length]).join('')
}

export async function uploadSync(code: string, data: unknown): Promise<void> {
  const res = await fetch(`${syncBase()}/api/sync/${code}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(`อัปโหลดไม่สำเร็จ (${res.status})`)
}

export async function downloadSync(code: string): Promise<{ trips?: unknown[]; places?: unknown[] } | null> {
  const res = await fetch(`${syncBase()}/api/sync/${code}`)
  if (!res.ok) throw new Error(`ดึงข้อมูลไม่สำเร็จ (${res.status})`)
  return res.json()
}
