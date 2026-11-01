import EmbeddedPostgres from 'embedded-postgres';
import { resolve, dirname, delimiter } from 'node:path';
import { mkdir, readdir, unlink } from 'node:fs/promises';
import { spawn, spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { once } from 'node:events';
const clusterDir = resolve('.test-data', 'postgres-' + Date.now());
assert.ok(clusterDir.startsWith(resolve('.test-data') + '\\') || clusterDir.startsWith(resolve('.test-data') + '/'));
await mkdir(clusterDir, {recursive:true});
const pg = new EmbeddedPostgres({databaseDir:clusterDir,user:'testuser',password:'local-test-only',port:55439,persistent:true,
  initdbFlags:['--locale=C','--encoding=UTF8'], postgresFlags:['-c','lc_messages=C']});
let server, prisma;
const testFiles=[];
const run = (args) => new Promise((resolve,reject) => {
  const p=spawn(process.execPath,args,{env:process.env,windowsHide:true,stdio:'inherit'});
  p.on('error',reject); p.on('exit',code=>code===0?resolve():reject(new Error('Command failed: '+code)));
});
try {
  await pg.initialise(); await pg.start(); await pg.createDatabase('karlo_security_test');
  process.env.DATABASE_URL='postgresql://testuser:local-test-only@127.0.0.1:55439/karlo_security_test?schema=public';
  process.env.ADMIN_API_TOKEN='test-admin-' + randomBytes(32).toString('hex');
  process.env.NODE_ENV='test'; process.env.TELEGRAM_BOT_TOKEN=''; process.env.TELEGRAM_ADMIN_CHAT_ID='';
  await run(['node_modules/prisma/build/index.js','migrate','deploy','--schema','server/prisma/schema.prisma']);
  ({prisma}=await import('./src/lib/prisma.ts'));
  const {createApp}=await import('./src/app.ts');
  const {createProduct,updateProduct}=await import('./src/services/adminProducts.ts');
  const {setOrderStatus,confirmRefund}=await import('./src/services/orders.ts');
  const {computePeriodMetrics}=await import('./src/services/adminFinance.ts');
  const {getFinanceHistory}=await import('./src/services/adminFinanceHistory.ts');
  const {UPLOADS_DIR,RECEIPTS_DIR}=await import('./src/lib/uploads.ts');
  const {hashSecret}=await import('./src/lib/security.ts');
  await prisma.paymentAccount.create({data:{bankName:'Test bank',recipientName:'Test recipient',phoneNumber:'+79990000000'}});
  const product=await createProduct({name:'Integration hoodie',price:650000,category:'HOODIE',unitCost:250000,variants:[{name:'Black',sku:'TEST-HOODIE',sizes:[{label:'S',stock:1},{label:'M',stock:10}]}]});
  const variant=product.variants[0];
  server=createApp().listen(0,'127.0.0.1'); await once(server,'listening');
  const base=`http://127.0.0.1:${server.address().port}`;
  const payload=(size='M',phone='+79991234567')=>({customerName:'Test',phone,telegramUser:'testbuyer',deliveryMethod:'PICKUP',deliveryConfirmed:true,
    accessToken:randomBytes(32).toString('hex'),idempotencyKey:randomUUID(),legalConsent:true,legalConsentVersion:'2026-10-22',expectedTotal:650000,
    items:[{productId:product.id,variantId:variant.id,sizeLabel:size,quantity:1}]});
  const post=(path,body,headers={})=>fetch(base+'/api'+path,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
  const a=payload();
  const response=await post('/orders',a); assert.equal(response.status,201,await response.clone().text());
  const order=await response.json();
  assert.equal(order.assignedPhoneNumber,'+79990000000');
  assert.equal('phone' in order,false); assert.equal('accessTokenHash' in order,false); assert.equal('unitCostSnapshot' in order.items[0],false);
  const item=await prisma.orderItem.findFirstOrThrow({where:{orderId:order.id}});assert.equal(item.unitCostSnapshot,250000);
  assert.equal((await prisma.productVariantSize.findFirstOrThrow({where:{variantId:variant.id,label:'M'}})).stock,9);
  const retries=await Promise.all([post('/orders',a),post('/orders',a)]);
  for(const r of retries){assert.equal(r.status,201,await r.clone().text());assert.equal((await r.json()).id,order.id);}
  assert.equal(await prisma.order.count(),1);console.log('PASS: checkout, private DTO, pricing, stock snapshot and concurrent idempotency');
  const recovery=await post('/orders/recover',{idempotencyKey:a.idempotencyKey,accessToken:a.accessToken});
  assert.equal(recovery.status,200);assert.equal((await recovery.json()).id,order.id);
  const deniedRecovery=await post('/orders/recover',{idempotencyKey:a.idempotencyKey,accessToken:randomBytes(32).toString('hex')});
  assert.equal(deniedRecovery.status,401);
  assert.equal(await prisma.notificationJob.count({where:{type:'NEW_ORDER'}}),1);
  const two=await Promise.all([post('/orders',payload('S','+79991234568')),post('/orders',payload('S','+79991234569'))]);
  assert.deepEqual(two.map(r=>r.status).sort(),[201,409]);console.log('PASS: last unit sold once under concurrent checkout');
  assert.equal((await fetch(base+'/api/orders/'+order.id)).status,401);
  assert.equal((await fetch(base+'/api/orders/'+order.id,{headers:{'x-order-token':a.accessToken}})).status,200);
  const diskBefore=await readdir(RECEIPTS_DIR);
  const f=new FormData();f.append('receipt',new Blob(['not a png'],{type:'image/png'}),'fake.png');
  assert.equal((await fetch(base+'/api/orders/missing/payment-proof',{method:'POST',body:f})).status,401);
  assert.deepEqual(await readdir(RECEIPTS_DIR),diskBefore);
  const forged=new FormData();forged.append('receipt',new Blob(['not a png'],{type:'image/png'}),'fake.png');
  assert.equal((await fetch(base+'/api/orders/'+order.id+'/payment-proof',{method:'POST',headers:{'x-order-token':a.accessToken},body:forged})).status,400);
  assert.deepEqual(await readdir(RECEIPTS_DIR),diskBefore);
  const sharp=(await import('sharp')).default;
  const image=await sharp({create:{width:2,height:2,channels:3,background:'#ffffff'}}).png().toBuffer();
  const real=new FormData();real.append('receipt',new Blob([image],{type:'image/png'}),'proof.png');
  const proofResponse=await fetch(base+'/api/orders/'+order.id+'/payment-proof',{method:'POST',headers:{'x-order-token':a.accessToken},body:real});
  assert.equal(proofResponse.status,201,await proofResponse.clone().text());
  const proof=await prisma.paymentProof.findFirstOrThrow({where:{orderId:order.id}});
  testFiles.push(resolve(RECEIPTS_DIR,proof.fileUrl.split('/').pop()));
  assert.equal((await fetch(base+'/uploads/'+proof.fileUrl.split('/').pop())).status,404);
  assert.equal((await fetch(base+'/api/admin/receipts/'+proof.id)).status,401);
  await setOrderStatus(order.id,'PAID');
  const paid=await prisma.order.findUniqueOrThrow({where:{id:order.id}});assert.ok(paid.paidAt);
  await setOrderStatus(order.id,'IN_PRODUCTION');await setOrderStatus(order.id,'SHIPPED');await setOrderStatus(order.id,'COMPLETED');
  const again=new FormData();again.append('receipt',new Blob([image],{type:'image/png'}),'proof.png');
  assert.equal((await fetch(base+'/api/orders/'+order.id+'/payment-proof',{method:'POST',headers:{'x-order-token':a.accessToken},body:again})).status,409);
  console.log('PASS: order access, no orphan file, signature validation, private receipt and terminal states');
  const sOrder=await prisma.order.findFirstOrThrow({where:{id:{not:order.id}}});
  const before=(await prisma.productVariantSize.findFirstOrThrow({where:{variantId:variant.id,label:'S'}})).stock;
  await Promise.all([setOrderStatus(sOrder.id,'CANCELLED'),setOrderStatus(sOrder.id,'CANCELLED')]);
  assert.equal((await prisma.productVariantSize.findFirstOrThrow({where:{variantId:variant.id,label:'S'}})).stock,before+1);
  await assert.rejects(setOrderStatus(sOrder.id,'PAID'));
  const original=await prisma.product.findUniqueOrThrow({where:{id:product.id}});
  await updateProduct(product.id,{expectedUpdatedAt:original.updatedAt.toISOString(),unitCost:999999});
  const metrics=await computePeriodMetrics();assert.equal(metrics.cogs,250000);
  await assert.rejects(updateProduct(product.id,{expectedUpdatedAt:original.updatedAt.toISOString(),name:'stale'}));
  console.log('PASS: concurrent cancellation restores once, reopening blocked, historical cost immutable, stale edits rejected');
  // Legacy orders without a token fail closed; administrators can issue a fresh customer link.
  await prisma.order.update({where:{id:sOrder.id},data:{accessTokenHash:null}});
  assert.equal((await fetch(base+'/api/orders/'+sOrder.id,{headers:{'x-order-token':a.accessToken}})).status,401);
  const login=await post('/admin/login',{token:process.env.ADMIN_API_TOKEN});assert.equal(login.status,200);
  const cookie=login.headers.get('set-cookie').split(';')[0];
  assert.ok(login.headers.get('set-cookie').includes('HttpOnly'));
  assert.equal((await fetch(base+'/api/admin/session',{headers:{cookie}})).status,200);
  const link=await post('/admin/orders/'+sOrder.id+'/access-link',{}, {cookie});assert.equal(link.status,200);
  const newToken=(await link.json()).path.split('#access=')[1];
  assert.equal((await prisma.order.findUniqueOrThrow({where:{id:sOrder.id}})).accessTokenHash,hashSecret(newToken));
  const cross=await post('/admin/orders/'+sOrder.id+'/access-link',{}, {cookie,origin:'https://evil.invalid'});assert.equal(cross.status,403);
  const download=await fetch(base+'/api/admin/receipts/'+proof.id,{headers:{cookie}});assert.equal(download.status,200);
  await post('/admin/logout',{}, {cookie});assert.equal((await fetch(base+'/api/admin/session',{headers:{cookie}})).status,401);
  console.log('PASS: durable admin session, CSRF origin check, private download, access recovery and logout');
  const history=await getFinanceHistory({period:{}});assert.equal(history.items.some(x=>x.source==='REFUND'),false);
  // Explicit refund retains the original payment in history.
  await prisma.order.update({where:{id:sOrder.id},data:{paidAt:new Date(),totalAmount:650000}});
  await confirmRefund(sOrder.id);await confirmRefund(sOrder.id);
  const refunded=await getFinanceHistory({period:{}});
  assert.equal(refunded.items.filter(x=>x.source==='REFUND').length,1);
  console.log('PASS: refunds require explicit confirmation and are idempotent');
  // Backup verification includes restoring into a second disposable database.
  if(process.platform==='win32') {
    const binary=await import('@embedded-postgres/windows-x64');
    process.env.PATH=dirname(binary.pg_ctl)+delimiter+process.env.PATH;
  }
  const dump=resolve('.test-data','integration-'+Date.now()+'.dump');
  const backupToolsAvailable=['pg_dump','pg_restore'].every(tool=>spawnSync(tool,['--version'],{windowsHide:true}).status===0);
  if(backupToolsAvailable) {
  await run(['scripts/backup-db.mjs',dump]);
  await pg.createDatabase('karlo_restore_test');
  const restored=spawnSync('pg_restore',['--host','127.0.0.1','--port','55439','--username','testuser','--dbname','karlo_restore_test','--no-owner',dump],{env:{...process.env,PGPASSWORD:'local-test-only'},stdio:'inherit',windowsHide:true});
  assert.equal(restored.status,0);
  const restoreClient=pg.getPgClient('karlo_restore_test');await restoreClient.connect();
  assert.equal(Number((await restoreClient.query('SELECT COUNT(*) AS n FROM "Order"')).rows[0].n),2);
  await restoreClient.end();console.log('PASS: PostgreSQL backup restored successfully into a separate database');
  } else { console.log('SKIP: backup restore test requires pg_dump and pg_restore; deployment verifies its backup with server tools'); }
  assert.ok((await readdir(UPLOADS_DIR)).every(name=>!name.startsWith('audit-')));
  console.log('ALL INTEGRATION CHECKS PASSED');
} finally {
  for(const file of testFiles) await unlink(file).catch(()=>{});
  if(server) await new Promise(resolve=>server.close(resolve));
  if(prisma) await prisma.$disconnect();
  await pg.stop().catch(error=>console.error('Postgres stop:',error.message));
}
