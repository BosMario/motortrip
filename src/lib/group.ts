import type { RiderProfile } from '../types'

/** สร้าง WebSocket URL ของห้องจากรหัสห้อง */
export function roomWsUrl(code: string): string {
  const base = (import.meta.env.VITE_GROUP_WS as string | undefined)?.trim()
  if (base) return `${base.replace(/\/$/, '')}/api/room/${code}/ws`
  // fallback: สมมติ Worker ถูก proxy ไว้ที่ origin เดียวกันใต้ /api
  const proto = location.protocol === 'https:' ? 'wss' : 'ws'
  return `${proto}://${location.host}/api/room/${code}/ws`
}

/** สุ่มรหัสห้อง 6 ตัว (ตัวอักษร/เลขที่อ่านง่าย ไม่ปน 0/O/1/I) */
export function makeRoomCode(seed: number): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = ''
  let n = Math.floor(seed)
  for (let i = 0; i < 6; i++) {
    out += chars[n % chars.length]
    n = Math.floor(n / chars.length) + (i + 1) * 7919
  }
  return out
}

type Handler = (msg: any) => void

/**
 * GroupClient — ครอบ WebSocket ให้เชื่อมต่อห้องกลุ่ม + reconnect อัตโนมัติ
 * (สัญญาณมอเตอร์ไซค์หลุดบ่อย จึงต้องต่อใหม่เองแล้ว re-join ให้)
 */
export class GroupClient {
  private ws: WebSocket | null = null
  private code: string
  private profile: RiderProfile
  private onMsg: Handler
  private onStatus: (connected: boolean) => void
  private closedByUser = false
  private retry = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null

  constructor(
    code: string,
    profile: RiderProfile,
    handlers: { onMessage: Handler; onStatus: (connected: boolean) => void }
  ) {
    this.code = code
    this.profile = profile
    this.onMsg = handlers.onMessage
    this.onStatus = handlers.onStatus
  }

  connect() {
    this.closedByUser = false
    this.open()
  }

  private open() {
    try {
      this.ws = new WebSocket(roomWsUrl(this.code))
    } catch {
      this.scheduleReconnect()
      return
    }
    this.ws.onopen = () => {
      this.retry = 0
      this.onStatus(true)
      this.send({ type: 'join', ...this.profile })
    }
    this.ws.onmessage = (e) => {
      try {
        this.onMsg(JSON.parse(e.data))
      } catch {
        /* ข้ามข้อความที่ parse ไม่ได้ */
      }
    }
    this.ws.onclose = () => {
      this.onStatus(false)
      if (!this.closedByUser) this.scheduleReconnect()
    }
    this.ws.onerror = () => {
      try {
        this.ws?.close()
      } catch {
        /* noop */
      }
    }
  }

  private scheduleReconnect() {
    if (this.closedByUser) return
    this.retry = Math.min(this.retry + 1, 6)
    const delay = Math.min(1000 * 2 ** this.retry, 15000) // backoff สูงสุด 15 วิ
    this.reconnectTimer = setTimeout(() => this.open(), delay)
  }

  updateProfile(profile: RiderProfile) {
    this.profile = profile
    this.send({ type: 'join', ...profile })
  }

  sendPos(pos: { lat: number; lng: number; heading?: number | null; speed?: number | null; ts: number }) {
    this.send({ type: 'pos', ...pos })
  }

  private send(obj: unknown) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(obj))
    }
  }

  close() {
    this.closedByUser = true
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    try {
      this.send({ type: 'leave' })
      this.ws?.close(1000, 'left')
    } catch {
      /* noop */
    }
    this.ws = null
  }
}
