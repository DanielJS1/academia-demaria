export const ALLOWED_EMAIL_DOMAINS = ["demaria.com.br", "sacdemaria.com.br"] as const;

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isAllowedCompanyEmail(email: string) {
  const normalized = normalizeEmail(email);
  const separator = normalized.lastIndexOf("@");
  if (separator <= 0 || separator === normalized.length - 1) return false;
  return ALLOWED_EMAIL_DOMAINS.includes(
    normalized.slice(separator + 1) as (typeof ALLOWED_EMAIL_DOMAINS)[number]
  );
}

export function pendingStudentProfile(id: string, name: string, email: string) {
  return {
    id,
    name: name.trim(),
    email: normalizeEmail(email),
    department: "Geral",
    role: "student" as const,
    status: "pending" as const,
  };
}
