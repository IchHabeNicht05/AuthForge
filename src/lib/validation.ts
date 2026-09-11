import { z } from "zod";

const passwordSchema = z
  .string()
  .min(10, "Password must be at least 10 characters")
  .refine(
    (val) => /[a-zA-Z]/.test(val) && /[0-9!@#$%^&*()\-_=+[\]{};:'",.<>/?\\|`~]/.test(val),
    "Password must include a letter and a number or symbol",
  );

export const registerSchema = z.object({
  email: z.string().email().max(255),
  password: passwordSchema,
  name: z.string().min(1).max(120).optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  rememberDevice: z.boolean().optional().default(false),
});

export const deleteAccountSchema = z.object({
  password: z.string().min(1).optional(), // volitelné pro OAuth-only účty
  confirmation: z.literal("DELETE"),
});

export const twoFactorChallengeSchema = z.object({
  challengeToken: z.string().min(1),
  code: z.string().min(6).max(12), // 6-digit TOTP or "xxxx-xxxx-xx" backup code
  isBackupCode: z.boolean().optional().default(false),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: passwordSchema,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});

export const enableTwoFactorConfirmSchema = z.object({
  code: z.string().length(6),
});

export const createApiKeySchema = z.object({
  name: z.string().min(1).max(80),
  organizationId: z.string().cuid().optional(),
  expiresInDays: z.number().int().positive().max(3650).optional(),
  scopes: z.array(z.string()).default([]),
});

export const createOrganizationSchema = z.object({
  name: z.string().min(2).max(80),
  slug: z
    .string()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/, "Slug may only contain lowercase letters, numbers, and hyphens"),
});

export const inviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(["ADMIN", "MEMBER", "VIEWER"]),
});

export const updateMemberRoleSchema = z.object({
  role: z.enum(["OWNER", "ADMIN", "MEMBER", "VIEWER"]),
});

export const createApplicationSchema = z.object({
  name: z.string().min(1).max(80),
  organizationId: z.string().cuid().optional(),
  redirectUrls: z.array(z.string().url()).default([]),
});

export const auditLogQuerySchema = z.object({
  organizationId: z.string().cuid().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
