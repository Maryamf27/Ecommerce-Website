"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { Check, X } from "lucide-react";
import ProductImage from "@/components/ProductImage";
import type { ProductDTO } from "@/types/product";
import type { CartViewItem } from "@/lib/commerce-service";

type AddedToast = { key: number; title: string; image: string; quantity: number; total: number };
type GuestCartLine = { productId: string; quantity: number };
type CommerceContextValue = {
  cartItems: CartViewItem[];
  wishlistItems: ProductDTO[];
  cartCount: number;
  wishlistCount: number;
  loading: boolean;
  /** False until the first load of persisted cart/wishlist data has finished (success or failure). */
  ready: boolean;
  /** True when the last attempt to load the cart/wishlist failed (the empty lists are then unknown, not empty). */
  loadError: boolean;
  error: string;
  notice: string;
  addToCart: (product: ProductDTO, quantity?: number) => Promise<boolean>;
  setQuantity: (productId: string, quantity: number) => Promise<boolean>;
  removeFromCart: (productId: string) => Promise<boolean>;
  clearCart: () => Promise<boolean>;
  toggleWishlist: (product: ProductDTO) => Promise<boolean>;
  removeFromWishlist: (productId: string) => Promise<boolean>;
  addWishlistToCart: (product: ProductDTO) => Promise<boolean>;
  refresh: () => Promise<void>;
};

const CART_KEY = "nexora_guest_cart";
const WISHLIST_KEY = "nexora_guest_wishlist";
const MERGE_KEY = "nexora_guest_merge_id";
const CommerceContext = createContext<CommerceContextValue | null>(null);

function readGuestCart(): GuestCartLine[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(CART_KEY) ?? "[]");
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is GuestCartLine => typeof item === "object" && item !== null
      && typeof item.productId === "string" && /^[a-f\d]{24}$/i.test(item.productId)
      && Number.isSafeInteger(item.quantity) && item.quantity >= 1 && item.quantity <= 99).slice(0, 100);
  } catch { return []; }
}

function readGuestWishlist(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(WISHLIST_KEY) ?? "[]");
    return Array.isArray(value) ? Array.from(new Set(value.filter((id): id is string => typeof id === "string" && /^[a-f\d]{24}$/i.test(id)))).slice(0, 500) : [];
  } catch { return []; }
}

/**
 * Saves are serialised: while one request is in flight, further edits only update the on-screen state
 * and are sent together afterwards. Without this, responses could arrive out of order and an older
 * response would overwrite a newer click (4 -> 5 -> 6 -> 5 -> 6 in the cart).
 */
type SaveQueue = { running: boolean; dirty: boolean; waiters: Array<(ok: boolean) => void> };
const newQueue = (): SaveQueue => ({ running: false, dirty: false, waiters: [] });

async function drain(queue: SaveQueue, send: () => Promise<boolean>): Promise<void> {
  if (queue.running) return;
  queue.running = true;
  try {
    while (queue.dirty) {
      queue.dirty = false;
      const waiters = queue.waiters;
      queue.waiters = [];
      const ok = await send();
      for (const resolve of waiters) resolve(ok);
      if (!ok) {
        // Edits made after a failed save were built on the failed state; they were rolled back together.
        queue.dirty = false;
        const rest = queue.waiters;
        queue.waiters = [];
        for (const resolve of rest) resolve(false);
      }
    }
  } finally { queue.running = false; }
}

function enqueue(queue: SaveQueue, send: () => Promise<boolean>): Promise<boolean> {
  return new Promise((resolve) => { queue.waiters.push(resolve); queue.dirty = true; void drain(queue, send); });
}

const guestCartLines = (items: CartViewItem[]) => items.map(({ product, quantity }) => ({ productId: product._id, quantity }));

async function readJson<T>(response: Response): Promise<T> {
  const payload = await response.json() as { success?: boolean; data?: T; error?: { message?: string } };
  if (!response.ok || !payload.success || payload.data === undefined) throw new Error(payload.error?.message ?? "Shopping data could not be saved.");
  return payload.data;
}

type CartData = { items: CartViewItem[]; subtotal: number; count: number };

