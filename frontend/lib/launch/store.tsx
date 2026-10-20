'use client';
import {createContext,useContext,useState,useEffect,useMemo} from 'react';
import {toast} from 'react-toastify';
import {useCart} from '@/components/CartProvider';
import {useDeliveryPolicy} from '@/components/DeliveryPolicy';
import {trackStoreEvent} from '@/lib/client-tracking';
import {site} from './site';
import type {Category,Product} from './catalog';

type StoreInfo={phone?:string;email?:string;whatsapp?:string;replayRetentionDays?:number};
const Catalog=createContext<{categories:Category[];products:Product[];info:StoreInfo}>({categories:[],products:[],info:{}});
const Saved=createContext<{wishlist:string[];toggleWish:(id:string,p?:Product)=>void}>({wishlist:[],toggleWish:()=>{}});
export function LaunchCatalogProvider({children,categories,products,info={}}:{children:React.ReactNode;categories:Category[];products:Product[];info?:StoreInfo}){
 const [wishlist,setWishlist]=useState<string[]>([]);
 useEffect(()=>{try{const data=JSON.parse(localStorage.getItem('zm_wishlist')||'[]');if(Array.isArray(data))setWishlist(data.filter((v:unknown)=>typeof v==='string'));}catch{}},[]);
 const toggleWish=(id:string,product?:Product)=>setWishlist(current=>{const next=current.includes(id)?current.filter(i=>i!==id):[...current.slice(-49),id];try{localStorage.setItem('zm_wishlist',JSON.stringify(next));if(product){const snapshots=JSON.parse(localStorage.getItem('zm_wishlist_slugs')||'{}');snapshots[id]=product.slug;localStorage.setItem('zm_wishlist_slugs',JSON.stringify(Object.fromEntries(next.map(key=>[key,snapshots[key]]))));}}catch{}return next;});
 return <Catalog.Provider value={{categories,products,info}}><Saved.Provider value={{wishlist,toggleWish}}>{children}</Saved.Provider></Catalog.Provider>;
}
export const useCatalog=()=>useContext(Catalog);
export function useSite(){const delivery=useDeliveryPolicy(),{info}=useCatalog();return {...site,replayRetentionDays:info.replayRetentionDays??14,phoneDisplay:info.phone||site.phoneDisplay,email:info.email||site.email,whatsappNumber:String(info.whatsapp||site.whatsappNumber).replace(/\D/g,''),shipping:{...site.shipping,flatFee:delivery.flatRate,freeOver:delivery.threshold,estimate:'2–7 working days'}};}
export function useShop(){
 const cart=useCart();const {wishlist,toggleWish}=useContext(Saved);
 const addToCart=(p:Product,opts:{qty?:number;variant?:string;silent?:boolean}={})=>{
   if(!p.inStock){toast.info('This product is currently out of stock.');return;}
   if(p.raw.hasOptions){location.assign('/product/'+encodeURIComponent(p.slug));return;}
   const quantity=Math.max(1,Math.min(20,opts.qty||1));
   cart.addItem({productId:p.id,slug:p.slug,sku:p.sku,name:p.name,image:p.image,price:p.price,quantity,bundleSize:1,freeShipping:p.raw.freeShipping});
   if(opts.silent)cart.setOpen(false);
   void trackStoreEvent('AddToCart',{content_ids:[p.sku],contents:[{id:p.sku,quantity,item_price:p.price}],value:p.price*quantity,currency:'PKR'});
 };
 return {ready:cart.ready,cartCount:cart.totalItems,cartOpen:cart.open,setCartOpen:cart.setOpen,wishlist,toggleWish,isWished:(id:string)=>wishlist.includes(id),addToCart,notify:({title}:{title:string})=>toast.info(title)};
}
