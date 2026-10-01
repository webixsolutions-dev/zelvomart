import { notFound } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { money } from '@/lib/format';
import PurchaseClient from '@/components/PurchaseClient';
export const dynamic='force-dynamic';
export default async function SuccessPage({params}:{params:Promise<{orderNumber:string}>}){
 const {orderNumber}=await params; let order:any; try{order=await apiFetch(`/api/orders/confirmation/${encodeURIComponent(orderNumber)}`);}catch{return notFound();}
 return <div className="site-shell py-16"><PurchaseClient orderNumber={order.orderNumber} total={Number(order.total)} skus={order.items.map((i:any)=>i.sku)} quantities={order.items.map((i:any)=>i.quantity)}/><div className="mx-auto max-w-2xl rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm"><span className="text-xs font-black tracking-widest text-sky-600">ORDER PLACED</span><h1 className="mt-3 text-3xl font-black text-slate-800">Thank you. Your order is confirmed.</h1><p className="mt-3 text-slate-500">Order number <b>{order.orderNumber}</b></p><div className="mt-6 rounded-2xl bg-slate-50 p-5 text-left"><h3 className="font-black text-slate-800">What happens next</h3><p className="mt-2 text-sm leading-6 text-slate-600">We confirm by phone or WhatsApp, then dispatch your parcel. {order.deliveryEstimate?`Estimated delivery to ${order.city}: ${order.deliveryEstimate}.`:'Delivery time depends on your city.'}</p><div className="mt-4 text-sm"><b>Total:</b> {money(order.total)}</div><div className="mt-1 text-sm"><b>Delivery address:</b> {order.address}, {order.city}</div></div><div className="mt-6 flex flex-wrap justify-center gap-3"><Link className="btn-primary" href="/shop">Continue Shopping</Link><Link className="btn-outline" href="/track-order">Track Order</Link></div></div></div>;
}
