"use client";
import Image from "next/image";
import Link from "next/link";
import { useCart } from "@/components/CartProvider";
import { money } from "@/lib/format";
import { MinusIcon, PlusIcon, TrashIcon, WhatsAppIcon } from "@/components/Icons";

export default function CartPageClient(){
 const {items,subtotal,bundleSaving,updateQuantity,removeItem,totalItems}=useCart();
 if(!items.length)return <div className="mock-empty-cart"><span>🛒</span><h2>Your cart is empty</h2><p>Your next useful find is waiting.</p><Link href="/shop" className="mock-btn-dark">Start shopping</Link></div>;
 return <>
  <div className="mock-cart-progress"><span className="active"><b>1</b>Cart</span><i/><span><b>2</b>Details</span><i/><span><b>3</b>Confirmation</span></div>
  {bundleSaving>0?<div className="mock-cart-saving"><span>✓</span><div><b>Buy 2, save more applied</b><small>You're saving {money(bundleSaving)} on this order.</small></div></div>:null}
  <div className="mock-cart-layout">
   <section className="mock-cart-items"><div className="mock-cart-items-head"><h2>Your cart <span>({totalItems} items)</span></h2><Link href="/shop">Continue shopping →</Link></div>{items.map((item,index)=>{const line=item.price*item.quantity*item.bundleSize*(item.bundleSize===2?1-(item.bundleDiscountPercent||5)/100:1);return <article className="mock-cart-item" key={`${item.productId}-${item.variantId||"base"}-${item.bundleSize}`}><div className="mock-cart-item-image">{item.image?<Image src={item.image} alt={item.name} fill sizes="120px"/>:null}</div><div className="mock-cart-item-copy"><Link href={`/product/${item.slug}/`}>{item.name}</Link><p>{item.variantLabel||"Standard"}{item.bundleSize===2?" • 2-piece bundle":""}</p><span className="mock-cart-stock">● In stock</span><div className="mock-cart-item-bottom"><div className="mock-cart-qty"><button onClick={()=>updateQuantity(index,item.quantity-1)}><MinusIcon size={13}/></button><span>{item.quantity}</span><button onClick={()=>updateQuantity(index,item.quantity+1)}><PlusIcon size={13}/></button></div><button className="mock-cart-remove" onClick={()=>removeItem(index)}><TrashIcon size={15}/> Remove</button></div></div><strong>{money(line)}</strong></article>})}</section>
   <aside className="mock-cart-summary"><h2>Order summary</h2><div><span>Subtotal</span><b>{money(subtotal+bundleSaving)}</b></div>{bundleSaving>0?<div className="saving"><span>Bundle saving</span><b>-{money(bundleSaving)}</b></div>:null}<div><span>Delivery</span><b className="green">FREE</b></div><hr/><div className="total"><span>Total</span><b>{money(subtotal)}</b></div><small>Taxes included where applicable</small><Link href="/checkout" className="mock-checkout-button">Checkout securely →</Link><a className="mock-cart-whatsapp" href="https://wa.me/923002026711" target="_blank" rel="noreferrer"><WhatsAppIcon size={17}/> Order / ask on WhatsApp</a><ul><li>✓ Cash on Delivery</li><li>✓ Free delivery across Pakistan</li><li>✓ Easy exchange</li></ul></aside>
  </div>
  <div className="mock-cart-note"><span>▣</span><p><b>Forgot something?</b><small>You can keep shopping — your cart is saved for 30 days.</small></p><Link href="/shop">Browse products →</Link></div>
 </>;
}
