import { z } from "zod";
import type { User } from "@/generated/prisma/client";

/** 3-32 chars, lowercase letters/numbers/`.`/`_`/`-` — kept simple and URL-safe. */
export const USERNAME_REGEX = /^[a-z0-9._-]{3,32}$/;

export const profileUpdateSchema = z.object({
  firstName: z.string().trim().max(80).nullable().optional(),
  lastName: z.string().trim().max(80).nullable().optional(),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(USERNAME_REGEX, "Use 3-32 lowercase letters, numbers, '.', '_' or '-'")
    .nullable()
    .optional(),
  email: z.string().trim().toLowerCase().email("Enter a valid email").optional(),
});

export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().optional(),
    newPassword: z.string().min(8, "Use at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

/** Known preference keys — additive; unrecognized keys already in `prefs` are preserved on save. */
export const prefsUpdateSchema = z
  .object({
    emailDigestOpens: z.boolean(),
    emailDigestReplies: z.boolean(),
    defaultFromName: z.string().trim().max(120),
    timezone: z.string().trim().max(64),
  })
  .partial();

export type UserPrefs = z.infer<typeof prefsUpdateSchema>;

export const DEFAULT_PREFS: Required<UserPrefs> = {
  emailDigestOpens: true,
  emailDigestReplies: true,
  defaultFromName: "",
  timezone: "",
};

/** Narrows the untyped `Json` column into our known preference shape, filling in defaults. */
export function toUserPrefs(raw: unknown): Required<UserPrefs> {
  const parsed = prefsUpdateSchema.safeParse(raw);
  return { ...DEFAULT_PREFS, ...(parsed.success ? parsed.data : {}) };
}

export type ProfileSummary = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  name: string | null;
  role: "owner" | "member";
  hasPassword: boolean;
  prefs: Required<UserPrefs>;
};

export function toProfileSummary(user: User): ProfileSummary {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    username: user.username,
    name: user.name,
    role: user.role,
    hasPassword: Boolean(user.passwordHash),
    prefs: toUserPrefs(user.prefs),
  };
}

/** Combines first/last into the legacy `name` display field; falls back to the existing value. */
export function computeDisplayName(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
  fallback: string | null,
): string | null {
  const full = [firstName, lastName].filter((part) => part && part.trim().length > 0).join(" ").trim();
  return full.length > 0 ? full : fallback;
}

/** True for Prisma's unique-constraint violation error code. */
export function isUniqueConstraintError(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "P2002");
}
