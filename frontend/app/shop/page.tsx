import Image from "next/image";
import Link from "next/link";
import ProductGrid from "@/components/ProductGrid";
import TrustStrip from "@/components/TrustStrip";
import { getCategories, getProducts } from "@/lib/store";
import SearchTracker from "@/components/SearchTracker";

export const revalidate = 120;
const v=(x:string|string[]|undefined)=>Array.isArray(x)?x[0]:x||"";
export default async function ShopPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const sp=await searchParams; const q=v(sp.q).trim(); const category=v(sp.category).trim(); const sortRaw=v(sp.sort); const sort=sortRaw==="price-asc"||sortRaw==="price-desc"?sortRaw:"newest";
 const [result,categories]=await Promise.all([getProducts({search:q||undefined,category:category||undefined,sort,limit:24}),getCategories()]);
 return <div className="mock-listing-page">{q?<SearchTracker query={q}/>:null}
  <section className="site-shell mock-listing-intro"><nav>Home <span>›</span> Shop</nav><h1>{q?`Results for ${q}`:"Shop all"}</h1><p>Everything useful, giftable and worth keeping — all in one place.</p></section>
  <section className="site-shell mock-listing-categories">{categories.slice(0,7).map(c=><Link key={c.id} href={`/product-category/${c.slug}/`}><span><Image src={c.image||`/images/categories/${c.slug}.webp`} alt={c.name} fill/></span><b>{c.name}</b></Link>)}</section>
  <section id="products" className="site-shell mock-listing-layout">
   <aside className="mock-filter-panel"><div className="mock-filter-title"><b>Filters</b><Link href="/shop">Clear all</Link></div><details open><summary>Category</summary>{categories.map(c=><Link key={c.id} href={`/shop?category=${c.slug}`} className={category===c.slug?"active":""}><span>□</span>{c.name}</Link>)}</details><details open><summary>Price</summary><div className="mock-price-line"><span>Rs 1,000</span><span>Rs 10,000+</span></div><div className="mock-price-slider"/></details><details open><summary>Colour</summary><div className="mock-filter-swatches"><i/><i/><i/><i/><i/><i/></div></details><details><summary>Rating</summary></details><details><summary>Availability</summary></details><details><summary>Offers</summary></details></aside>
   <div className="mock-listing-products"><div className="mock-listing-toolbar"><div className="mock-filter-mobile">☰ Filter</div><div className="mock-filter-chips"><Link className={!category?"active":""} href="/shop">All</Link>{categories.slice(0,4).map(c=><Link key={c.id} href={`/shop?category=${c.slug}`}>{c.name}</Link>)}</div><form><select name="sort" defaultValue={sort}><option value="newest">Bestselling</option><option value="price-asc">Price: Low to High</option><option value="price-desc">Price: High to Low</option></select><button>Sort</button></form></div><ProductGrid products={result.items} emptyText="No products found. Try another category or search."/><div className="mock-load-more"><span>Showing {result.items.length} of {result.total||result.items.length} products</span><div><i style={{width:`${Math.min(100,(result.items.length/Math.max(result.total||result.items.length,1))*100)}%`}}/></div><Link href="/shop">Load more</Link></div></div>
  </section>
  <section className="site-shell mock-listing-trust"><TrustStrip/></section>
 </div>;
}
