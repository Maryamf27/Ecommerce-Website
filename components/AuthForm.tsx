"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Eye, EyeOff } from "lucide-react";
import type { AuthFieldErrors } from "@/lib/auth-validation";

type AuthFormProps = { mode: "login" | "register"; returnTo: string };
type AuthResponse = { success?: boolean; fields?: AuthFieldErrors; error?: { message?: string } };

export default function AuthForm({ mode, returnTo }: AuthFormProps) {
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<AuthFieldErrors>({});
  const [message, setMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const isRegister = mode === "register";
  const otherPage = isRegister ? "/login" : "/register";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setErrors({});
    setMessage("");
    const formData = new FormData(event.currentTarget);
    const payload = Object.fromEntries(formData.entries());

    try {
      const response = await fetch(`/api/auth/${mode === "register" ? "register" : "login"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json() as AuthResponse;
      if (!response.ok || !result.success) {
        setErrors(result.fields ?? {});
        setMessage(result.error?.message ?? "We could not complete your request. Please try again.");
        return;
      }
      window.location.assign(returnTo);
    } catch {
      setMessage("We could not reach Nexora. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  const fieldError = (field: keyof AuthFieldErrors) => errors[field];

  return <main className="auth-shell">
    <section className="auth-card" aria-labelledby="auth-heading">
      <p className="auth-kicker">NEXORA ACCOUNT</p>
      <h1 id="auth-heading">{isRegister ? "Create your account" : "Welcome back"}</h1>
      <p className="auth-intro">{isRegister ? "Save your details for a smoother shopping experience." : "Sign in to continue to your Nexora account."}</p>
      <form className="auth-form" onSubmit={submit} noValidate>
        {isRegister && <div className="auth-field">
          <label htmlFor="auth-name">Name</label>
          <input id="auth-name" name="name" autoComplete="name" maxLength={80} required aria-invalid={Boolean(fieldError("name"))} aria-describedby={fieldError("name") ? "auth-name-error" : undefined} />
          {fieldError("name") && <p className="auth-field-error" id="auth-name-error">{fieldError("name")}</p>}
        </div>}
        <div className="auth-field">
          <label htmlFor="auth-email">Email address</label>
          <input id="auth-email" name="email" type="email" autoComplete="email" maxLength={254} required aria-invalid={Boolean(fieldError("email"))} aria-describedby={fieldError("email") ? "auth-email-error" : undefined} />
          {fieldError("email") && <p className="auth-field-error" id="auth-email-error">{fieldError("email")}</p>}
        </div>
        <div className="auth-field">
          <label htmlFor="auth-password">Password</label>
          <div className="auth-password-wrap">
            <input id="auth-password" name="password" type={showPassword ? "text" : "password"} autoComplete={isRegister ? "new-password" : "current-password"} minLength={isRegister ? 12 : undefined} maxLength={72} required aria-invalid={Boolean(fieldError("password"))} aria-describedby={fieldError("password") ? "auth-password-error" : isRegister ? "auth-password-hint" : undefined} />
            <button className="password-visibility" type="button" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} onClick={() => setShowPassword((visible) => !visible)}>{showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</button>
          </div>
          {isRegister && <p className="auth-field-hint" id="auth-password-hint">Use at least 12 characters, up to 72 UTF-8 bytes. A phrase is easier to remember.</p>}
          {fieldError("password") && <p className="auth-field-error" id="auth-password-error">{fieldError("password")}</p>}
        </div>
        {isRegister && <div className="auth-field">
          <label htmlFor="auth-confirm-password">Confirm password</label>
          <div className="auth-password-wrap">
            <input id="auth-confirm-password" name="confirmPassword" type={showConfirmation ? "text" : "password"} autoComplete="new-password" maxLength={72} required aria-invalid={Boolean(fieldError("confirmPassword"))} aria-describedby={fieldError("confirmPassword") ? "auth-confirm-password-error" : undefined} />
            <button className="password-visibility" type="button" aria-label={showConfirmation ? "Hide confirmation password" : "Show confirmation password"} aria-pressed={showConfirmation} onClick={() => setShowConfirmation((visible) => !visible)}>{showConfirmation ? <EyeOff size={18}/> : <Eye size={18}/>}</button>
          </div>
          {fieldError("confirmPassword") && <p className="auth-field-error" id="auth-confirm-password-error">{fieldError("confirmPassword")}</p>}
        </div>}
        {message && <p className="auth-message" role="alert">{message}</p>}
        <button className="auth-submit" type="submit" disabled={pending} aria-busy={pending}>{pending ? (isRegister ? "Creating account…" : "Signing in…") : (isRegister ? "Create account" : "Sign in")}</button>
      </form>
      <p className="auth-switch">{isRegister ? "Already have an account?" : "New to Nexora?"} <Link href={`${otherPage}${returnTo !== "/account" ? `?next=${encodeURIComponent(returnTo)}` : ""}`}>{isRegister ? "Sign in" : "Create an account"}</Link></p>
    </section>
  </main>;
}
