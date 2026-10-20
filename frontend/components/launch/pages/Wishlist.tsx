'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {useShop} from '@/lib/launch/store';
import {designProduct} from '@/lib/launch/adapter';
import type {Product} from '@/lib/launch/catalog';
import {ProductGrid} from '../product/ProductGrid';
export default function Wishlist(){
 const {wishlist,ready}=useShop(),[products,setProducts]=useState<Product[]>([]),[loading,setLoading]=useState(true);
 useEffect(()=>{if(!ready)return;const controller=new AbortController();let slugs:Record<string,string>={};try{slugs=JSON.parse(localStorage.getItem('zm_wishlist_slugs')||'{}');}catch{}
 setLoading(true);void Promise.allSettled(wishlist.map(id=>slugs[id]?fetch('/api/store-proxy/api/products/slug/'+encodeURIComponent(slugs[id]),{signal:controller.signal}).then(r=>{if(!r.ok)throw new Error('Unavailable');return r.json();}).then(designProduct):Promise.reject())).then(results=>{if(controller.signal.aborted)return;setProducts(results.flatMap(r=>r.status==='fulfilled'?[r.value]:[]));setLoading(false);});return()=>controller.abort();},[wishlist,ready]);
 return <section className="section"><div className="container"><h1>Your Wishlist</h1>{loading?<div className="skeleton-block" aria-label="Loading saved products"/>:products.length?<ProductGrid items={products}/>:<div className="empty-state"><h2>No saved products available</h2><Link href="/shop-all-products" className="btn">Explore products</Link></div>}</div></section>;
}
