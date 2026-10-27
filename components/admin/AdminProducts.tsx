"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { ImagePlus } from "lucide-react";
import ConfirmDialog from "@/components/ConfirmDialog";
import ProductImage from "@/components/ProductImage";
import Select from "@/components/Select";
import type { ProductDTO } from "@/types/product";

type Form = { title: string; description: string; price: string; category: string; image: string; stock: string };
const emptyForm: Form = { title: "", description: "", price: "", category: "", image: "", stock: "12" };
type ListResponse = { success?: boolean; data?: ProductDTO[]; categories?: string[]; pagination?: { pages: number; total: number }; error?: { message?: string } };
type UploadResponse = { success?: boolean; data?: { url?: string }; error?: { message?: string } };

const ACCEPTED_IMAGES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
const MAX_DIMENSION = 1600;

/** Shrinks big photos (phones take 4–10 MB pictures) so they fit the upload limit; small images are sent untouched. */
async function prepareImage(file: File): Promise<File> {
  if (!ACCEPTED_IMAGES.includes(file.type)) throw new Error("Choose a PNG, JPG, WebP or GIF image.");
  if (file.type === "image/gif") {
    if (file.size > MAX_UPLOAD_BYTES) throw new Error("GIF images must be 2 MB or smaller.");
    return file;
  }
  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(file); } catch { throw new Error("This image could not be read. Try another file."); }
  try {
    if (file.size <= 1.5 * 1024 * 1024 && bitmap.width <= MAX_DIMENSION && bitmap.height <= MAX_DIMENSION) return file;
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("This image could not be processed.");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const toBlob = (type: string) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.85));
    let blob = await toBlob("image/webp");
    if (!blob || blob.type !== "image/webp") blob = await toBlob("image/jpeg");
    if (!blob) throw new Error("This image could not be processed.");
    if (blob.size > MAX_UPLOAD_BYTES) throw new Error("This image is too large even after resizing. Try a smaller one.");
    const extension = blob.type === "image/webp" ? "webp" : "jpg";
    return new File([blob], `${file.name.replace(/\.[^.]+$/, "") || "image"}.${extension}`, { type: blob.type });
  } finally { bitmap.close(); }
}

type WriteResponse = { success?: boolean; error?: { message?: string; details?: string[] } };

