import { useState } from 'react'
import type { SavedPlace, Trip } from '../types'
import { downloadSync, makeSyncCode, uploadSync } from '../lib/sync'

interface Props {
  trips: Trip[]
  places: SavedPlace[]
  onPull: (trips: Trip[], places: SavedPlace[]) => void
  onNotify: (msg: string) => void
}

const CODE_KEY = 'moto-sync-code'

export default function SyncPanel({ trips, places, onPull, onNotify }: Props) {
  const [code, setCode] = useState<string>(() => localStorage.getItem(CODE_KEY) || '')
  const [busy, setBusy] = useState<'' | 'up' | 'down'>('')

  const saveCode = (c: string) => {
    setCode(c)
    localStorage.setItem(CODE_KEY, c)
  }

  const upload = async () => {
    const c = code.trim().toUpperCase()
    if (c.length < 6) return onNotify('รหัส sync ต้องอย่างน้อย 6 ตัว')
    saveCode(c)
    setBusy('up')
    try {
      await uploadSync(c, { v: 1, trips, places })
      onNotify(`อัปทริปขึ้นคลาวด์แล้ว ☁️ (${trips.length} ทริป)`)
    } catch {
      onNotify('อัปโหลดไม่สำเร็จ ลองใหม่')
    } finally {
      setBusy('')
    }
  }

  const download = async () => {
    const c = code.trim().toUpperCase()
    if (c.length < 6) return onNotify('ใส่รหัส sync ก่อน')
    if (!window.confirm('ดึงข้อมูลจากคลาวด์มาแทนที่ทริป/ร้านในเครื่องนี้?')) return
    saveCode(c)
    setBusy('down')
    try {
      const data = await downloadSync(c)
      if (!data || !Array.isArray(data.trips)) {
        onNotify('ไม่พบข้อมูลของรหัสนี้')
        return
      }
      onPull((data.trips as Trip[]) || [], (data.places as SavedPlace[]) || [])
      onNotify(`ดึงจากคลาวด์แล้ว ✓ (${data.trips.length} ทริป)`)
    } catch {
      onNotify('ดึงข้อมูลไม่สำเร็จ ลองใหม่')
    } finally {
      setBusy('')
    }
  }

  return (
    <div className="card p-3 flex flex-col gap-2.5">
      <div className="label">☁️ Sync ทริปข้ามเครื่อง</div>
      <p className="text-[11px] text-dim leading-relaxed">
        ตั้งรหัสส่วนตัว → อัปทริปขึ้นคลาวด์ · ใช้รหัสเดียวกันบนเครื่องอื่นเพื่อดึงทริปมา (ฟรี ไม่ต้องล็อกอิน)
      </p>
      <div className="flex gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="รหัส sync (เช่น K7P2QX)"
          maxLength={20}
          className="field flex-1 px-3 py-2.5 text-sm tracking-widest font-mono uppercase"
        />
        <button onClick={() => saveCode(makeSyncCode())} className="btn btn-ghost px-3 text-xs whitespace-nowrap">
          ✨ สุ่มรหัส
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button onClick={upload} disabled={!!busy} className="btn btn-primary py-2.5 text-sm disabled:opacity-50">
          {busy === 'up' ? 'กำลังอัป…' : '⬆️ อัปขึ้นคลาวด์'}
        </button>
        <button onClick={download} disabled={!!busy} className="btn btn-ghost py-2.5 text-sm disabled:opacity-50">
          {busy === 'down' ? 'กำลังดึง…' : '⬇️ ดึงจากคลาวด์'}
        </button>
      </div>
    </div>
  )
}
