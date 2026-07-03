import { useEffect, useState } from 'react'

/** คืนค่าที่หน่วงเวลา — ใช้กันยิง API ถี่เกิน (Nominatim/OSRM/Overpass) */
export function useDebounced<T>(value: T, delay = 700): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}
