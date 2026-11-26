import { z } from "zod";

export const roleSchema = z.enum(["GROWER", "FACTORY", "ADMIN"]);
export type Role = z.infer<typeof roleSchema>;
export const roleHome: Record<Role, string> = {
  GROWER: "/grower",
  FACTORY: "/factory",
  ADMIN: "/admin",
};

export const accountSchema = z.object({
  id: z.number().int().positive(),
  role: roleSchema,
  email: z.string(),
  fullName: z.string(),
});
export const loginResponseSchema = z.object({
  accessToken: z.string().min(1),
  user: accountSchema,
});

export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});
export const registrationSchema = loginSchema.extend({
  fullName: z.string().trim().min(2, "Enter at least two characters.").max(150),
  phoneNumber: z
    .string()
    .trim()
    .min(6, "Enter at least six characters.")
    .max(20),
  password: z.string().min(8, "Use at least eight characters."),
  role: z.enum(["GROWER", "FACTORY"], { error: "Choose an account type." }),
});
