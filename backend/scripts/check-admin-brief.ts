import 'dotenv/config';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {prisma} from '../src/lib/db';
import {signAdminToken} from '../src/lib/auth';
import {createOrder} from '../src/lib/order';
async function main(){
 process.env.VERCEL='1';const {app}=await import('../src/server');const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));const address=server.address() as {port:number},base=`http://127.0.0.1:${address.port}`;
 const owner=await prisma.user.findFirstOrThrow({where:{role:'OWNER'},select:{id:true,name:true,email:true,role:true}}),token=signAdminToken(owner),key=randomUUID(),sku='QA-'+key,phone='+923'+String(Date.now()).slice(-9);let productId='',orderId='',customerId='',cartId='',couponId='';
 async function api(path:string,method='GET',body?:unknown,status=200){const response=await fetch(base+path,{method,headers:{'content-type':'application/json',authorization:`Bearer ${token}`},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(45000)});const data=await response.json();assert.equal(response.status,status,`${path}: ${JSON.stringify(data)}`);return data;}
 try{
  const product=await prisma.product.create({data:{title:'QA admin brief fixture',slug:sku.toLowerCase(),sku,price:1000,status:'PUBLISHED',trackStock:true,stock:10}});productId=product.id;
  const c=await api('/api/admin/coupons','POST',{code:sku.slice(0,35),type:'PERCENT',amount:15,active:true},201);couponId=c.id;
  const quote=await api('/api/checkout/coupon','POST',{code:c.code.toLowerCase(),cart:[{productId,quantity:2}]});assert.equal(quote.discount,300);
  const order=await createOrder({idempotencyKey:key,fullName:'QA Brief',phone,city:'QA unlisted city',address:'QA test address only',terms:true,paymentMethod:'COD',cart:[{productId,quantity:2,bundleSize:1}],couponCode:c.code,trackingAllowed:false},{dispatchJobs:false});orderId=order.id;customerId=order.customerId!;assert.equal(Number(order.couponDiscount),300);assert.equal(Number(order.codFee),0);assert.equal(order.email,null);assert.equal(order.postcode,null);
  const before=await api('/api/admin/orders/'+order.id);assert.match(before.deliveryEstimate,/2–7/);
  await api('/api/admin/orders/'+order.id,'PATCH',{fullName:'QA Brief Edited',phone,city:'QA unlisted city',address:'QA revised address only',email:'',updatedAt:before.updatedAt,items:[{id:before.items[0].id,quantity:3}]});
  assert.equal((await prisma.product.findUniqueOrThrow({where:{id:productId}})).stock,7);
  const edited=await api('/api/admin/orders/'+orderId);assert.equal(Number(edited.couponDiscount),450);assert.ok(edited.statusHistory.some((h:any)=>h.note?.includes('Items and totals')));
  await api('/api/admin/orders/'+orderId+'/notes','POST',{body:'QA private note'},201);assert.equal((await api('/api/admin/orders/'+orderId)).privateNotes.length,1);
  await api('/api/admin/orders/'+orderId,'PATCH',{fullName:'QA Brief Edited',phone,city:'QA unlisted city',address:'QA revised address only',items:[{id:edited.items[0].id,quantity:100}]},409);assert.equal((await prisma.product.findUniqueOrThrow({where:{id:productId}})).stock,7);
  for(const panel of ['kpis','sales','funnel','sources','products','recovery','health','tips','ads']){await api('/api/admin/overview/'+panel+'?from=2026-10-01&to=2026-10-18');console.log('PASS overview '+panel);}
  await api('/api/admin/orders?repeat=true&page=1');await api('/api/admin/orders?hasReplay=true&page=1');await api('/api/admin/cities','PUT',{cities:[{name:'QA must not save',deliveryMinDays:null,deliveryMaxDays:5}]},400);
  const cart=await prisma.abandonedCheckout.create({data:{email:`${key}@example.invalid`,phone:null,cart:[{productId,quantity:1,bundleSize:1}],restoreToken:key.replaceAll('-','').repeat(2),updatedAt:new Date(Date.now()-7200000)}});cartId=cart.id;
  await api('/api/admin/abandoned/'+cartId+'/contacted','POST',{});const contacted=await prisma.abandonedCheckout.findUniqueOrThrow({where:{id:cartId}});assert.ok(contacted.followedUpAt);await prisma.abandonedCheckout.update({where:{id:cartId},data:{convertedAt:new Date()}});await api('/api/admin/abandoned/'+cartId+'/message','POST',{},400);
  await api('/api/admin/orders/'+orderId+'/status','PATCH',{status:'CANCELLED'});assert.equal((await prisma.product.findUniqueOrThrow({where:{id:productId}})).stock,10);await api('/api/admin/orders/'+orderId+'/status','PATCH',{status:'NEW'});assert.equal((await prisma.product.findUniqueOrThrow({where:{id:productId}})).stock,7);
  await api('/api/admin/customers/'+customerId);console.log('PASS coupons, no-email checkout, inventory rollback, order editing/notes, recovery guards, filters and city validation. No email/ad jobs dispatched.');
 }finally{
  if(orderId){await prisma.auditLog.deleteMany({where:{entityId:orderId}});await prisma.job.deleteMany({where:{orderId}});await prisma.order.delete({where:{id:orderId}});}if(cartId)await prisma.abandonedCheckout.deleteMany({where:{id:cartId}});if(customerId)await prisma.customer.deleteMany({where:{id:customerId,phone}});if(productId)await prisma.product.deleteMany({where:{id:productId,sku}});if(couponId){await prisma.auditLog.deleteMany({where:{entityId:couponId}});await prisma.coupon.deleteMany({where:{id:couponId}});}await new Promise<void>(resolve=>server.close(()=>resolve()));await prisma.$disconnect();console.log('PASS isolated QA fixture cleanup');
 }
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
