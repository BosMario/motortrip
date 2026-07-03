import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { GroupMessage, GroupRole, Poi, Rider, RiderProfile, SharedRoute, SosAlert } from '../types'

export interface Checkin {
  stopIndex: number
  ts: number
  name: string
  color: string
}
import { GroupClient } from '../lib/group'
import { useWakeLock } from './useWakeLock'

const PROFILE_KEY = 'moto-rider-v1'

const RIDER_COLORS = ['#ea580c', '#2563eb', '#16a34a', '#db2777', '#9333ea', '#0d9488', '#d97706', '#dc2626']

export function loadProfile(): RiderProfile {
  try {
    const raw = localStorage.getItem(PROFILE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    /* noop */
  }
  const color = RIDER_COLORS[Math.floor((Date.now() / 1000) % RIDER_COLORS.length)]
  return { name: '', color, emoji: '🏍️' }
}

function geoErrMsg(e: GeolocationPositionError): string {
  if (e.code === e.PERMISSION_DENIED) return 'ไม่ได้รับอนุญาตเข้าถึงตำแหน่ง — เปิดสิทธิ์ใน Settings'
  if (e.code === e.POSITION_UNAVAILABLE) return 'หาตำแหน่งไม่ได้ (สัญญาณ GPS อ่อน)'
  return 'ติดตามตำแหน่งไม่สำเร็จ'
}

export function useGroup() {
  const [roomCode, setRoomCode] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)
  const [ridersMap, setRidersMap] = useState<Record<string, Rider>>({})
  const [myId, setMyId] = useState<string | null>(null)
  const [sharing, setSharing] = useState(false)
  const [myPos, setMyPos] = useState<{ lat: number; lng: number } | null>(null)
  const [error, setError] = useState('')
  const [sharedRoute, setSharedRoute] = useState<SharedRoute | null>(null)
  const [messages, setMessages] = useState<GroupMessage[]>([])
  const [sos, setSos] = useState<SosAlert | null>(null)
  const [role, setRole] = useState<GroupRole | null>(null)
  const [sharedPois, setSharedPois] = useState<Poi[]>([])
  const [checkins, setCheckins] = useState<Record<string, Checkin>>({})

  const [blocked, setBlocked] = useState<{ reason: string; ts: number } | null>(null)

  const clientRef = useRef<GroupClient | null>(null)
  const lastPos = useRef<{ lat: number; lng: number; heading?: number | null; speed?: number | null; ts: number } | null>(null)
  const msgTimes = useRef<number[]>([]) // กันสแปมฝั่ง client
  const sosTs = useRef(0)
  const wake = useWakeLock()

  const upsert = useCallback((r: Partial<Rider> & { id: string }) => {
    setRidersMap((prev) => ({ ...prev, [r.id]: { ...prev[r.id], ...r } as Rider }))
  }, [])

  const join = useCallback((code: string, profile: RiderProfile, adminKey?: string) => {
    clientRef.current?.close()
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile))
    setError('')
    setRidersMap({})
    setMyId(null)
    setSharedRoute(null)
    setMessages([])
    setSos(null)
    setBlocked(null)
    setRole(null)
    setSharedPois([])
    setCheckins({})
    msgTimes.current = []
    sosTs.current = 0
    setRoomCode(code)

    const client = new GroupClient(
      code,
      profile,
      {
        onStatus: setConnected,
        onMessage: (msg) => {
          switch (msg.type) {
            case 'snapshot':
              setMyId(msg.you)
              setRole(msg.role === 'admin' ? 'admin' : 'member')
              setRidersMap(() => {
                const m: Record<string, Rider> = {}
                for (const r of msg.riders || []) if (r?.id) m[r.id] = r
                return m
              })
              if (msg.route) setSharedRoute(msg.route)
              setSharedPois(Array.isArray(msg.pois) ? msg.pois : [])
              setCheckins(msg.checkins && typeof msg.checkins === 'object' ? msg.checkins : {})
              break
          case 'join':
            if (msg.rider?.id) upsert(msg.rider)
            break
          case 'pos':
            upsert(msg)
            break
          case 'leave':
            setRidersMap((prev) => {
              const { [msg.id]: _drop, ...rest } = prev
              return rest
            })
            break
          case 'route':
            setSharedRoute(msg.route || null)
            break
          case 'pois':
            setSharedPois(Array.isArray(msg.pois) ? msg.pois : [])
            break
          case 'checkin':
            setCheckins((prev) => ({
              ...prev,
              [msg.id]: { stopIndex: msg.stopIndex, ts: msg.ts, name: msg.name, color: msg.color },
            }))
            break
          case 'msg':
            setMessages((prev) => [...prev.slice(-29), msg as GroupMessage])
            break
          case 'sos':
            setSos(msg as SosAlert)
            break
            case 'forbidden':
              setBlocked({ reason: msg.reason || 'admin-only', ts: Date.now() })
              break
            case 'blocked':
              setBlocked({ reason: msg.reason || 'flood', ts: Date.now() })
              break
          }
        },
      },
      adminKey
    )
    clientRef.current = client
    client.connect()
  }, [upsert])

  const leave = useCallback(() => {
    setSharing(false)
    clientRef.current?.close()
    clientRef.current = null
    setConnected(false)
    setRoomCode(null)
    setRidersMap({})
    setMyId(null)
    setMyPos(null)
    setRole(null)
    setSharedRoute(null)
  }, [])

  const updateProfile = useCallback((profile: RiderProfile) => {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile))
    clientRef.current?.updateProfile(profile)
  }, [])

  const shareRoute = useCallback((route: SharedRoute) => {
    clientRef.current?.emit({ type: 'route', route })
  }, [])

  const sharePois = useCallback((pois: Poi[]) => {
    clientRef.current?.emit({ type: 'pois', pois })
  }, [])

  const checkin = useCallback((stopIndex: number) => {
    clientRef.current?.emit({ type: 'checkin', stopIndex })
  }, [])

  // ส่งข้อความ: กันสแปม (ห่าง ≥1.2 วิ, ไม่เกิน 5 ข้อความ/10 วิ) — คืน false ถ้าถูกบล็อก
  const sendMessage = useCallback((text: string, emoji = ''): boolean => {
    const now = Date.now()
    const recent = msgTimes.current.filter((t) => now - t < 10000)
    if ((recent.length && now - recent[recent.length - 1] < 1200) || recent.length >= 5) return false
    recent.push(now)
    msgTimes.current = recent
    clientRef.current?.emit({ type: 'msg', text, emoji })
    return true
  }, [])

  // ส่ง SOS: ได้ 1 ครั้ง/20 วิ — คืน false ถ้ายัง cooldown
  const sendSOS = useCallback((): boolean => {
    const now = Date.now()
    if (now - sosTs.current < 20000) return false
    sosTs.current = now
    clientRef.current?.emit({ type: 'sos' })
    return true
  }, [])

  const dismissSos = useCallback(() => setSos(null), [])

  // แชร์ตำแหน่ง: watch GPS + wake lock + throttle + heartbeat
  useEffect(() => {
    if (!sharing || !clientRef.current) return
    if (!('geolocation' in navigator)) {
      setError('อุปกรณ์ไม่รองรับระบุตำแหน่ง')
      setSharing(false)
      return
    }
    wake.enable()
    let lastSent = 0

    const watchId = navigator.geolocation.watchPosition(
      (p) => {
        setError('')
        const now = Date.now()
        const pos = {
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          heading: Number.isFinite(p.coords.heading) ? p.coords.heading : null,
          speed: Number.isFinite(p.coords.speed) ? p.coords.speed : null,
          ts: now,
        }
        lastPos.current = pos
        setMyPos({ lat: pos.lat, lng: pos.lng })
        if (now - lastSent >= 2500) {
          clientRef.current?.sendPos(pos)
          lastSent = now
        }
      },
      (e) => {
        setError(geoErrMsg(e))
        if (e.code === e.PERMISSION_DENIED) setSharing(false)
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 }
    )

    // ส่งซ้ำทุก 8 วิ เพื่อให้เพื่อนเห็นว่ายัง online (รีเฟรช ts)
    const hb = setInterval(() => {
      if (lastPos.current) clientRef.current?.sendPos({ ...lastPos.current, ts: Date.now() })
    }, 8000)

    return () => {
      navigator.geolocation.clearWatch(watchId)
      clearInterval(hb)
      wake.disable()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharing])

  // ปิด client เมื่อ unmount
  useEffect(() => () => clientRef.current?.close(), [])

  const riders = useMemo(() => Object.values(ridersMap), [ridersMap])
  const positioned = useMemo(() => riders.filter((r) => r.lat != null && r.lng != null), [riders])

  return {
    roomCode,
    connected,
    riders,
    positioned,
    myId,
    sharing,
    setSharing,
    myPos,
    error,
    sharedRoute,
    messages,
    sos,
    blocked,
    role,
    isAdmin: role === 'admin',
    inRoom: !!roomCode,
    sharedPois,
    checkins,
    join,
    leave,
    updateProfile,
    shareRoute,
    sharePois,
    checkin,
    sendMessage,
    sendSOS,
    dismissSos,
    wakeActive: wake.active,
    wakeSupported: wake.supported,
  }
}
