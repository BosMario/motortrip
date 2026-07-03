export interface TemplateStop {
  name: string
  lat: number
  lng: number
  overnight?: boolean
}

export interface RouteTemplate {
  id: string
  name: string
  emoji: string
  region: string
  desc: string
  roundTrip?: boolean
  stops: TemplateStop[]
}

/** เส้นทางมอเตอร์ไซค์ยอดนิยมในไทย — พิกัดโดยประมาณ (ปรับได้หลังโหลด) */
export const TEMPLATES: RouteTemplate[] = [
  {
    id: 'mhs-loop',
    name: 'แม่ฮ่องสอนลูป 1864 โค้ง',
    emoji: '🌀',
    region: 'เชียงใหม่–แม่ฮ่องสอน',
    desc: 'สุดยอดเส้นทางโค้งของไทย ~600 กม. 2–3 วัน',
    roundTrip: true,
    stops: [
      { name: 'เชียงใหม่', lat: 18.7883, lng: 98.9853 },
      { name: 'ปาย', lat: 19.3583, lng: 98.4418, overnight: true },
      { name: 'แม่ฮ่องสอน', lat: 19.299, lng: 97.9686, overnight: true },
      { name: 'แม่สะเรียง', lat: 18.1667, lng: 97.9333 },
    ],
  },
  {
    id: 'khaokho',
    name: 'เขาค้อ–ภูทับเบิก',
    emoji: '⛰️',
    region: 'เพชรบูรณ์',
    desc: 'ทะเลหมอก อากาศเย็น ใกล้กรุงเทพฯ 2 วัน',
    stops: [
      { name: 'กรุงเทพฯ', lat: 13.7563, lng: 100.5018 },
      { name: 'เขาค้อ', lat: 16.65, lng: 101.0333, overnight: true },
      { name: 'ภูทับเบิก', lat: 16.9333, lng: 101.1 },
    ],
  },
  {
    id: 'nan-bokluea',
    name: 'น่าน–ดอยภูคา–บ่อเกลือ',
    emoji: '🏞️',
    region: 'น่าน',
    desc: 'ถนนลอยฟ้า วิวภูเขาสวยสุด 2 วัน',
    stops: [
      { name: 'น่าน', lat: 18.7756, lng: 100.773 },
      { name: 'ดอยภูคา', lat: 19.2, lng: 101.0833 },
      { name: 'บ่อเกลือ', lat: 19.1333, lng: 101.1667, overnight: true },
    ],
  },
  {
    id: 'loei',
    name: 'เลย–ภูเรือ–เชียงคาน',
    emoji: '🌾',
    region: 'เลย',
    desc: 'เมืองริมโขง อากาศเย็น เดินถนนคนเดินเชียงคาน',
    stops: [
      { name: 'เลย', lat: 17.486, lng: 101.7223 },
      { name: 'ภูเรือ', lat: 17.45, lng: 101.35 },
      { name: 'เชียงคาน', lat: 17.8833, lng: 101.6667, overnight: true },
    ],
  },
  {
    id: 'umphang',
    name: 'แม่สอด–อุ้มผาง',
    emoji: '🌫️',
    region: 'ตาก',
    desc: 'ถนนลอยฟ้า 1219 โค้งเยอะสุดๆ สายชาเลนจ์',
    stops: [
      { name: 'แม่สอด', lat: 16.7167, lng: 98.5667 },
      { name: 'อุ้มผาง', lat: 16.0167, lng: 98.8667, overnight: true },
    ],
  },
  {
    id: 'inthanon',
    name: 'ดอยอินทนนท์',
    emoji: '🏔️',
    region: 'เชียงใหม่',
    desc: 'ยอดดอยสูงสุดของไทย ไปเช้าเย็นกลับได้',
    roundTrip: true,
    stops: [
      { name: 'เชียงใหม่', lat: 18.7883, lng: 98.9853 },
      { name: 'จอมทอง', lat: 18.4167, lng: 98.6833 },
      { name: 'ยอดดอยอินทนนท์', lat: 18.5886, lng: 98.4869 },
    ],
  },
]
