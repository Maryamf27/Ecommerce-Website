"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import ProductImage from "@/components/ProductImage";
import type { ProductDTO } from "@/types/product";

const MIN_CHARS = 2;
const MAX_SUGGESTIONS = 6;

type SuggestResponse = { success?: boolean; data?: ProductDTO[]; pagination?: { total?: number } };

/**
 * The store's only product search. Desktop: an inline field in the header.
 * Mobile: a search icon that opens a full-width bar under the header.
 * Typing shows matching products; Enter (or "See all results") opens the shop with that search applied.
 */
export default function NavSearch() {
  const router = useRouter();
  const listId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false); // mobile panel
  const [focused, setFocused] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProductDTO[]>([]);
  const [total, setTotal] = useState(0);
  const [loadedFor, setLoadedFor] = useState("");
  const [failedFor, setFailedFor] = useState("");
  const [active, setActive] = useState(-1);

  const term = query.trim();
  const searchable = term.length >= MIN_CHARS;
  const failed = searchable && failedFor === term;
  const loading = searchable && loadedFor !== term && !failed;

  // Debounced lookup; older requests are cancelled so a slow response can never overwrite a newer one.
  useEffect(() => {
    if (!searchable) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({ search: term, limit: String(MAX_SUGGESTIONS), sort: "rating_desc" });
      fetch(`/api/products?${params}`, { signal: controller.signal })
        .then(async (response) => {
          const payload = await response.json() as SuggestResponse;
          if (!response.ok || !payload.success || !Array.isArray(payload.data)) throw new Error("search failed");
          setResults(payload.data);
          setTotal(payload.pagination?.total ?? payload.data.length);
          setLoadedFor(term);
          setActive(-1);
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          setFailedFor(term);
        });
    }, 220);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [term, searchable]);

  // Close the dropdown / mobile bar when clicking elsewhere or pressing Escape.
  useEffect(() => {
    function onPointer(event: PointerEvent) {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) { setFocused(false); setOpen(false); }
    }
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, []);

  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);

  const showPanel = focused && searchable;
  const rows = loadedFor === term ? results : [];
  const hasRows = rows.length > 0;
  // Options: each product, then the "see all" row.
  const optionCount = hasRows ? rows.length + 1 : 0;

  function finish() { setFocused(false); setOpen(false); setActive(-1); inputRef.current?.blur(); }
  function openProduct(product: ProductDTO) { finish(); router.push(`/products/${product._id}`); }
  function openResults() {
    if (!term) return;
    finish();
    router.push(`/shop?search=${encodeURIComponent(term)}#shop`);
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (hasRows && active >= 0 && active < rows.length) openProduct(rows[active]);
    else openResults();
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") { if (showPanel) setFocused(false); else setOpen(false); return; }
    if (!showPanel || optionCount === 0) return;
    if (event.key === "ArrowDown") { event.preventDefault(); setActive((current) => (current + 1) % optionCount); }
    if (event.key === "ArrowUp") { event.preventDefault(); setActive((current) => (current <= 0 ? optionCount - 1 : current - 1)); }
  }

  return <div className={`nav-search${open ? " is-open" : ""}`} ref={wrapRef}>
    <button className="icon-button nav-search-toggle" type="button" aria-label={open ? "Close search" : "Search products"} aria-expanded={open} onClick={() => setOpen((current) => !current)}>
      {open ? <X size={19} strokeWidth={1.8} /> : <Search size={19} strokeWidth={1.8} />}
    </button>
    <form className="nav-search-form" role="search" onSubmit={onSubmit}>
      <Search className="nav-search-icon" size={16} strokeWidth={1.8} aria-hidden="true" />
      <input
        ref={inputRef}
        className="nav-search-input"
        type="search"
        name="q"
        value={query}
        maxLength={100}
        placeholder="Search products…"
        autoComplete="off"
        enterKeyHint="search"
        role="combobox"
        aria-label="Search products"
        aria-expanded={showPanel}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showPanel && active >= 0 ? `${listId}-${active}` : undefined}
        onChange={(event) => { setQuery(event.target.value); setActive(-1); setFocused(true); }}
        onFocus={() => setFocused(true)}
        onKeyDown={onKeyDown}
      />
      {query && <button className="nav-search-clear" type="button" aria-label="Clear search" onClick={() => { setQuery(""); setActive(-1); inputRef.current?.focus(); }}><X size={14} strokeWidth={2} /></button>}

      {showPanel && <div className="nav-search-panel" id={listId} role="listbox" aria-label="Product suggestions">
        {loading && !hasRows && <p className="nav-search-note" role="status">Searching…</p>}
        {failed && <p className="nav-search-note" role="status">Suggestions are unavailable right now. Press Enter to search.</p>}
        {!loading && !failed && loadedFor === term && !hasRows && <p className="nav-search-note" role="status">No products found for “{term}”.</p>}
        {hasRows && <>
          {rows.map((product, index) => <button
            type="button"
            role="option"
            id={`${listId}-${index}`}
            aria-selected={active === index}
            className={`nav-search-item${active === index ? " is-active" : ""}`}
            key={product._id}
            onMouseEnter={() => setActive(index)}
            onClick={() => openProduct(product)}
          >
            <span className="nav-search-thumb"><ProductImage src={product.image} alt="" sizes="44px" /></span>
            <span className="nav-search-text"><strong>{product.title}</strong><small>{product.category}</small></span>
            <span className="nav-search-price">${product.price.toFixed(2)}</span>
          </button>)}
          <button
            type="button"
            role="option"
            id={`${listId}-${rows.length}`}
            aria-selected={active === rows.length}
            className={`nav-search-all${active === rows.length ? " is-active" : ""}`}
            onMouseEnter={() => setActive(rows.length)}
            onClick={openResults}
          >See all {total > rows.length ? `${total} ` : ""}results for “{term}”</button>
        </>}
      </div>}
    </form>
  </div>;
}
