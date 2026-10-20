import {getSetting} from '@/lib/settings';
import {resolveDeliveryPolicy} from '@/lib/shipping';
import {launchCategories} from '@/lib/launch/server';
import {site} from '@/lib/launch/site';
export const revalidate=30;
export async function GET(){
 const [policy,categories,info]=await Promise.all([getSetting('store.delivery',null).then(resolveDeliveryPolicy),launchCategories().catch(()=>[]),getSetting<{phone?:string;email?:string}>('store.info',{})]);
 const text=`# Zelvomart

Online shopping in Pakistan with Cash on Delivery. Based in Lahore.
Delivery costs PKR ${policy.flatRate}; free on orders of PKR ${policy.threshold} or more.
City estimates appear at checkout; unlisted cities: 2–7 working days.
WhatsApp: ${info.phone||site.phoneDisplay}. Email: ${info.email||site.email}.

## Shop
- [All products](${site.url}/shop-all-products)
- [New arrivals](${site.url}/new-arrivals)
- [Bestsellers](${site.url}/bestsellers)
- [Deals](${site.url}/deals-and-offers)
${categories.map(c=>`- [${c.name}](${site.url}/category/${c.slug})`).join('\n')}

## Help
- [About](${site.url}/about-us)
- [Delivery](${site.url}/shipping-policy)
- [Returns](${site.url}/refund-and-return-policy)
- [Terms](${site.url}/terms-and-conditions)
- [Privacy](${site.url}/privacy-policy)
`;
 return new Response(text,{headers:{'Content-Type':'text/plain; charset=utf-8'}});
}
