import { getCompanyTheme } from '@/components/trips/companyTheme';

describe('getCompanyTheme', () => {
  it('identifica o Grupo Horeca pelo codigo interno', () => {
    expect(getCompanyTheme('grupo_horeca').label).toBe('GRUPO HORECA');
  });

  it('mantem compatibilidade com o codigo e a razao social anteriores', () => {
    expect(getCompanyTheme('bacio_di_latte').label).toBe('GRUPO HORECA');
    expect(getCompanyTheme('milano').label).toBe('GRUPO HORECA');
  });

  it('identifica Piracanjuba e Vitalmar', () => {
    expect(getCompanyTheme('piracanjuba').label).toBe('PIRACANJUBA');
    expect(getCompanyTheme('Laticinios Bela Vista S.A.').label).toBe('PIRACANJUBA');
    expect(getCompanyTheme('vitalmar').label).toBe('VITALMAR');
  });
});
