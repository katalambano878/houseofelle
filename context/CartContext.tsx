'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

export type CartItem = {
    id: string;
    name: string;
    price: number;
    image: string;
    quantity: number;
    variant?: string;
    variantId?: string; // product_variants.id, so checkout can price the exact option
    slug: string;
    maxStock: number;
    moq?: number; // Minimum Order Quantity
};

type CartContextType = {
    cart: CartItem[];
    addToCart: (item: CartItem) => void;
    removeFromCart: (itemId: string, variant?: string) => void;
    updateQuantity: (itemId: string, quantity: number, variant?: string) => void;
    clearCart: () => void;
    cartCount: number;
    subtotal: number;
    isCartOpen: boolean;
    setIsCartOpen: (isOpen: boolean) => void;
};

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
    const [cart, setCart] = useState<CartItem[]>([]);
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [isInitialized, setIsInitialized] = useState(false);

    // Load cart from localStorage on mount, with migration for legacy items
    useEffect(() => {
        const savedCart = localStorage.getItem('cart');
        if (savedCart) {
            try {
                const parsed: CartItem[] = JSON.parse(savedCart);
                // Migrate legacy cart items: if `id` is not a UUID, it's likely a slug
                const isValidUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
                const migratedCart = parsed.filter(item => {
                    if (!item.id || !item.name || !item.price) return false; // Remove corrupted items
                    if (!isValidUUID(item.id)) {
                        // Legacy item with slug as id - ensure slug is set, then clear
                        // These items will be resolved at checkout via the slug fallback
                        // But best to remove them so users re-add with correct UUIDs
                        console.warn(`Removing legacy cart item with non-UUID id: ${item.id}`);
                        return false;
                    }
                    // Ensure slug field exists
                    if (!item.slug) {
                        item.slug = item.id;
                    }
                    return true;
                });
                setCart(migratedCart);
                // If items were removed, update localStorage immediately
                if (migratedCart.length !== parsed.length) {
                    localStorage.setItem('cart', JSON.stringify(migratedCart));
                }
            } catch (e) {
                console.error('Failed to parse cart:', e);
                localStorage.removeItem('cart');
            }
        }
        setIsInitialized(true);
    }, []);

    // Save cart to localStorage whenever it changes
    useEffect(() => {
        if (isInitialized) {
            localStorage.setItem('cart', JSON.stringify(cart));
            window.dispatchEvent(new Event('cartUpdated')); // Keep compatibility with legacy listeners if any
        }
    }, [cart, isInitialized]);

    // A missing or zero maxStock means "no known cap" (e.g. products that keep selling when out of stock).
    const stockCap = (item: CartItem) => (item.maxStock && item.maxStock > 0 ? item.maxStock : Infinity);
    const sameLine = (item: CartItem, id: string, variant?: string) =>
        item.id === id && (item.variant || '') === (variant || '');

    // Write through immediately so a navigation right after adding (Buy Now) sees the item.
    const persist = (next: CartItem[]) => {
        try { localStorage.setItem('cart', JSON.stringify(next)); } catch {}
        return next;
    };

    const addToCart = (newItem: CartItem) => {
        setCart((prevCart) => {
            const existingItemIndex = prevCart.findIndex((item) => sameLine(item, newItem.id, newItem.variant));
            const minQty = newItem.moq || 1;

            if (existingItemIndex > -1) {
                const newCart = [...prevCart];
                const existingItem = newCart[existingItemIndex];
                const newQuantity = Math.min(existingItem.quantity + newItem.quantity, stockCap(existingItem));
                newCart[existingItemIndex] = { ...existingItem, quantity: Math.max(newQuantity, minQty) };
                return persist(newCart);
            }
            const quantity = Math.min(Math.max(newItem.quantity || minQty, minQty), stockCap(newItem));
            return persist([...prevCart, { ...newItem, quantity }]);
        });

        setIsCartOpen(true); // Open cart when item is added
    };

    const removeFromCart = (itemId: string, variant?: string) => {
        setCart((prevCart) => persist(prevCart.filter((item) => !sameLine(item, itemId, variant))));
    };

    const updateQuantity = (itemId: string, quantity: number, variant?: string) => {
        setCart((prevCart) => {
            const item = prevCart.find(i => sameLine(i, itemId, variant));
            if (!item) return prevCart;

            const minQty = item.moq || 1;

            // If trying to reduce below MOQ, remove the item
            if (quantity < minQty) {
                return persist(prevCart.filter(i => !sameLine(i, itemId, variant)));
            }

            // Clamp quantity between MOQ and maxStock
            const clampedQty = Math.min(Math.max(quantity, minQty), stockCap(item));

            return persist(prevCart.map((i) => (sameLine(i, itemId, variant) ? { ...i, quantity: clampedQty } : i)));
        });
    };

    const clearCart = () => {
        // Persist now: checkout clears the cart and immediately leaves for the payment page.
        setCart(persist([]));
        try { localStorage.removeItem('appliedCoupon'); } catch {}
    };

    const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    return (
        <CartContext.Provider value={{
            cart,
            addToCart,
            removeFromCart,
            updateQuantity,
            clearCart,
            cartCount,
            subtotal,
            isCartOpen,
            setIsCartOpen
        }}>
            {children}
        </CartContext.Provider>
    );
}

export function useCart() {
    const context = useContext(CartContext);
    if (context === undefined) {
        throw new Error('useCart must be used within a CartProvider');
    }
    return context;
}
