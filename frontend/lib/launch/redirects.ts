export const launchRedirects: Record<string,string> = {
 '/shop':'/shop-all-products', '/new-in':'/new-arrivals', '/discount':'/deals-and-offers',
 '/deals':'/deals-and-offers', '/faq':'/faqs', '/contact':'/contact-us', '/about':'/about-us',
 '/track-order':'/track-your-order', '/terms':'/terms-and-conditions', '/terms-conditions':'/terms-and-conditions',
 '/refund_returns':'/refund-and-return-policy', '/returns-exchange':'/refund-and-return-policy',
 '/returns':'/refund-and-return-policy', '/shipping-delivery':'/shipping-policy', '/shipping':'/shipping-policy',
};
export function launchRedirect(pathname:string){
 const path=pathname.replace(/\/+$/,'')||'/';
 if(path.startsWith('/product-category/'))return '/category/'+path.slice('/product-category/'.length);
 return launchRedirects[path]||null;
}
