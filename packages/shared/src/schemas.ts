import { z } from 'zod'

// Must match minimum_password_length in supabase/config.toml.
export const PASSWORD_MIN = 10

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email())

export const credentialsSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
})

export const signupSchema = z.object({
  email: emailSchema,
  password: z.string().min(PASSWORD_MIN).max(72),
  full_name: z.string().trim().min(1).max(120),
})

export const nameSchema = z.string().trim().min(1).max(120)

export const INVITABLE_ROLES = ['admin', 'coach', 'athlete', 'guardian'] as const
export type Role = 'owner' | (typeof INVITABLE_ROLES)[number]

export const inviteSchema = z.object({
  email: emailSchema,
  role: z.enum(INVITABLE_ROLES),
})
