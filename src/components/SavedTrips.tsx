import type { Trip } from '../types'
import { formatThaiDate } from '../lib/format'

interface Props {
  trips: Trip[]
  currentId: string
  onLoad: (t: Trip) => void
  onDelete: (id: string) => void
}

export default function SavedTrips({ trips, currentId, onLoad, onDelete }: Props) {
  if (trips.length === 0) {
    return <p className="text-sm text-dim text-center py-6">ยังไม่มีทริปที่บันทึกไว้</p>
  }
  return (
    <ul className="flex flex-col gap-2">
      {trips.map((t) => (
        <li
          key={t.id}
          className={`flex items-center gap-3 rounded-xl p-3 border ${
            t.id === currentId ? 'bg-brand/10 border-brand/50' : 'card-2'
          }`}
        >
          <button onClick={() => onLoad(t)} className="flex-1 text-left min-w-0">
            <div className="font-medium truncate">{t.name || 'ทริปไม่มีชื่อ'}</div>
            <div className="text-xs text-dim">
              {t.waypoints.length} จุด{t.date ? ` · ${formatThaiDate(t.date)}` : ''}
            </div>
          </button>
          <button
            onClick={() => onDelete(t.id)}
            className="w-9 h-9 rounded-lg btn-danger active:scale-95 transition"
            aria-label="ลบทริป"
          >
            🗑
          </button>
        </li>
      ))}
    </ul>
  )
}
