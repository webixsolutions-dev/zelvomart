import Link from 'next/link';
import {launchProducts,launchCategories} from '@/lib/launch/server';
import {collections,type CollectionKey} from '@/lib/launch/catalog';
import {Hero} from '../home/Hero';
import {CollectionAbout} from './CollectionAbout';
import {ProductGrid} from '../product/ProductGrid';

export default async function Archive({collection='shop',category,searchParams={}}:{collection?:CollectionKey;category?:string;searchParams?:Record<string,string|string[]|undefined>}){
 const read=(k:string)=>typeof searchParams[k]==='string'?searchParams[k] as string:'';
 const cats=await launchCategories().catch(()=>[]),cat=cats.find(c=>c.slug===category),info=collections[collection];
 const query=new URLSearchParams({limit:'16',page:String(Math.max(1,Math.floor(Number(read('page'))||1)))});
 const sort=read('sort')|| (collection==='new-arrivals'?'newest':collection==='bestsellers'?'popular':'newest');
 query.set('sort',['popular','newest','price-asc','price-desc'].includes(sort)?sort:'newest');
 if(category||read('category'))query.set('category',category||read('category'));
 if(collection==='deals')query.set('tag','discount');
 if(collection==='bestsellers')query.set('tag','best-selling');
 if(read('q'))query.set('search',read('q').slice(0,150));
 for(const k of ['minPrice','maxPrice'])if(read(k)&&Number.isFinite(Number(read(k)))&&Number(read(k))>=0)query.set(k,read(k));
 if(read('availability')==='instock')query.set('availability','instock');
 const result=await launchProducts(query.toString()).then(data=>({data,error:false})).catch(()=>({data:{items:[],page:1,total:0,totalPages:1},error:true}));
 const title=read('q')?'Search results':cat?.name||info.title;
 const pageLink=(page:number)=>{const next=new URLSearchParams();for(const[k,v]of Object.entries(searchParams))if(typeof v==='string'&&k!=='page')next.set(k,v);next.set('page',String(page));return '?'+next.toString();};
 return <>
  <Hero size="short" desktop={cat?.banner||info.banner} mobile={cat?.bannerMobile||info.bannerMobile} title={title} sub={cat?.intro||info.sub} breadcrumbs={[{label:title}]}/>
  <section className="section"><div className="container">
   <form className="launch-archive-filters" method="get">
    <label>Search<input name="q" type="search" defaultValue={read('q')} placeholder="Search products or SKU"/></label>
    {!category&&<label>Category<select name="category" defaultValue={read('category')}><option value="">All categories</option>{cats.map(c=><option key={c.slug} value={c.slug}>{c.name}</option>)}</select></label>}
    <label>Sort by<select name="sort" defaultValue={sort}><option value="newest">Newest first</option><option value="popular">Bestselling</option><option value="price-asc">Price: low to high</option><option value="price-desc">Price: high to low</option></select></label>
    <label>Min. price<input type="number" min="0" name="minPrice" defaultValue={read('minPrice')}/></label><label>Max. price<input type="number" min="0" name="maxPrice" defaultValue={read('maxPrice')}/></label>
    <label className="launch-stock-check"><input name="availability" type="checkbox" value="instock" defaultChecked={read('availability')==='instock'}/> In stock only</label>
    <button className="btn" type="submit">Apply filters</button><Link className="btn ghost" href={category?`/category/${category}`:collection==='shop'?'/shop-all-products':collection==='deals'?'/deals-and-offers':'/'+collection}>Reset</Link>
   </form>
   <p role="status">{result.error?'Products are temporarily unavailable. Please try again.':`${result.data.total} products${read('q')?' matching your search':''}`}</p>
   <ProductGrid items={result.data.items}/>
   {!result.error&&!result.data.items.length&&<div className="empty-state"><h2>No products found</h2><p>Try a different search or remove a filter.</p></div>}
   <nav className="launch-pagination" aria-label="Product pages">{result.data.page>1&&<Link className="btn secondary" href={pageLink(result.data.page-1)}>Previous</Link>}<span>Page {result.data.page} of {Math.max(1,result.data.totalPages)}</span>{result.data.page<result.data.totalPages&&<Link className="btn" href={pageLink(result.data.page+1)}>Next</Link>}</nav>
   <CollectionAbout name={cat?.name||title} text={cat?.about||info.sub}/>
  </div></section>
 </>;
}
