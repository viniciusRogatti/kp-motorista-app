const HTML_SPACE_ENTITY_PATTERN = /&(?:#x20|#32|nbsp);/gi;

export function normalizeInvoiceNumberForShare(value: string) {
  const withoutEncodedSpaces = String(value || '').replace(HTML_SPACE_ENTITY_PATTERN, ' ').trim();
  return (withoutEncodedSpaces.match(/\d+/g) || []).join('');
}

export function buildReceiptShareMessage(invoiceNumber: string) {
  return normalizeInvoiceNumberForShare(invoiceNumber);
}
