const configuredSiteUrl=process.env.NEXT_PUBLIC_SITE_URL||'https://www.zelvomart.com';
function canonicalSiteOrigin(value:string){try{const url=new URL(value);if(['zelvomart.com','www.zelvomart.com','zelvomart.vercel.app','zelvomart-frontend.vercel.app'].includes(url.hostname))return 'https://www.zelvomart.com';return url.origin}catch{return 'https://www.zelvomart.com'}}
export const SITE_ORIGIN=canonicalSiteOrigin(configuredSiteUrl);
export function storefrontHosts(){const hosts=['zelvomart-frontend.vercel.app','zelvomart.vercel.app','zelvomart.com','www.zelvomart.com'];try{const url=new URL(SITE_ORIGIN);if(url.protocol==='https:'&&url.hostname!=='localhost')hosts.push(url.hostname)}catch{}return [...new Set(hosts)]}
