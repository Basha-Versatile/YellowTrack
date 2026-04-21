import { z } from "zod";

const emergencyContactSchema = z.object({
  name: z.string().min(1, "Name is required"),
  relation: z.string().min(1, "Relation is required"),
  phone: z.string().min(1, "Phone is required"),
});

export const publicDriverUpdateSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().optional().nullable(),
  aadhaarLast4: z.string().max(4).optional().nullable(),
  vehicleClass: z.string().optional(),
  bloodGroup: z.string().optional().nullable(),
  fatherName: z.string().optional().nullable(),
  motherName: z.string().optional().nullable(),
  emergencyContact: z.string().optional().nullable(),
  emergencyContacts: z.array(emergencyContactSchema).max(10).optional(),
  currentAddress: z.string().optional().nullable(),
  permanentAddress: z.string().optional().nullable(),
  currentAddressLat: z.coerce.number().optional().nullable(),
  currentAddressLng: z.coerce.number().optional().nullable(),
  permanentAddressLat: z.coerce.number().optional().nullable(),
  permanentAddressLng: z.coerce.number().optional().nullable(),
});

export type PublicDriverUpdateInput = z.infer<typeof publicDriverUpdateSchema>;
