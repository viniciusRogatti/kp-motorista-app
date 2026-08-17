export type CompanyTheme = { background: string; border: string; accent: string; label: string };

export function getCompanyTheme(code?: string | null): CompanyTheme {
  const normalized = String(code || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (normalized.includes('pronto')) {
    return { background: '#F7F0E7', border: '#DDC5A7', accent: '#765436', label: 'PRONTO' };
  }
  if (normalized.includes('brazil') || normalized.includes('fish')) {
    return { background: '#F0F2F4', border: '#CDD3D9', accent: '#4E5965', label: 'BRAZILIAN FISH' };
  }
  if (normalized.includes('mar') || normalized.includes('rio')) {
    return { background: '#EAF3FC', border: '#B9D3ED', accent: '#225E91', label: 'MAR E RIO' };
  }
  if (normalized.includes('bacio') || normalized.includes('latte') || normalized.includes('milano')) {
    return { background: '#FFF4E8', border: '#E8C9A5', accent: '#8A4F2A', label: 'BACIO DI LATTE' };
  }
  return { background: '#EDF5F2', border: '#C4DCD4', accent: '#326B5D', label: code?.toUpperCase() || 'ENTREGA' };
}
