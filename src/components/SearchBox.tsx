import { useEffect, useRef, useState } from 'react'
import { searchPlace, type SearchResult } from '../lib/nominatim'
import { useDebounced } from '../hooks/useDebounced'

interface Props {
  onPick: (r: SearchResult) => void
}

export default function SearchBox({ onPick }: Props) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)
  const debounced = useDebounced(q, 800) // เคารพ policy 1req/วิ ของ Nominatim
  const ctrl = useRef<AbortController | null>(null)

  useEffect(() => {
    const query = debounced.trim()
    if (query.length < 2) {
      setResults([])
      setError('')
      return
    }
    ctrl.current?.abort()
    const ac = new AbortController()
    ctrl.current = ac
    setLoading(true)
    setError('')
    searchPlace(query, ac.signal)
      .then((r) => {
        setResults(r)
        setOpen(true)
      })
      .catch((e) => {
        if (e.name !== 'AbortError') setError('ค้นหาไม่สำเร็จ ลองใหม่อีกครั้ง')
      })
      .finally(() => setLoading(false))
    return () => ac.abort()
  }, [debounced])

  const pick = (r: SearchResult) => {
    onPick(r)
    setQ('')
    setResults([])
    setOpen(false)
  }

  return (
    <div className="relative">
      <div className="field flex items-center gap-2 px-3 py-2.5">
        <span className="text-dim">🔍</span>
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setOpen(true)
          }}
          onFocus={() => results.length && setOpen(true)}
          placeholder="ค้นหาสถานที่เพื่อเพิ่มจุดแวะ…"
          className="flex-1 bg-transparent outline-none"
          enterKeyHint="search"
        />
        {loading && <span className="text-xs text-dim animate-pulse">กำลังหา…</span>}
        {q && (
          <button onClick={() => { setQ(''); setResults([]) }} className="text-dim text-lg leading-none">
            ×
          </button>
        )}
      </div>

      {error && <p className="text-xs text-[#ff6a5f] mt-1 px-1">{error}</p>}

      {open && results.length > 0 && (
        <ul className="absolute z-[1000] left-0 right-0 mt-1 bg-ink-700 rounded-xl shadow-card border border-white/10 overflow-hidden max-h-64 overflow-y-auto no-scrollbar">
          {results.map((r, i) => (
            <li key={i}>
              <button
                onClick={() => pick(r)}
                className="w-full text-left px-3 py-2.5 active:bg-white/[0.06] border-b border-white/[0.06] last:border-0"
              >
                <div className="text-sm line-clamp-2">{r.name}</div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
