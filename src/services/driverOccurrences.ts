import { z } from 'zod';

import { ApiError, apiRequest } from './http';

export type DriverOccurrenceType = 'redelivery' | 'return' | 'missing_product' | 'cancellation';
export type DriverOccurrenceItem = { productCode: string; quantity: number };
export type EvidencePhoto = { uri: string; mimeType?: string | null; fileName?: string | null };

const responseSchema = z.object({
  accepted: z.literal(true),
  deduplicated: z.boolean().optional(),
  occurrence: z.object({
    id: z.coerce.number().int().positive(),
    type: z.string(),
    statusApplied: z.boolean(),
    communicationStatus: z.string(),
    whatsappGroupName: z.string(),
    shareMessage: z.string(),
    hasEvidence: z.boolean(),
  }),
});

export async function createDriverOccurrence(token: string, stopId: number, input: {
  occurrenceType: DriverOccurrenceType;
  returnScope?: 'total' | 'partial' | null;
  reason: string;
  description?: string;
  items?: DriverOccurrenceItem[];
  clientEventId: string;
  evidence?: EvidencePhoto | null;
}) {
  const form = new FormData();
  form.append('occurrenceType', input.occurrenceType);
  if (input.returnScope) form.append('returnScope', input.returnScope);
  form.append('reason', input.reason);
  form.append('description', input.description ?? '');
  form.append('items', JSON.stringify(input.items ?? []));
  form.append('clientEventId', input.clientEventId);
  if (input.evidence) {
    form.append('evidence', {
      uri: input.evidence.uri,
      type: input.evidence.mimeType || 'image/jpeg',
      name: input.evidence.fileName || `comprovante-${input.clientEventId}.jpg`,
    } as unknown as Blob);
  }
  const response = await apiRequest<unknown>(`/driver-app/trip-stops/${stopId}/occurrences`, {
    method: 'POST',
    token,
    body: form,
    timeoutMs: 45_000,
  });
  const parsed = responseSchema.safeParse(response);
  if (!parsed.success) throw new ApiError('O servidor não confirmou a ocorrência.', null, 'INVALID_OCCURRENCE_RESPONSE');
  return parsed.data;
}

export async function markDriverOccurrenceShared(token: string, occurrenceId: number) {
  const response = await apiRequest<unknown>(`/driver-app/driver-occurrences/${occurrenceId}/share-started`, {
    method: 'POST',
    token,
  });
  const parsed = responseSchema.safeParse(response);
  if (!parsed.success) throw new ApiError('O servidor não confirmou o compartilhamento.', null, 'INVALID_OCCURRENCE_SHARE_RESPONSE');
  return parsed.data;
}
