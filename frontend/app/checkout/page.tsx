import CheckoutClient from '@/components/CheckoutClient';
import { apiFetch } from '@/lib/api';
import { getSetting } from '@/lib/settings';
export const revalidate=3600; export const metadata={title:'Checkout'};
export default async function CheckoutPage(){
 const [cities,required,delivery]=await Promise.all([
   apiFetch<Array<{name:string;deliveryMinDays:number;deliveryMaxDays:number}>>('/api/cities', { next: { revalidate: 3600, tags: ['cities'] } }).catch(()=>[]),
   getSetting<Record<string,boolean>>('checkout.requiredFields',{fullName:true,phone:true,email:true,city:true,address:true,postcode:true,terms:true}),
   getSetting<any>('store.delivery',{mode:'FREE',flatRate:0,freeAbove:0,codFee:0}),
 ]);
 return <div className="site-shell"><div className="page-head"><h1>Checkout</h1><p>Guest checkout • Cash on Delivery</p></div><CheckoutClient cities={cities} required={required} delivery={delivery}/></div>;
}
