import { getCompanyTheme } from '@/components/trips/companyTheme';

describe('getCompanyTheme', () => {
  it('identifica a Bacio di Latte pelo codigo interno', () => {
    expect(getCompanyTheme('bacio_di_latte').label).toBe('BACIO DI LATTE');
  });

  it('tambem identifica a empresa pela razao social Milano', () => {
    expect(getCompanyTheme('milano').label).toBe('BACIO DI LATTE');
  });
});
