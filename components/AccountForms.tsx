"use client";

import { useState, type FormEvent } from "react";

type Address = { name: string; address: string; city: string; postalCode: string; country: string };
type Result = { success?: boolean; fields?: Record<string, string>; error?: { message?: string } };

export function SavedAddressForm({ initial, defaultName }: { initial: Address | null; defaultName: string }) {
  const [values, setValues] = useState<Address>(initial ?? { name: defaultName, address: "", city: "", postalCode: "", country: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setErrors({}); setMessage(""); setOk(false);
    try {
      const response = await fetch("/api/account/address", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
      const result = await response.json() as Result;
      if (!response.ok || !result.success) { setErrors(result.fields ?? {}); setMessage(result.error?.message ?? "Address could not be saved."); return; }
      setOk(true); setMessage("Address saved. It will be filled in at checkout.");
    } catch { setMessage("Could not reach Nexora. Check your connection."); }
    finally { setBusy(false); }
  }

  const input = (name: keyof Address, label: string, autoComplete: string) => <div className="auth-field">
    <label htmlFor={`addr-${name}`}>{label}</label>
    <input id={`addr-${name}`} name={name} autoComplete={autoComplete} value={values[name]} onChange={(event) => setValues((current) => ({ ...current, [name]: event.target.value }))} aria-invalid={Boolean(errors[name])} required />
    {errors[name] && <p className="auth-field-error">{errors[name]}</p>}
  </div>;

  return <form className="account-panel" onSubmit={submit} noValidate>
    <h2>Saved delivery address</h2>
    <p className="account-panel-hint">Used to pre-fill checkout so you do not have to type it again.</p>
    <div className="account-form-grid">{input("name", "Full name", "name")}{input("address", "Street address", "street-address")}{input("city", "City", "address-level2")}{input("postalCode", "Postal code", "postal-code")}{input("country", "Country", "country-name")}</div>
    {message && <p className={ok ? "account-success" : "auth-message"} role={ok ? "status" : "alert"}>{message}</p>}
    <button className="auth-submit account-submit" type="submit" disabled={busy}>{busy ? "Saving…" : "Save address"}</button>
  </form>;
}

export function ChangePasswordForm() {
  const [values, setValues] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setErrors({}); setMessage(""); setOk(false);
    try {
      const response = await fetch("/api/account/password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
      const result = await response.json() as Result;
      if (!response.ok || !result.success) { setErrors(result.fields ?? {}); setMessage(result.error?.message ?? "Password could not be changed."); return; }
      setValues({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setOk(true); setMessage("Password changed. You were signed out of your other devices.");
    } catch { setMessage("Could not reach Nexora. Check your connection."); }
    finally { setBusy(false); }
  }

  const input = (name: keyof typeof values, label: string, autoComplete: string) => <div className="auth-field">
    <label htmlFor={`pw-${name}`}>{label}</label>
    <input id={`pw-${name}`} name={name} type="password" autoComplete={autoComplete} maxLength={72} value={values[name]} onChange={(event) => setValues((current) => ({ ...current, [name]: event.target.value }))} aria-invalid={Boolean(errors[name])} required />
    {errors[name] && <p className="auth-field-error">{errors[name]}</p>}
  </div>;

  return <form className="account-panel" onSubmit={submit} noValidate>
    <h2>Change password</h2>
    <p className="account-panel-hint">Use at least 8 characters.</p>
    <div className="account-form-stack">{input("currentPassword", "Current password", "current-password")}{input("newPassword", "New password", "new-password")}{input("confirmPassword", "Confirm new password", "new-password")}</div>
    {message && <p className={ok ? "account-success" : "auth-message"} role={ok ? "status" : "alert"}>{message}</p>}
    <button className="auth-submit account-submit" type="submit" disabled={busy}>{busy ? "Updating…" : "Update password"}</button>
  </form>;
}
