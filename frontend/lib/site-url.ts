export const SITE_ORIGIN=(process.env.NEXT_PUBLIC_SITE_URL||'https://zelvomart.vercel.app').replace(/\/+$/,'');
export function storefrontHosts(){const hosts=['zelvomart.vercel.app','zelvomart.com','www.zelvomart.com'];try{const url=new URL(SITE_ORIGIN);if(url.protocol==='https:'&&url.hostname!=='localhost')hosts.push(url.hostname)}catch{}return [...new Set(hosts)]}
