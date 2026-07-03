import type { PoiKind } from '../types'

interface KindMeta {
  emoji: string
  label: string
  /** badge (สีอ่อน) */
  badge: string
  /** gradient สำหรับ thumbnail placeholder */
  gradient: string
}

export const KIND_META: Record<PoiKind, KindMeta> = {
  cafe: {
    emoji: '☕',
    label: 'คาเฟ่',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    gradient: 'bg-gradient-to-br from-amber-300 to-orange-500',
  },
  restaurant: {
    emoji: '🍜',
    label: 'ร้านอาหาร',
    badge: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    gradient: 'bg-gradient-to-br from-green-300 to-emerald-600',
  },
  fuel: {
    emoji: '⛽',
    label: 'ปั๊มน้ำมัน',
    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    gradient: 'bg-gradient-to-br from-sky-400 to-blue-600',
  },
}
