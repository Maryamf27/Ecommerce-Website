export type AuthFieldErrors = Partial<Record<"name" | "email" | "password" | "confirmPassword", string>>;

export type RegistrationInput = {
  name: string;
  email: string;
  password: string;
};

export type LoginInput = {
  email: string;
  password: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validEmail(email: string): boolean {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validateRegistration(value: unknown):
  | { success: true; data: RegistrationInput }
  | { success: false; errors: AuthFieldErrors } {
  if (!isRecord(value)) return { success: false, errors: { name: "Enter your name.", email: "Enter a valid email address.", password: "Enter a password.", confirmPassword: "Confirm your password." } };

  const errors: AuthFieldErrors = {};
  const name = typeof value.name === "string" ? value.name.trim() : "";
  const email = typeof value.email === "string" ? value.email.trim().toLowerCase() : "";
  const password = typeof value.password === "string" ? value.password : "";
  const confirmPassword = typeof value.confirmPassword === "string" ? value.confirmPassword : "";
  const passwordBytes = new TextEncoder().encode(password).length;

  if (name.length < 1 || name.length > 80) errors.name = "Name must be between 1 and 80 characters.";
  if (!validEmail(email)) errors.email = "Enter a valid email address.";
  if (password.length < 8) errors.password = "Use at least 8 characters.";
  else if (passwordBytes > 72) errors.password = "Password is too long. Please choose a shorter one.";
  if (confirmPassword !== password) errors.confirmPassword = "Passwords do not match.";
  if (Object.keys(value).some((key) => !["name", "email", "password", "confirmPassword"].includes(key))) {
    errors.name ??= "The registration request contains an unsupported field.";
  }

  if (Object.keys(errors).length > 0) return { success: false, errors };
  return { success: true, data: { name, email, password } };
}

export function validateLogin(value: unknown):
  | { success: true; data: LoginInput }
  | { success: false; errors: AuthFieldErrors } {
  if (!isRecord(value)) return { success: false, errors: { email: "Enter a valid email address.", password: "Enter your password." } };
  const email = typeof value.email === "string" ? value.email.trim().toLowerCase() : "";
  const password = typeof value.password === "string" ? value.password : "";
  const passwordBytes = new TextEncoder().encode(password).length;
  const errors: AuthFieldErrors = {};
  if (!validEmail(email)) errors.email = "Enter a valid email address.";
  if (password.length < 1) errors.password = "Enter your password.";
  else if (passwordBytes > 72) errors.password = "Password is too long. Please choose a shorter one.";
  if (Object.keys(errors).length > 0) return { success: false, errors };
  return { success: true, data: { email, password } };
}

export function safeReturnTo(value: string | undefined, fallback = "/account"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\") || /[\u0000-\u001f]/.test(value)) return fallback;
  try {
    const parsed = new URL(value, "https://nexora.invalid");
    if (parsed.origin !== "https://nexora.invalid") return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}
