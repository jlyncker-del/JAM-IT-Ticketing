import { z } from "zod";

const password = z.string().min(10, "Das Passwort muss mindestens 10 Zeichen lang sein.")
  .regex(/[A-Z]/, "Das Passwort muss einen Großbuchstaben enthalten.")
  .regex(/[a-z]/, "Das Passwort muss einen Kleinbuchstaben enthalten.")
  .regex(/[0-9]/, "Das Passwort muss eine Zahl enthalten.")
  .regex(/[^A-Za-z0-9]/, "Das Passwort muss ein Sonderzeichen enthalten.");

export const registerSchema = z.object({
  firstName: z.string().trim().min(2, "Bitte geben Sie Ihren Vornamen ein.").max(80),
  lastName: z.string().trim().min(2, "Bitte geben Sie Ihren Nachnamen ein.").max(80),
  email: z.string().trim().toLowerCase().email("Bitte geben Sie eine gültige E-Mail-Adresse ein."),
  password,
  phone: z.string().trim().max(40).optional(),
  company: z.string().trim().max(120).optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Bitte geben Sie eine gültige E-Mail-Adresse ein."),
  password: z.string().min(1, "Bitte geben Sie Ihr Passwort ein."),
});

export const forgotPasswordSchema = z.object({ email: z.string().trim().toLowerCase().email("Bitte geben Sie eine gültige E-Mail-Adresse ein.") });
export const resetPasswordSchema = z.object({ token: z.string().min(20), password });
export { password as passwordSchema };
