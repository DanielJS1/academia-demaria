import { z } from "zod";

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128;
export const PASSWORD_MIN_MESSAGE = `A senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`;

// Senhas são valores literais: espaços no início ou fim nunca são removidos.
export const newPasswordSchema = z.string().min(MIN_PASSWORD_LENGTH, PASSWORD_MIN_MESSAGE).max(MAX_PASSWORD_LENGTH);
