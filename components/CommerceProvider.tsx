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
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [added, setAdded] = useState<AddedToast | null>(null);
  const authenticated = useRef(false);
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

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    const guestCart = readGuestCart();
    const guestWishlist = readGuestWishlist();
    try {
      const authResponse = await fetch("/api/auth/me", { cache: "no-store" });
      const auth = await authResponse.json() as { success?: boolean };
      if (authResponse.ok && auth.success) {
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
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Your shopping data could not be loaded.");
      if (!authenticated.current) {
        // Keep the saved guest IDs intact so temporary API failures never erase a guest's selections.
        updateCart([]);
        updateWishlist([]);
      }
    } finally { setLoading(false); }
  }, [updateCart, updateWishlist]);

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

  const saveCart = useCallback(async (next: CartViewItem[]) => {
    const previous = cartRef.current;
    updateCart(next);
    setNotice("");
    if (!authenticated.current) {
      localStorage.removeItem(MERGE_KEY);
      localStorage.setItem(CART_KEY, JSON.stringify(next.map(({ product, quantity }) => ({ productId: product._id, quantity }))));
    }
    setError("");
    try {
      const data = await readJson<CartData>(await fetch("/api/cart", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: next.map(({ product, quantity }) => ({ productId: product._id, quantity })) }) }));
      updateCart(data.items);
      setNotice("Cart updated.");
      if (!authenticated.current) localStorage.setItem(CART_KEY, JSON.stringify(data.items.map(({ product, quantity }) => ({ productId: product._id, quantity }))));
      return true;
    } catch (cause) {
      updateCart(previous);
      if (!authenticated.current) localStorage.setItem(CART_KEY, JSON.stringify(previous.map(({ product, quantity }) => ({ productId: product._id, quantity }))));
      setError(cause instanceof Error ? cause.message : "Your cart could not be updated.");
      return false;
    }
  }, [updateCart]);

  const saveWishlist = useCallback(async (next: ProductDTO[]) => {
    const previous = wishlistRef.current;
    updateWishlist(next);
    setNotice("");
    if (!authenticated.current) {
      localStorage.removeItem(MERGE_KEY);
      localStorage.setItem(WISHLIST_KEY, JSON.stringify(next.map((product) => product._id)));
    }
    setError("");
    try {
      const data = await readJson<{ items: ProductDTO[] }>(await fetch("/api/wishlist", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productIds: next.map((product) => product._id) }) }));
      updateWishlist(data.items);
      setNotice("Wishlist updated.");
      if (!authenticated.current) localStorage.setItem(WISHLIST_KEY, JSON.stringify(data.items.map((product) => product._id)));
      return true;
    } catch (cause) {
      updateWishlist(previous);
      if (!authenticated.current) localStorage.setItem(WISHLIST_KEY, JSON.stringify(previous.map((product) => product._id)));
      setError(cause instanceof Error ? cause.message : "Your wishlist could not be updated.");
      return false;
    }
  }, [updateWishlist]);

  const addToCart = useCallback(async (product: ProductDTO, quantity = 1) => {
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
  }, [saveCart]);

  const setQuantity = useCallback(async (productId: string, quantity: number) => {
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 99) return false;
    const item = cartRef.current.find((entry) => entry.product._id === productId);
    if (!item || (quantity > item.quantity && quantity > item.product.stock)) { setError("That quantity is not available."); return false; }
    return saveCart(cartRef.current.map((entry) => entry.product._id === productId ? { ...entry, quantity, lineTotal: entry.product.price * quantity, available: true } : entry));
  }, [saveCart]);

  const removeFromCart = useCallback((productId: string) => saveCart(cartRef.current.filter((item) => item.product._id !== productId)), [saveCart]);
  const clearCart = useCallback(() => saveCart([]), [saveCart]);
  const toggleWishlist = useCallback((product: ProductDTO) => {
    const next = wishlistRef.current.some((item) => item._id === product._id)
      ? wishlistRef.current.filter((item) => item._id !== product._id)
      : [...wishlistRef.current, product];
    return saveWishlist(next);
  }, [saveWishlist]);
  const removeFromWishlist = useCallback((productId: string) => saveWishlist(wishlistRef.current.filter((item) => item._id !== productId)), [saveWishlist]);
  const addWishlistToCart = useCallback((product: ProductDTO) => addToCart(product), [addToCart]);

  const value = useMemo<CommerceContextValue>(() => ({
    cartItems, wishlistItems,
    cartCount: cartItems.reduce((sum, item) => sum + item.quantity, 0), wishlistCount: wishlistItems.length,
    loading, error, notice, addToCart, setQuantity, removeFromCart, clearCart, toggleWishlist,
    removeFromWishlist, addWishlistToCart, refresh,
  }), [cartItems, wishlistItems, loading, error, notice, addToCart, setQuantity, removeFromCart, clearCart, toggleWishlist, removeFromWishlist, addWishlistToCart, refresh]);

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
