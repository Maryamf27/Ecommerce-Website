"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { TagDTO } from "@/types/product";

type TagsResponse = { success?: boolean; data?: TagDTO[]; error?: { message?: string } };
type WriteResponse = { success?: boolean; data?: TagDTO; error?: { message?: string } };

async function requestTags(): Promise<TagDTO[]> {
  const response = await fetch("/api/admin/tags", { cache: "no-store" });
  const result = await response.json() as TagsResponse;
  if (!response.ok || !result.success || !Array.isArray(result.data)) throw new Error(result.error?.message ?? "Tags could not be loaded.");
  return result.data;
}

export default function AdminTags() {
  const [tags, setTags] = useState<TagDTO[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(async () => {
    try {
      const items = await requestTags();
      setTags(items);
      setNames(Object.fromEntries(items.map((tag) => [tag._id, tag.name])));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Tags could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    requestTags()
      .then((items) => {
        if (!active) return;
        setTags(items);
        setNames(Object.fromEntries(items.map((tag) => [tag._id, tag.name])));
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "Tags could not be loaded.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function create(event: FormEvent) {
    event.preventDefault();
    setError(""); setSuccess(""); setSaving(true);
    try {
      const response = await fetch("/api/admin/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName }),
      });
      const result = await response.json() as WriteResponse;
      if (!response.ok || !result.success || !result.data) throw new Error(result.error?.message ?? "Tag could not be created.");
      setNewName("");
      setSuccess(`“${result.data.name}” added.`);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Tag could not be created.");
    } finally {
      setSaving(false);
    }
  }

  async function save(tag: TagDTO) {
    setError(""); setSuccess(""); setBusyId(tag._id);
    try {
      const response = await fetch(`/api/admin/tags/${tag._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: names[tag._id] }),
      });
      const result = await response.json() as WriteResponse;
      if (!response.ok || !result.success || !result.data) throw new Error(result.error?.message ?? "Tag could not be updated.");
      setSuccess(`“${result.data.name}” updated.`);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Tag could not be updated.");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(tag: TagDTO) {
    setError(""); setSuccess(""); setBusyId(tag._id);
    try {
      const response = await fetch(`/api/admin/tags/${tag._id}`, { method: "DELETE" });
      const result = await response.json() as WriteResponse;
      if (!response.ok || !result.success) throw new Error(result.error?.message ?? "Tag could not be deleted.");
      setSuccess(`“${tag.name}” deleted.`);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Tag could not be deleted.");
    } finally {
      setBusyId(null);
    }
  }

  return <section className="admin-tags" aria-labelledby="admin-tags-heading">
    <div className="admin-list-head"><div><h2 id="admin-tags-heading">Product tags</h2><p>Create and rename tags here, then assign them to products in the Products tab. A tag can only be deleted when no products use it.</p></div></div>
    <form className="admin-tag-create" onSubmit={(event) => void create(event)}>
      <label htmlFor="new-tag-name">New tag name</label>
      <input id="new-tag-name" value={newName} maxLength={60} onChange={(event) => setNewName(event.target.value)} placeholder="e.g. Best seller" required />
      <button className="auth-submit" type="submit" disabled={saving}>{saving ? "Adding…" : "Add tag"}</button>
    </form>
    {error && <p className="auth-message" role="alert">{error}</p>}
    {success && <p className="account-success" role="status">{success}</p>}
    <div className="admin-tag-list" aria-busy={loading}>
      {loading && <p role="status">Loading tags…</p>}
      {!loading && tags.length === 0 && <p>No tags yet. Create one above.</p>}
      {tags.map((tag) => <div className="admin-tag-row" key={tag._id}>
        <label className="sr-only" htmlFor={`tag-${tag._id}`}>Tag name for {tag.name}</label>
        <input id={`tag-${tag._id}`} value={names[tag._id] ?? tag.name} maxLength={60} onChange={(event) => setNames((current) => ({ ...current, [tag._id]: event.target.value }))} />
        <span className="admin-tag-slug">{tag.slug}</span>
        <button type="button" onClick={() => void save(tag)} disabled={busyId === tag._id || (names[tag._id] ?? tag.name) === tag.name}>{busyId === tag._id ? "Saving…" : "Save"}</button>
        <button type="button" className="danger" onClick={() => void remove(tag)} disabled={busyId === tag._id}>Delete</button>
      </div>)}
    </div>
  </section>;
}
