export const ALLOWED_FONT_FAMILIES = [
  { label: 'Bawaan', value: 'default', css: 'inherit' },
  { label: 'Serif', value: 'serif', css: 'serif' },
  { label: 'Monospasi', value: 'monospace', css: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' },
] as const

export const ALLOWED_FONT_SIZES = [
  { label: 'Kecil (14px)', value: '14px' },
  { label: 'Normal (16px)', value: '16px' },
  { label: 'Sedang (18px)', value: '18px' },
  { label: 'Besar (24px)', value: '24px' },
  { label: 'Sangat Besar (32px)', value: '32px' },
] as const

export const PRESET_COLORS = [
  { label: 'Hitam / Abu Gelap', value: '#1e293b' },
  { label: 'Merah (Peringatan / Fase R)', value: '#dc2626' },
  { label: 'Kuning (Peringatan / Fase S)', value: '#d97706' },
  { label: 'Hijau (Tema / Penting)', value: '#059669' },
  { label: 'Biru (Info / Netral)', value: '#2563eb' },
  { label: 'Ungu', value: '#7c3aed' },
  { label: 'Oranye (Bahaya)', value: '#ea580c' },
  { label: 'Abu-abu (Muted)', value: '#64748b' },
] as const

export const PRESET_HIGHLIGHTS = [
  { label: 'Kuning Terang', value: '#fef08a' },
  { label: 'Hijau Muda', value: '#bbf7d0' },
  { label: 'Biru Muda', value: '#bfdbfe' },
  { label: 'Merah Muda', value: '#fecaca' },
  { label: 'Oranye Muda', value: '#fed7aa' },
  { label: 'Ungu Muda', value: '#e9d5ff' },
  { label: 'Abu-abu Muda', value: '#f1f5f9' },
] as const

export const ALLOWED_TEXT_ALIGNS = ['left', 'center', 'right', 'justify'] as const
