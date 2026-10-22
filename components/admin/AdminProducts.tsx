"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import ConfirmDialog from "@/components/ConfirmDialog";
import ProductImage from "@/components/ProductImage";
import Select from "@/components/Select";
import type { ProductDTO } from "@/types/product";

type Form = { title: string; description: string; price: string; category: string; image: string; stock: string };
const emptyForm: Form = { title: "", description: "", price: "", category: "", image: "", stock: "12" };
type ListResponse = { success?: boolean; data?: ProductDTO[]; categories?: string[]; pagination?: { pages: number; total: number }; error?: { message?: string } };
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
  const formRef = useRef<HTMLFormElement>(null);

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
  function reset() { setForm(emptyForm); setEditingId(null); setCustomCategory(false); }

  function startEdit(product: ProductDTO) {
    setEditingId(product._id);
    setCustomCategory(!categories.includes(product.category));
    setForm({ title: product.title, description: product.description, price: String(product.price), category: product.category, image: product.image, stock: String(product.stock) });
    setError(""); setSuccess("");
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(""); setSuccess("");
    const price = Number(form.price);
    const stock = Number(form.stock);
    if (!form.title.trim() || !form.description.trim() || !form.category.trim() || !form.image.trim()) { setError("Title, description, category and image URL are required."); return; }
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

  const previewOk = /^https?:\/\//i.test(form.image.trim());
  return <div className="admin-products">
    <form className="admin-form" ref={formRef} onSubmit={submit} noValidate>
      <div className="admin-form-head"><h2>{editingId ? "Edit product" : "Add a new product"}</h2>{editingId && <button className="commerce-text-button" type="button" onClick={reset}>Cancel editing</button>}</div>
      <div className="admin-form-grid">
        <div className="auth-field wide"><label htmlFor="p-title">Title</label><input id="p-title" value={form.title} maxLength={180} onChange={(event) => set("title", event.target.value)} required /></div>
        <div className="auth-field"><label htmlFor="p-price">Price (USD)</label><input id="p-price" type="number" min="0" step="0.01" value={form.price} onChange={(event) => set("price", event.target.value)} required /></div>
        <div className="auth-field"><label htmlFor="p-stock">Stock quantity</label><input id="p-stock" type="number" min="0" step="1" value={form.stock} onChange={(event) => set("stock", event.target.value)} required /></div>
        <div className="auth-field"><label htmlFor="p-category">Category</label>
          <Select id="p-category" placeholder="Select a category" value={customCategory ? "__new__" : form.category} onChange={(next) => { if (next === "__new__") { setCustomCategory(true); set("category", ""); } else { setCustomCategory(false); set("category", next); } }} options={[...categories.map((item) => ({ value: item, label: item })), { value: "__new__", label: "+ Add new category…" }]} />
          {customCategory && <input aria-label="New category name" placeholder="New category name" value={form.category} maxLength={100} onChange={(event) => set("category", event.target.value)} autoFocus />}
        </div>
        <div className="auth-field"><label htmlFor="p-image">Image URL</label><input id="p-image" type="url" placeholder="https://…" value={form.image} onChange={(event) => set("image", event.target.value)} required /></div>
        <div className="auth-field wide"><label htmlFor="p-desc">Description</label><textarea id="p-desc" rows={4} maxLength={4000} value={form.description} onChange={(event) => set("description", event.target.value)} required /></div>
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
            <td><div className="admin-product-cell"><span className="admin-thumb"><ProductImage src={product.image} alt="" sizes="44px" /></span><span title={product.title}>{product.title}</span></div></td>
            <td>{product.category}</td>
            <td>${product.price.toFixed(2)}</td>
            <td><StockEditor key={`${product._id}-${product.stock}`} product={product} onSaved={() => { setSuccess("Stock updated."); void load(); }} onError={setError} /></td>
            <td className="admin-actions"><button type="button" onClick={() => startEdit(product)}>Edit</button><button type="button" className="danger" onClick={() => setPendingDelete(product)}>Delete</button></td>
          </tr>)}
        </tbody>
      </table>
    </div>
    {pages > 1 && <nav className="pagination" aria-label="Product pages"><button type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</button><span>Page {page} of {pages}</span><button type="button" disabled={page >= pages} onClick={() => setPage((current) => current + 1)}>Next</button></nav>}
    <ConfirmDialog open={pendingDelete !== null} danger busy={deleting} title="Delete this product?" message={pendingDelete ? `“${pendingDelete.title}” will be removed from the shop. This cannot be undone.` : ""} confirmLabel="Delete product" onConfirm={() => void confirmDelete()} onCancel={() => setPendingDelete(null)} />
  </div>;
}
