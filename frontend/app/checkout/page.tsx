import CheckoutClient from "@/components/CheckoutClient";
import BrandLogo from "@/components/BrandLogo";
import { apiFetch } from "@/lib/api";
import { getSetting } from "@/lib/settings";

export const revalidate = 3600;
export const metadata = { title: "Checkout" };

export default async function CheckoutPage() {
  const [cities, required, delivery, info] = await Promise.all([
    apiFetch<Array<{ name: string; deliveryMinDays: number; deliveryMaxDays: number }>>("/api/cities", { next: { revalidate: 3600, tags: ["cities"] } }).catch(() => []),
    Promise.resolve({fullName:true,phone:true,email:false,city:true,address:true,postcode:false,orderNotes:false,terms:false}),
    getSetting<any>("store.delivery", { mode: "FREE", flatRate: 0, freeAbove: 0 }),
    getSetting<{ phone?: string; whatsapp?: string }>("store.info", { phone: "0300-2026711", whatsapp: "923002026711" }),
  ]);
  const phone = String(info.phone || "0300-2026711");
  const whatsapp = String(info.whatsapp || "923002026711").replace(/\D/g, "");

  return (
    <div className="mock-checkout-page">
      <div className="mock-checkout-special-head">
        <div className="site-shell"><BrandLogo /><b>Secure checkout</b><span>Need help? {phone}</span></div>
      </div>
      <div className="site-shell">
        <div className="mock-checkout-title">
          <div><span className="mock-eyebrow">ALMOST THERE</span><h1>Checkout</h1></div>
          <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer">Prefer WhatsApp? Order with us →</a>
        </div>
        <CheckoutClient cities={cities} required={required} delivery={delivery} />
      </div>
    </div>
  );
}