export function CommerceProvider({ children }: { children: ReactNode }) {
  const [cartItems, setCartItems] = useState<CartViewItem[]>([]);
  const [wishlistItems, setWishlistItems] = useState<ProductDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(false);
  // Badge counts taken from the saved guest data when the API could not be reached.
  const [guestFallback, setGuestFallback] = useState<{ cart: number; wishlist: number } | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [added, setAdded] = useState<AddedToast | null>(null);
  const authenticated = useRef(false);
  // True when the last load failed: in-memory state is then empty/unknown, so writing it back would erase saved data.
  const loadFailed = useRef(false);
  // Last cart/wishlist state the server confirmed; the rollback target if a save fails.
  const cartConfirmed = useRef<CartViewItem[]>([]);
  const wishlistConfirmed = useRef<ProductDTO[]>([]);
  const cartQueue = useRef<SaveQueue>(newQueue());
  const wishlistQueue = useRef<SaveQueue>(newQueue());
  const cartRef = useRef<CartViewItem[]>([]);
  const wishlistRef = useRef<ProductDTO[]>([]);

  useEffect(() => {
    if (!added) return;
    const timer = window.setTimeout(() => setAdded(null), 6000);
    return () => window.clearTimeout(timer);
  }, [added]);
  useEffect(() => {
    if (!notice && !error) return;
    const timer = window.setTimeout(() => { setNotice(""); setError(""); }, error ? 6000 : 3000);
    return () => window.clearTimeout(timer);
  }, [notice, error]);

  const updateCart = useCallback((items: CartViewItem[]) => { cartRef.current = items; setCartItems(items); }, []);
  const updateWishlist = useCallback((items: ProductDTO[]) => { wishlistRef.current = items; setWishlistItems(items); }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const guestCart = readGuestCart();
    const guestWishlist = readGuestWishlist();
    try {
      const authResponse = await fetch("/api/auth/me", { cache: "no-store" });
      const auth = await authResponse.json() as { success?: boolean; data?: { user?: { role?: string } } };
      if (authResponse.ok && auth.success && auth.data?.user?.role === "admin") {
        // Administrators manage the store; they have no cart or wishlist.
        authenticated.current = true;
        updateCart([]);
        updateWishlist([]);
        cartConfirmed.current = [];
        wishlistConfirmed.current = [];
      } else if (authResponse.ok && auth.success) {
        const mergeId = localStorage.getItem(MERGE_KEY) ?? crypto.randomUUID();
        localStorage.setItem(MERGE_KEY, mergeId);
        const data = await readJson<{ cart: CartData; wishlist: ProductDTO[] }>(await fetch("/api/commerce/merge", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cartItems: guestCart, wishlistIds: guestWishlist, mergeId }),
        }));
        authenticated.current = true;
        localStorage.removeItem(CART_KEY);
        localStorage.removeItem(WISHLIST_KEY);
        localStorage.removeItem(MERGE_KEY);
        updateCart(data.cart.items);
        updateWishlist(data.wishlist);
        cartConfirmed.current = data.cart.items;
        wishlistConfirmed.current = data.wishlist;
      } else {
        authenticated.current = false;
        const [cart, wishlist] = await Promise.all([
          readJson<CartData>(await fetch("/api/cart", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: guestCart }) })),
          readJson<{ items: ProductDTO[] }>(await fetch("/api/wishlist", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productIds: guestWishlist }) })),
        ]);
        const validCart = cart.items.map(({ product, quantity }) => ({ productId: product._id, quantity }));
        const validWishlist = wishlist.items.map((product) => product._id);
        localStorage.setItem(CART_KEY, JSON.stringify(validCart));
        localStorage.setItem(WISHLIST_KEY, JSON.stringify(validWishlist));
        updateCart(cart.items);
        updateWishlist(wishlist.items);
        cartConfirmed.current = cart.items;
        wishlistConfirmed.current = wishlist.items;
      }
      setGuestFallback(null);
      loadFailed.current = false;
      setLoadError(false);
    } catch (cause) {
      loadFailed.current = true;
      setLoadError(true);
      setError(cause instanceof Error ? cause.message : "Your shopping data could not be loaded.");
      if (!authenticated.current) {
        // Keep the saved guest IDs intact so temporary API failures never erase a guest's selections.
        updateCart([]);
        updateWishlist([]);
        // The header badges still reflect what is saved locally instead of showing a false 0.
        setGuestFallback({ cart: guestCart.reduce((sum, line) => sum + line.quantity, 0), wishlist: guestWishlist.length });
      }
    } finally { setLoading(false); setReady(true); }
  }, [updateCart, updateWishlist]);

  // Track the load in flight so edits made while it runs wait for it, instead of being overwritten by its response.
  const refreshing = useRef<Promise<void> | null>(null);
  const refresh = useCallback(() => {
    const run = load();
    refreshing.current = run;
    void run.finally(() => { if (refreshing.current === run) refreshing.current = null; });
    return run;
  }, [load]);
  const settled = useCallback(async () => { if (refreshing.current) await refreshing.current; }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => { void refresh(); }, 0);
    const handleSessionChange = () => { void refresh(); };
    window.addEventListener("nexora:session-changed", handleSessionChange);
    window.addEventListener("storage", handleSessionChange);
    return () => {
      window.clearTimeout(initialLoad);
      window.removeEventListener("nexora:session-changed", handleSessionChange);
      window.removeEventListener("storage", handleSessionChange);
    };
  }, [refresh]);

  const sendCart = useCallback(async (): Promise<boolean> => {
    const sending = cartRef.current;
    try {
      const data = await readJson<CartData>(await fetch("/api/cart", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: guestCartLines(sending) }) }));
      cartConfirmed.current = data.items;
      // If the shopper clicked again while this request was in flight, the next request will reconcile.
      if (!cartQueue.current.dirty) {
        updateCart(data.items);
        setNotice("Cart updated.");
        if (!authenticated.current) localStorage.setItem(CART_KEY, JSON.stringify(guestCartLines(data.items)));
      }
      return true;
    } catch (cause) {
      updateCart(cartConfirmed.current);
      if (!authenticated.current) localStorage.setItem(CART_KEY, JSON.stringify(guestCartLines(cartConfirmed.current)));
      setError(cause instanceof Error ? cause.message : "Your cart could not be updated.");
      return false;
    }
  }, [updateCart]);

  const saveCart = useCallback(async (next: CartViewItem[]) => {
    if (loadFailed.current) {
      // Saving now would overwrite the stored cart with the empty in-memory copy. Retry the load instead.
      setError("Your shopping data could not be loaded yet. Please try again in a moment.");
      void refresh();
      return false;
    }
    updateCart(next);
    setNotice("");
    setError("");
    if (!authenticated.current) {
      localStorage.removeItem(MERGE_KEY);
      localStorage.setItem(CART_KEY, JSON.stringify(guestCartLines(next)));
    }
    return enqueue(cartQueue.current, sendCart);
  }, [updateCart, refresh, sendCart]);

  const sendWishlist = useCallback(async (): Promise<boolean> => {
    const sending = wishlistRef.current;
    try {
      const data = await readJson<{ items: ProductDTO[] }>(await fetch("/api/wishlist", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productIds: sending.map((product) => product._id) }) }));
      wishlistConfirmed.current = data.items;
      if (!wishlistQueue.current.dirty) {
        updateWishlist(data.items);
        setNotice("Wishlist updated.");
        if (!authenticated.current) localStorage.setItem(WISHLIST_KEY, JSON.stringify(data.items.map((product) => product._id)));
      }
      return true;
    } catch (cause) {
      updateWishlist(wishlistConfirmed.current);
      if (!authenticated.current) localStorage.setItem(WISHLIST_KEY, JSON.stringify(wishlistConfirmed.current.map((product) => product._id)));
      setError(cause instanceof Error ? cause.message : "Your wishlist could not be updated.");
      return false;
    }
  }, [updateWishlist]);

  const saveWishlist = useCallback(async (next: ProductDTO[]) => {
    if (loadFailed.current) {
      setError("Your shopping data could not be loaded yet. Please try again in a moment.");
      void refresh();
      return false;
    }
    updateWishlist(next);
    setNotice("");
    setError("");
    if (!authenticated.current) {
      localStorage.removeItem(MERGE_KEY);
      localStorage.setItem(WISHLIST_KEY, JSON.stringify(next.map((product) => product._id)));
    }
    return enqueue(wishlistQueue.current, sendWishlist);
  }, [updateWishlist, refresh, sendWishlist]);

  const addToCart = useCallback(async (product: ProductDTO, quantity = 1) => {
    await settled();
    if (product.stock < 1) { setError("This product is currently out of stock."); return false; }
    const current = cartRef.current;
    const existing = current.find((item) => item.product._id === product._id);
    const nextQuantity = (existing?.quantity ?? 0) + quantity;
    if (nextQuantity > product.stock || nextQuantity > 99) { setError("That quantity is not available."); return false; }
    const next = existing
      ? current.map((item) => item.product._id === product._id ? { ...item, product, quantity: nextQuantity, lineTotal: product.price * nextQuantity, available: true } : item)
      : [...current, { product, quantity, lineTotal: product.price * quantity, available: true }];
    const saved = await saveCart(next);
    if (saved) {
      setNotice("");
      setAdded({ key: Date.now(), title: product.title, image: product.image, quantity: nextQuantity, total: next.reduce((sum, item) => sum + item.quantity, 0) });
    }
    return saved;
  }, [saveCart, settled]);

  const setQuantity = useCallback(async (productId: string, quantity: number) => {
    await settled();
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 99) return false;
    const item = cartRef.current.find((entry) => entry.product._id === productId);
    if (!item || (quantity > item.quantity && quantity > item.product.stock)) { setError("That quantity is not available."); return false; }
    return saveCart(cartRef.current.map((entry) => entry.product._id === productId ? { ...entry, quantity, lineTotal: entry.product.price * quantity, available: true } : entry));
  }, [saveCart, settled]);

  const removeFromCart = useCallback(async (productId: string) => { await settled(); return saveCart(cartRef.current.filter((item) => item.product._id !== productId)); }, [saveCart, settled]);
  const clearCart = useCallback(async () => { await settled(); return saveCart([]); }, [saveCart, settled]);
  const toggleWishlist = useCallback(async (product: ProductDTO) => {
    await settled();
    const next = wishlistRef.current.some((item) => item._id === product._id)
      ? wishlistRef.current.filter((item) => item._id !== product._id)
      : [...wishlistRef.current, product];
    return saveWishlist(next);
  }, [saveWishlist, settled]);
  const removeFromWishlist = useCallback(async (productId: string) => { await settled(); return saveWishlist(wishlistRef.current.filter((item) => item._id !== productId)); }, [saveWishlist, settled]);
  const addWishlistToCart = useCallback((product: ProductDTO) => addToCart(product), [addToCart]);

  const value = useMemo<CommerceContextValue>(() => ({
    cartItems, wishlistItems,
    cartCount: guestFallback ? guestFallback.cart : cartItems.reduce((sum, item) => sum + item.quantity, 0),
    wishlistCount: guestFallback ? guestFallback.wishlist : wishlistItems.length,
    loading, ready, loadError, error, notice, addToCart, setQuantity, removeFromCart, clearCart, toggleWishlist,
    removeFromWishlist, addWishlistToCart, refresh,
  }), [cartItems, wishlistItems, guestFallback, loading, ready, loadError, error, notice, addToCart, setQuantity, removeFromCart, clearCart, toggleWishlist, removeFromWishlist, addWishlistToCart, refresh]);

  return <CommerceContext.Provider value={value}>{children}
    {added && <div className="cart-toast" key={added.key} role="status" aria-live="polite">
      <span className="cart-toast-thumb"><ProductImage src={added.image} alt="" sizes="48px" /></span>
      <div className="cart-toast-body">
        <p className="cart-toast-title"><Check size={14} aria-hidden="true" /> Added to your cart</p>
        <p className="cart-toast-product" title={added.title}>{added.title}</p>
        <p className="cart-toast-meta">{added.quantity} of this item · {added.total} {added.total === 1 ? "item" : "items"} in cart</p>
        <div className="cart-toast-actions"><Link className="cart-toast-primary" href="/cart" onClick={() => setAdded(null)}>View cart</Link><Link className="cart-toast-secondary" href="/checkout" onClick={() => setAdded(null)}>Checkout</Link></div>
      </div>
      <button className="cart-toast-close" type="button" aria-label="Dismiss" onClick={() => setAdded(null)}><X size={15} aria-hidden="true" /></button>
      <span className="cart-toast-timer" aria-hidden="true" />
    </div>}
    {(error || notice) && <p className={`commerce-toast${error ? " has-error" : ""}`} role={error ? "alert" : "status"}>{error || notice}</p>}</CommerceContext.Provider>;
}

export function useCommerce() {
  const context = useContext(CommerceContext);
  if (!context) throw new Error("useCommerce must be used inside CommerceProvider.");
  return context;
}
