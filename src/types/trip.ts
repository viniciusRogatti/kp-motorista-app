import { z } from 'zod';

export const assignedTripSchema = z.object({
  id: z.number().int().positive(),
  date: z.string().min(1),
  runNumber: z.number().int().positive(),
  grossWeight: z.number().nonnegative(),
  status: z.string().min(1),
  updatedAt: z.string().nullable(),
  driver: z.object({ id: z.number().int().positive(), name: z.string() }),
  vehicle: z.object({
    id: z.number().int().positive(),
    model: z.string(),
    licensePlate: z.string(),
  }),
  summary: z.object({
    totalStops: z.number().int().nonnegative(),
    completedStops: z.number().int().nonnegative(),
    pendingStops: z.number().int().nonnegative(),
  }),
  tracking: z.object({
    acceptedAt: z.string().nullable(),
    active: z.boolean(),
    operationalCompletedAt: z.string().nullable(),
    stopAt: z.string().nullable(),
  }).default({ acceptedAt: null, active: false, operationalCompletedAt: null, stopAt: null }),
  stops: z.array(z.object({
    id: z.number().int().positive(),
    companyId: z.number().int().positive().nullable().default(null),
    companyCode: z.string().nullable().default(null),
    sequence: z.number().int().nonnegative(),
    invoiceNumber: z.string(),
    customerName: z.string(),
    city: z.string(),
    status: z.string().min(1),
    grossWeight: z.number().nonnegative(),
    boxQuantity: z.number().nonnegative().nullable(),
    customerId: z.string().nullable().default(null),
    phone: z.string().nullable().default(null),
    address: z.string().default(''),
    addressNumber: z.string().default(''),
    neighborhood: z.string().default(''),
    state: z.string().default(''),
    zipCode: z.string().default(''),
    representativeName: z.string().nullable().default(null),
    receiptGroupName: z.string().nullable().default(null),
    products: z.array(z.object({
      code: z.string(),
      description: z.string(),
      type: z.string().nullable(),
      quantity: z.number().nonnegative(),
    })).default([]),
    updatedAt: z.string().nullable(),
  })),
});

export type AssignedTrip = z.infer<typeof assignedTripSchema>;
