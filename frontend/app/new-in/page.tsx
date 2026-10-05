import Image from "next/image";
import Link from "next/link";
import ProductGrid from "@/components/ProductGrid";
import StorePagination from "@/components/StorePagination";
import TrustStrip from "@/components/TrustStrip";
import { getProducts, getStoreBootstrap } from "@/lib/store";
import { getProductFallbackImage } from "@/lib/product-media";

export const revalidate = 120;
export const metadata = { title: "New In" };
const v=(x:string|string[]|undefined)=>Array.isArray(x)?x[0]:x||"";
export default async function NewInPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const sp=await searchParams; const page=Math.max(1,Number(v(sp.page))||1);
  const [result, bootstrap] = await Promise.all([getProducts({ sort: "newest", page, limit: 12 }),getStoreBootstrap()]);
  const lead = result.items[0]; const info = (bootstrap.settings["store.info"] || {}) as { whatsapp?: string }; const whatsapp = String(info.whatsapp || "923002026711").replace(/[^0-9]/g, "");
  return (<div className="mock-newin-page"><section className="site-shell mock-newin-hero"><div><span className="mock-eyebrow">FRESH AT ZELVOMART</span><h1>Just landed.</h1><p>New useful finds, giftable extras and everyday upgrades — added as soon as they&apos;re ready.</p><Link href="#new-products" className="mock-btn-dark">Shop new arrivals →</Link></div><div className="mock-newin-collage">{lead ? <Image src={lead.image || getProductFallbackImage(lead)} alt={lead.name} fill priority /> : null}</div></section><section id="new-products" className="site-shell mock-home-section"><div className="mock-section-head"><div><span className="mock-eyebrow">THIS WEEK</span><h2>Freshly added.</h2></div><div className="mock-filter-chips"><span className="active">All new</span>{bootstrap.categories.slice(0, 4).map((category) => <span key={category.id}>{category.name}</span>)}</div></div><ProductGrid products={result.items}/><div className="mock-listing-count">Showing {result.items.length} of {result.total||result.items.length} products</div><StorePagination currentPage={result.page||page} totalPages={result.totalPages||1} basePath="/new-in" /></section><section className="site-shell mock-whatsapp-strip"><div><span>◉</span><p><b>Want first dibs on new drops?</b><small>Ask us about new arrivals on WhatsApp.</small></p></div><a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer">Chat on WhatsApp</a></section><section className="site-shell mock-listing-trust"><TrustStrip /></section></div>);
}
