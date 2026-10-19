const PUBLIC_SETTINGS=new Set([
 'store.info','store.delivery','store.productTabs','store.bundleDefaultDiscountPercent',
 'tracking.metaPixelEnabled','tracking.metaPixelId','tracking.tiktokPixelEnabled',
 'tracking.tiktokPixelId','tracking.sessionReplayEnabled','homepage.config',
]);
export function publicSettingKeys(value:unknown){
 return [...new Set(String(value||'').split(',').map(key=>key.trim()).filter(key=>PUBLIC_SETTINGS.has(key)))].slice(0,20);
}
