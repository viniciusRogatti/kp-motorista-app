export type CompanyTheme = { background: string; border: string; accent: string; label: string };

export function getCompanyTheme(code?: string | null): CompanyTheme {
  const normalized = String(code || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (normalized.includes('pronto')) {
    return { background: '#F7F0E7', border: '#DDC5A7', accent: '#765436', label: 'PRONTO' };
  }
  if (normalized.includes('piracanjuba') || normalized.includes('laticinios bela vista')) {
    return { background: '#EEF5FF', border: '#B8D2F0', accent: '#145EA8', label: 'PIRACANJUBA' };
  }
  if (normalized.includes('vitalmar')) {
    return { background: '#EAF8F7', border: '#ABDAD6', accent: '#087A74', label: 'VITALMAR' };
  }
  if (normalized.includes('brazil') || normalized.includes('fish')) {
    return { background: '#F0F2F4', border: '#CDD3D9', accent: '#4E5965', label: 'BRAZILIAN FISH' };
  }
  if (normalized.includes('mar') || normalized.includes('rio')) {
    return { background: '#EAF3FC', border: '#B9D3ED', accent: '#225E91', label: 'MAR E RIO' };
  }
  if (normalized.includes('horeca') || normalized.includes('bacio') || normalized.includes('latte') || normalized.includes('milano')) {
    return { background: '#FFF4E8', border: '#E8C9A5', accent: '#8A4F2A', label: 'GRUPO HORECA' };
  }
  return { background: '#EDF5F2', border: '#C4DCD4', accent: '#326B5D', label: code?.toUpperCase() || 'ENTREGA' };
}
