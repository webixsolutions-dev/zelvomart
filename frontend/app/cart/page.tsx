import CartPageClient from "@/components/CartPageClient";
export const metadata = { title: "Cart" };
export default function CartPage() { return <div className="site-shell"><div className="page-head"><h1>Your Cart</h1><p>Review your products before checkout.</p></div><CartPageClient /></div>; }
