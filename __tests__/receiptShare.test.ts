import { buildReceiptShareMessage, normalizeInvoiceNumberForShare } from '../src/utils/receiptShare';

describe('legenda de compartilhamento do canhoto', () => {
  it('envia somente o numero da NF', () => {
    expect(buildReceiptShareMessage('1847450')).toBe('1847450');
  });

  it('remove prefixo, espacos e entidades HTML sem incorporar o codigo da entidade', () => {
    expect(normalizeInvoiceNumberForShare(' NF 1847450&#x20; ')).toBe('1847450');
    expect(buildReceiptShareMessage('1847450&#32;')).toBe('1847450');
    expect(buildReceiptShareMessage('1847450&nbsp;')).toBe('1847450');
  });
});
