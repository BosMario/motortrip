import type { Poi, SavedPlace } from '../types'
import { googlePlaceLink } from '../lib/share'
import { placeKey } from '../lib/storage'
import { KIND_META } from '../lib/poiMeta'

interface Props {
  places: SavedPlace[]
  onAddWaypoint: (poi: Poi) => void
  onRemove: (key: string) => void
}

export default function SavedPlaces({ places, onAddWaypoint, onRemove }: Props) {
  if (places.length === 0) {
    return (
      <p className="text-sm text-dim text-center py-6">
        ยังไม่มีร้านที่บันทึก<br />
        กด ❤️ ที่ร้านในหน้า “วางแผน” เพื่อเก็บไว้
      </p>
    )
  }
  return (
    <ul className="flex flex-col gap-2">
      {places.map((p) => {
        const meta = KIND_META[p.kind]
        return (
        <li key={p.id} className="card-2 flex items-center gap-3 p-3">
          <div className={`w-10 h-10 shrink-0 rounded-lg flex items-center justify-center text-lg ${meta.gradient}`}>
            {meta.emoji}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm truncate">{p.name}</div>
            <div className="text-xs text-dim truncate">{p.cuisine || meta.label}</div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => onAddWaypoint(p)}
              className="btn btn-primary h-9 px-2.5 text-xs"
            >
              + จุดแวะ
            </button>
            <a
              href={googlePlaceLink(p.name, p.lat, p.lng)}
              target="_blank"
              rel="noreferrer"
              className="w-9 h-9 rounded-lg btn-ghost flex items-center justify-center"
              aria-label="ดูรูป/เมนูใน Google"
            >
              📷
            </a>
            <button
              onClick={() => onRemove(placeKey(p))}
              className="w-9 h-9 rounded-lg btn-danger active:scale-95 transition"
              aria-label="ลบร้านที่บันทึก"
            >
              🗑
            </button>
          </div>
        </li>
        )
      })}
    </ul>
  )
}
