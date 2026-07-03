import { useEffect, useRef, useState } from 'react'
import type { Ride } from '../types'
import { addRide } from '../lib/storage'
import { haversine, uid } from '../lib/format'
import { useWakeLock } from './useWakeLock'

/**
 * บันทึกการขับจริงจาก GPS — watchPosition สะสมระยะ (กรอง jitter) + กันจอดับ
 * iOS: ทำงานตอนเปิดแอปค้างหน้าจอเท่านั้น (เหมือนแชร์ตำแหน่งกลุ่ม)
 */
export function useRideRecorder() {
  const [recording, setRecording] = useState(false)
  const [distanceM, setDistanceM] = useState(0)
  const [elapsedS, setElapsedS] = useState(0)
  const [track, setTrack] = useState<[number, number][]>([])
  const [error, setError] = useState('')

  const lastPos = useRef<{ lat: number; lng: number } | null>(null)
  const startTs = useRef(0)
  const distRef = useRef(0)
  const wake = useWakeLock()

  const start = () => {
    if (!('geolocation' in navigator)) {
      setError('อุปกรณ์ไม่รองรับ GPS')
      return
    }
    setDistanceM(0)
    setElapsedS(0)
    setTrack([])
    setError('')
    distRef.current = 0
    lastPos.current = null
    startTs.current = Date.now()
    setRecording(true)
  }

  /** หยุด + บันทึก คืน Ride (null ถ้าระยะ 0) */
  const stop = (): Ride | null => {
    setRecording(false)
    const durationS = Math.round((Date.now() - startTs.current) / 1000)
    const distanceM = distRef.current
    if (distanceM < 50) return null // สั้นเกินไป ไม่บันทึก
    const ride: Ride = { id: uid(), date: new Date().toISOString(), distanceM, durationS }
    addRide(ride)
    return ride
  }

  useEffect(() => {
    if (!recording) return
    wake.enable()
    const watchId = navigator.geolocation.watchPosition(
      (p) => {
        setError('')
        const pos = { lat: p.coords.latitude, lng: p.coords.longitude }
        if (lastPos.current) {
          const d = haversine(lastPos.current, pos)
          // กรอง jitter: ขยับ 6–500 ม.ต่อ tick เท่านั้น
          if (d >= 6 && d <= 500) {
            distRef.current += d
            setDistanceM(distRef.current)
            setTrack((t) => (t.length > 3000 ? t : [...t, [pos.lat, pos.lng]]))
            lastPos.current = pos
          }
        } else {
          lastPos.current = pos
          setTrack([[pos.lat, pos.lng]])
        }
      },
      (e) => setError(e.code === e.PERMISSION_DENIED ? 'ไม่ได้รับอนุญาตตำแหน่ง' : 'สัญญาณ GPS อ่อน'),
      { enableHighAccuracy: true, maximumAge: 1500, timeout: 15000 }
    )
    const timer = setInterval(() => setElapsedS(Math.round((Date.now() - startTs.current) / 1000)), 1000)
    return () => {
      navigator.geolocation.clearWatch(watchId)
      clearInterval(timer)
      wake.disable()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording])

  return { recording, distanceM, elapsedS, track, error, start, stop }
}
