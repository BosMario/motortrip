import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Screen Wake Lock — กันจอ iPhone ดับระหว่างติดตามตำแหน่ง (iOS 16.4+)
 * ถ้าเบราว์เซอร์ไม่รองรับจะ no-op เงียบ ๆ
 * re-acquire ให้อัตโนมัติเมื่อกลับมาหน้าจอ (iOS ปล่อย lock เมื่อสลับแอป)
 */
export function useWakeLock() {
  const [active, setActive] = useState(false)
  const [supported] = useState(() => typeof navigator !== 'undefined' && 'wakeLock' in navigator)
  const sentinel = useRef<WakeLockSentinel | null>(null)
  const want = useRef(false)

  const acquire = useCallback(async () => {
    if (!supported) return
    try {
      sentinel.current = await (navigator as Navigator & { wakeLock: WakeLock }).wakeLock.request('screen')
      setActive(true)
      sentinel.current.addEventListener('release', () => setActive(false))
    } catch {
      setActive(false)
    }
  }, [supported])

  const enable = useCallback(async () => {
    want.current = true
    await acquire()
  }, [acquire])

  const disable = useCallback(async () => {
    want.current = false
    try {
      await sentinel.current?.release()
    } catch {
      /* noop */
    }
    sentinel.current = null
    setActive(false)
  }, [])

  useEffect(() => {
    const onVisible = () => {
      if (want.current && document.visibilityState === 'visible') acquire()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [acquire])

  return { active, supported, enable, disable }
}
