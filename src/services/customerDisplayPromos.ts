import { DisplayPromotion } from '../types/customerDisplay';

export const DEFAULT_PROMOTIONS: DisplayPromotion[] = [
  {
    id: 'promo-01',
    title: 'ไอซ์คาราเมลมัคคิอาโต้ (สินค้าขายดีอันดับ 1)',
    subtitle: 'Iced Caramel Macchiato Medium Roast — ส่วนลด 20% ทันทีเมื่อสั่งคู่ขนมเบเกอรี่ใดๆ',
    tag: '⚡ สินค้าขายดีประจำคลังสินค้า (TOP SELLER #1)',
    discountBadge: '20% OFF',
    imageUrl: '/src/assets/images/minimart_iced_latte_1791396408236.jpg',
    accentColor: '#10b981', // emerald
    expiryNote: 'โปรโมชันพิเศษวันนี้ • รับคะแนนสะสมคูณสอง',
  },
  {
    id: 'promo-02',
    title: 'ครัวซองต์เนยสดฝรั่งเศส AOP อบสดใหม่',
    subtitle: 'Artisan French AOP Butter Croissant — ซื้อกาแฟแก้วโปรดพร้อมครัวซองต์ในราคาพิเศษเพียง ฿150',
    tag: '🥐 เบเกอรี่ขายดีอันดับ 1 (BESTSELLER BAKERY)',
    discountBadge: 'ประหยัด ฿35',
    imageUrl: '/src/assets/images/minimart_croissant_butter_1791396420438.jpg',
    accentColor: '#f59e0b', // amber
    expiryNote: 'อบสดใหม่จากเตาทุกเช้าตั้งแต่ 07:00 น.',
  },
  {
    id: 'promo-03',
    title: 'น้ำแร่ออแกนิกพรีเมียม & เครื่องดื่มเพื่อสุขภาพ',
    subtitle: 'PRODX Premium Hydration — สแกนชำระผ่าน PromptPay QR รับเครดิตเงินคืนและแต้มสะสม 2X',
    tag: '💧 เมนูสุขภาพยอดนิยม (STORE PICK)',
    discountBadge: '2X POINTS',
    imageUrl: '/src/assets/images/minimart_bottled_water_premium_1791396432613.jpg',
    accentColor: '#3b82f6', // blue
    expiryNote: 'สแกนจ่ายทันทีผ่านระบบพร้อมเพย์ EMVCo QR',
  },
  {
    id: 'promo-04',
    title: 'เมล็ดกาแฟคั่ว PRODX House Blend 250g',
    subtitle: 'Single Origin Mae Jan Tai & House Blend — สมัครสมาชิกฟรี รับสิทธิพิเศษและแต้มสะสมทันที',
    tag: '☕ สินค้าแนะนำประจำสาขา (FEATURED BEANS)',
    discountBadge: 'JOIN FREE',
    imageUrl: '/src/assets/images/minimart_iced_latte_1791396408236.jpg',
    accentColor: '#8b5cf6', // purple
    expiryNote: 'แจ้งเบอร์โทรศัพท์กับพนักงานเพื่อสะสมแต้มได้เลย',
  },
];
