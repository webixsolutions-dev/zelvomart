"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useShop } from "@store/lib/store";

const CartDrawer = dynamic(() => import("./CartDrawer").then((m) => m.CartDrawer), { ssr: false });

/**
 * The cart drawer is closed on every first view, so it is not part of the page's first JavaScript. It mounts once
 * the browser is idle after load (so it still slides open smoothly), or at once if the cart is opened before that.
 */
export function LazyCartDrawer() {
  const { cartOpen } = useShop();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (ready) return;
    if (cartOpen) return setReady(true);
    const mount = () => setReady(true);
    const id = "requestIdleCallback" in window ? window.requestIdleCallback(mount, { timeout: 4000 }) : setTimeout(mount, 2000);
    return () => ("cancelIdleCallback" in window ? window.cancelIdleCallback(id as number) : clearTimeout(id as ReturnType<typeof setTimeout>));
  }, [cartOpen, ready]);
  return ready ? <CartDrawer /> : null;
}