function StockEditor({ product, onSaved, onError }: { product: ProductDTO; onSaved: () => void; onError: (message: string) => void }) {
  const [value, setValue] = useState(String(product.stock));
  const [busy, setBusy] = useState(false);
  const changed = value !== String(product.stock);
  async function save() {
    const stock = Number(value);
    if (!/^\d+$/.test(value) || !Number.isSafeInteger(stock)) { onError("Stock must be a whole number, 0 or more."); return; }
    setBusy(true);
    try {
      const response = await fetch(`/api/products/${product._id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stock }) });
      const result = await response.json() as WriteResponse;
      if (!response.ok || !result.success) throw new Error(result.error?.message ?? "Stock could not be updated.");
      onSaved();
    } catch (error) { onError(error instanceof Error ? error.message : "Stock could not be updated."); }
    finally { setBusy(false); }
  }
  return <span className="stock-editor">
    <input type="number" min="0" step="1" value={value} onChange={(event) => setValue(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void save(); }} aria-label={`Stock for ${product.title}`} />
    {changed && <button type="button" onClick={() => void save()} disabled={busy}>{busy ? "…" : "Save"}</button>}
  </span>;
}

export default function AdminProducts() {
  const [products, setProducts] = useState<ProductDTO[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Form>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [customCategory, setCustomCategory] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ProductDTO | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [uploading, setUploading] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "15", page: String(page) });
      if (search.trim()) params.set("search", search.trim());
      const response = await fetch(`/api/products?${params}`, { cache: "no-store" });
      const result = await response.json() as ListResponse;
      if (!response.ok || !result.success || !result.data) throw new Error(result.error?.message ?? "Products could not be loaded.");
      setProducts(result.data);
      setCategories(result.categories ?? []);
      setPages(result.pagination?.pages ?? 1);
      setTotal(result.pagination?.total ?? 0);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Products could not be loaded."); }
    finally { setLoading(false); }
  }, [page, search]);

  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 250); return () => window.clearTimeout(timer); }, [load]);

  function set(name: keyof Form, value: string) { setForm((current) => ({ ...current, [name]: value })); }
  function reset() { setForm(emptyForm); setEditingId(null); setCustomCategory(false); setAttempted(false); if (fileRef.current) fileRef.current.value = ""; }

  function startEdit(product: ProductDTO) {
    setEditingId(product._id);
    setCustomCategory(!categories.includes(product.category));
    setForm({ title: product.title, description: product.description, price: String(product.price), category: product.category, image: product.image, stock: String(product.stock) });
    setError(""); setSuccess("");
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function uploadFromDevice(file: File | undefined) {
    if (!file) return;
    setError(""); setSuccess(""); setUploading(true);
    try {
      const prepared = await prepareImage(file);
      const body = new FormData();
      body.append("file", prepared);
      const response = await fetch("/api/admin/uploads", { method: "POST", body });
      const result = await response.json() as UploadResponse;
      if (!response.ok || !result.success || !result.data?.url) throw new Error(result.error?.message ?? "The image could not be uploaded.");
      set("image", result.data.url);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The image could not be uploaded."); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ""; }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(""); setSuccess("");
    const price = Number(form.price);
    const stock = Number(form.stock);
    if (uploading) { setError("Please wait for the image upload to finish."); return; }
    setAttempted(true);
    // Only name what is actually missing.
    const missing = [
      !form.title.trim() && "title",
      !form.category.trim() && "category",
      !form.image.trim() && "image (upload one or paste a URL)",
      !form.description.trim() && "description",
    ].filter(Boolean) as string[];
    if (missing.length > 0) { setError(`${missing.length === 1 ? "Missing required field" : "Missing required fields"}: ${missing.join(", ")}.`); return; }
    if (!Number.isFinite(price) || price < 0 || form.price.trim() === "") { setError("Enter a valid price (0 or more)."); return; }
    if (!/^\d+$/.test(form.stock.trim()) || !Number.isSafeInteger(stock)) { setError("Stock must be a whole number, 0 or more."); return; }
    setBusy(true);
    try {
      const body = { title: form.title.trim(), description: form.description.trim(), price, category: form.category.trim(), image: form.image.trim(), stock };
      const response = await fetch(editingId ? `/api/products/${editingId}` : "/api/products", { method: editingId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json() as WriteResponse;
      if (!response.ok || !result.success) throw new Error(result.error?.details?.join(" ") ?? result.error?.message ?? "Product could not be saved.");
      setSuccess(editingId ? "Product updated." : "Product added. It is now live in the shop.");
      reset();
      setPage(1);
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Product could not be saved."); }
    finally { setBusy(false); }
  }

  async function confirmDelete() {
    const product = pendingDelete;
    if (!product) return;
    setDeleting(true); setError(""); setSuccess("");
    try {
      const response = await fetch(`/api/products/${product._id}`, { method: "DELETE" });
      const result = await response.json() as WriteResponse;
      if (!response.ok || !result.success) throw new Error(result.error?.message ?? "Product could not be deleted.");
      setSuccess("Product deleted.");
      if (editingId === product._id) reset();
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Product could not be deleted."); }
    finally { setDeleting(false); setPendingDelete(null); }
  }

  const previewOk = /^https?:\/\//i.test(form.image.trim()) || /^\/(?!\/)\S+$/.test(form.image.trim());
  return <div className="admin-products">
    <form className="admin-form" ref={formRef} onSubmit={submit} noValidate>
      <div className="admin-form-head"><h2>{editingId ? "Edit product" : "Add a new product"}</h2>{editingId && <button className="commerce-text-button" type="button" onClick={reset}>Cancel editing</button>}</div>
      <div className="admin-form-grid">
        <div className="auth-field wide"><label htmlFor="p-title">Title</label><input id="p-title" value={form.title} maxLength={180} onChange={(event) => set("title", event.target.value)} aria-invalid={attempted && !form.title.trim()} required /></div>
        <div className="auth-field"><label htmlFor="p-price">Price (USD)</label><input id="p-price" type="number" min="0" step="any" inputMode="decimal" value={form.price} onChange={(event) => set("price", event.target.value)} required /></div>
        <div className="auth-field"><label htmlFor="p-stock">Stock quantity</label><input id="p-stock" type="number" min="0" step="1" value={form.stock} onChange={(event) => set("stock", event.target.value)} required /></div>
        <div className="auth-field"><label htmlFor="p-category">Category</label>
          <Select id="p-category" placeholder="Select a category" value={customCategory ? "__new__" : form.category} onChange={(next) => { if (next === "__new__") { setCustomCategory(true); set("category", ""); } else { setCustomCategory(false); set("category", next); } }} options={[...categories.map((item) => ({ value: item, label: item })), { value: "__new__", label: "+ Add new category…" }]} />
          {customCategory && <input aria-label="New category name" placeholder="New category name" value={form.category} maxLength={100} onChange={(event) => set("category", event.target.value)} aria-invalid={attempted && !form.category.trim()} autoFocus />}
        </div>
        <div className="auth-field admin-image-field"><label htmlFor="p-image">Product image</label>
          <div className="admin-upload-row">
            <input ref={fileRef} id="p-file" className="sr-only" type="file" accept={ACCEPTED_IMAGES.join(",")} onChange={(event) => void uploadFromDevice(event.target.files?.[0])} tabIndex={-1} aria-label="Upload an image from your device" />
            <button type="button" className="admin-upload-button" onClick={() => fileRef.current?.click()} disabled={uploading}><ImagePlus size={18} aria-hidden="true" />{uploading ? "Uploading…" : "Upload from device"}</button>
            <span className="admin-upload-or">or paste a link</span>
          </div>
          <input id="p-image" type="text" inputMode="url" placeholder="https://… or /image.png" value={form.image} onChange={(event) => set("image", event.target.value)} aria-invalid={attempted && !form.image.trim()} aria-describedby="p-image-hint" required />
          <p className="auth-field-hint" id="p-image-hint">PNG, JPG, WebP or GIF. Large photos are resized automatically (2 MB max).</p>
        </div>
        <div className="auth-field wide"><label htmlFor="p-desc">Description</label><textarea id="p-desc" rows={4} maxLength={4000} value={form.description} onChange={(event) => set("description", event.target.value)} aria-invalid={attempted && !form.description.trim()} required /></div>
        {previewOk && <div className="admin-preview wide"><span>Image preview</span><div className="admin-preview-box"><ProductImage key={form.image} src={form.image.trim()} alt="Product preview" sizes="160px" /></div></div>}
      </div>
      {error && <p className="auth-message" role="alert">{error}</p>}
      {success && <p className="account-success" role="status">{success}</p>}
      <button className="auth-submit admin-submit" type="submit" disabled={busy}>{busy ? "Saving…" : editingId ? "Save changes" : "Add product"}</button>
    </form>

    <div className="admin-list-head"><h2>All products <small>({total})</small></h2><input className="admin-search" type="search" placeholder="Search products" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} aria-label="Search products" /></div>
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Stock</th><th><span className="sr-only">Actions</span></th></tr></thead>
        <tbody>
          {loading && products.length === 0 && <tr><td colSpan={5} className="admin-empty">Loading products…</td></tr>}
          {!loading && products.length === 0 && <tr><td colSpan={5} className="admin-empty">No products found.</td></tr>}
          {products.map((product) => <tr key={product._id}>
            <td data-label="Product"><div className="admin-product-cell"><span className="admin-thumb"><ProductImage src={product.image} alt="" sizes="44px" /></span><span title={product.title}>{product.title}</span></div></td>
            <td data-label="Category">{product.category}</td>
            <td data-label="Price">${product.price.toFixed(2)}</td>
            <td data-label="Stock"><StockEditor key={`${product._id}-${product.stock}`} product={product} onSaved={() => { setSuccess("Stock updated."); void load(); }} onError={setError} /></td>
            <td data-label="Actions" className="admin-actions"><button type="button" onClick={() => startEdit(product)}>Edit</button><button type="button" className="danger" onClick={() => setPendingDelete(product)}>Delete</button></td>
          </tr>)}
        </tbody>
      </table>
    </div>
    {pages > 1 && <nav className="pagination" aria-label="Product pages"><button type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</button><span>Page {page} of {pages}</span><button type="button" disabled={page >= pages} onClick={() => setPage((current) => current + 1)}>Next</button></nav>}
    <ConfirmDialog open={pendingDelete !== null} danger busy={deleting} title="Delete this product?" message={pendingDelete ? `“${pendingDelete.title}” will be removed from the shop. This cannot be undone.` : ""} confirmLabel="Delete product" onConfirm={() => void confirmDelete()} onCancel={() => setPendingDelete(null)} />
  </div>;
}
