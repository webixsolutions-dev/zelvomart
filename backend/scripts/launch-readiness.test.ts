import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyticsPageUrl } from '../../frontend/lib/google-analytics';
import { checkoutSchema } from '../src/lib/validators';
import { wooStock } from '../src/lib/wordpress-import';
import {assertWorkerDatabase,expiredBacklog} from '../src/lib/launch-jobs';
import {recoveryOfferCode,recoveryOfferExpiry} from '../src/lib/recovery-offer';
import {validateCoupon} from '../src/lib/coupons';
import {launchRedirect,launchRedirects} from '../../frontend/lib/launch/redirects';
import {privateSafeUrl} from '../src/lib/url-privacy';
import {publicSettingKeys} from '../src/lib/public-settings';

test('public settings never expose tracking credentials, worker state or arbitrary keys',()=>{
 assert.deepEqual(publicSettingKeys('tracking.metaCapiToken,tracking.tiktokAccessToken,worker.heartbeat,recovery.templates,store.delivery,store.info,store.delivery'),['store.delivery','store.info']);
 assert.deepEqual(publicSettingKeys('tracking.metaPixelId'),['tracking.metaPixelId']);
 assert.deepEqual(publicSettingKeys(''),[]);
});

test('restore links, coupon tokens and typed searches never enter recording URLs',()=>{
 assert.equal(privateSafeUrl('https://zelvomart.com/cart?restore=secret&coupon=RCV-secret&q=private@example.com&utm_source=fb'),'https://zelvomart.com/cart?utm_source=fb');
});

test('legacy storefront URLs have one destination without redirect chains',()=>{
 for(const [source,target]of Object.entries(launchRedirects)){assert.equal(launchRedirect(source+'/'),target);assert.equal(launchRedirect(target),null);}
 // WordPress category URLs are the final URLs (decision of 21 Oct 2026); the design's /category/ links move to them.
 assert.equal(launchRedirect('/product-category/original-wp-slug/'),null);
 assert.equal(launchRedirect('/category/original-wp-slug/'),'/product-category/original-wp-slug');
 assert.equal(launchRedirect('/category/home-and-living/'),'/product-category/home-living');
 assert.equal(launchRedirect('/product/original-wp-slug/'),null);
});

test('recovery offers expire at 24 hours or the earlier parent expiry, with stable codes',async()=>{
 const now=new Date('2026-10-20T05:00:00Z');
 assert.equal(recoveryOfferExpiry(now,null).toISOString(),'2026-10-21T05:00:00.000Z');
 assert.equal(recoveryOfferExpiry(now,new Date('2026-10-20T10:00:00Z')).toISOString(),'2026-10-20T10:00:00.000Z');
 assert.equal(recoveryOfferCode('a'.repeat(64)),recoveryOfferCode('a'.repeat(64)));
 assert.notEqual(recoveryOfferCode('a'.repeat(64)),recoveryOfferCode('b'.repeat(64)));
 await assert.rejects(()=>validateCoupon('RCV-EXAMPLE',100,{coupon:{findUnique:async()=>({code:'RCV-EXAMPLE',usedCount:1})}} as any),/already been used/);
});

test('worker rejects transaction pooler and expires only jobs older than seven days', () => {
  assert.throws(()=>assertWorkerDatabase('postgresql://user:pass@host:6543/db'), /transaction/);
  assert.doesNotThrow(()=>assertWorkerDatabase('postgresql://user:pass@host:5432/db'));
  const now=Date.now();
  assert.equal(expiredBacklog(new Date(now-7*86400000),now),false);
  assert.equal(expiredBacklog(new Date(now-7*86400000-1),now),true);
});

test('WooCommerce stock retains tracking and sold-out state without invented inventory', () => {
  assert.deepEqual(wooStock({manage_stock:true,stock_quantity:3,stock_status:'instock'}), {trackStock:true,stock:3,stockStatus:'instock'});
  assert.deepEqual(wooStock({manage_stock:false,stock_status:'outofstock'}), {trackStock:false,stock:0,stockStatus:'outofstock'});
  assert.throws(() => wooStock({manage_stock:'parent'}, {manage_stock:true,stock_quantity:5}), /shared-stock/);
  assert.throws(() => wooStock({manage_stock:false}, {manage_stock:true,stock_quantity:5}), /shared-stock/);
});

test('Google Analytics excludes account/admin and strips private URLs', () => {
  assert.equal(analyticsPageUrl('https://zelvomart.com/admin/orders'), null);
  assert.equal(analyticsPageUrl('https://zelvomart.com/account/orders/123'), null);
  assert.equal(analyticsPageUrl('https://zelvomart.com/product/cup?email=private&token=secret#address'), 'https://zelvomart.com/product/cup');
  assert.equal(analyticsPageUrl('https://zelvomart.com/checkout/success/ORDER123?key=private'), 'https://zelvomart.com/order-confirmed');
});

test('checkout without terms is accepted while malformed customer data is rejected', () => {
  const input = { idempotencyKey: '12345554-99d3-409f-bb15-de0e90deca76', fullName: 'Customer', phone: '03001234567', city: 'Lahore', address: 'Address street 123', cart: [{ productId: 'product', quantity: 1 }] };
  assert.ok(checkoutSchema.safeParse(input).success);
  assert.ok(checkoutSchema.safeParse({ ...input, terms: false }).success);
  assert.equal(checkoutSchema.safeParse({ ...input, phone: 'invalid' }).success, false);
});
