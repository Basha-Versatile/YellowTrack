import { z } from "zod";

export const createDriverSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  phone: z.string().optional().nullable(),
  aadhaarLast4: z.string().max(4).optional().nullable(),
  licenseNumber: z
    .string()
    .min(5, "License number must be at least 5 characters")
    .max(20, "License number must be at most 20 characters"),
  licenseExpiry: z.coerce.date(),
  vehicleClass: z.string().min(1, "Vehicle class is required"),
  bloodGroup: z.string().optional().nullable(),
  fatherName: z.string().optional().nullable(),
  motherName: z.string().optional().nullable(),
  emergencyContact: z.string().optional().nullable(),
  currentAddress: z.string().optional().nullable(),
  permanentAddress: z.string().optional().nullable(),
});

export const assignDriverSchema = z.object({
  vehicleId: z.string().min(1, "Vehicle ID is required"),
});

const emergencyContactItemSchema = z.object({
  name: z.string().min(1, "Contact name is required"),
  relation: z.string().min(1, "Relation is required"),
  phone: z.string().min(1, "Phone is required"),
});

export const updateDriverSchema = z.object({
  phone: z.string().optional().nullable(),
  aadhaarLast4: z.string().max(4).optional().nullable(),
  bloodGroup: z.string().optional().nullable(),
  fatherName: z.string().optional().nullable(),
  motherName: z.string().optional().nullable(),
  emergencyContact: z.string().optional().nullable(),
  emergencyContacts: z.array(emergencyContactItemSchema).optional().nullable(),
  currentAddress: z.string().optional().nullable(),
  currentAddressLat: z.coerce.number().optional().nullable(),
  currentAddressLng: z.coerce.number().optional().nullable(),
  permanentAddress: z.string().optional().nullable(),
  permanentAddressLat: z.coerce.number().optional().nullable(),
  permanentAddressLng: z.coerce.number().optional().nullable(),
  profilePhoto: z.string().optional().nullable(),
});

export type CreateDriverInput = z.infer<typeof createDriverSchema>;
export type UpdateDriverInput = z.infer<typeof updateDriverSchema>;
export type AssignDriverInput = z.infer<typeof assignDriverSchema>;
