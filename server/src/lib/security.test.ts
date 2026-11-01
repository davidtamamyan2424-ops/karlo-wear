import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { hashSecret, secretsEqual, verifyTelegramIdentity } from './security.js';
import { assertTransition, assertReceiptAllowed } from './orderPolicy.js';
import { env } from '../config/env.js';
import { createOrderSchema } from '../validation.js';

test('secret comparisons do not accept missing or different tokens', () => {
  assert.equal(secretsEqual(hashSecret('one'),hashSecret('two')),false);
  assert.equal(secretsEqual('one','one'),true);
});
test('terminal order states cannot be reopened or downgraded',()=>{
  assert.throws(()=>assertTransition('CANCELLED','PAID'));
  assert.throws(()=>assertTransition('COMPLETED','PAYMENT_REVIEW'));
  assertTransition('PAYMENT_REVIEW','PAID');
});
test('receipt requires an awaiting and non-expired order',()=>{
  assert.throws(()=>assertReceiptAllowed({status:'PAID',paymentDueAt:null}));
  assert.throws(()=>assertReceiptAllowed({status:'AWAITING_PAYMENT',paymentDueAt:new Date(0)}));
  assertReceiptAllowed({status:'AWAITING_PAYMENT',paymentDueAt:new Date(Date.now()+60000)});
});
test('checkout requires consent and strong access/idempotency credentials',()=>{
  assert.equal(createOrderSchema.safeParse({}).success,false);
});
test('Telegram signature, age and identity are verified',()=>{
  const before=env.telegramBotToken;
  env.telegramBotToken='12345:test-token';
  try {
    assert.equal(verifyTelegramIdentity(),null);
    const sign=(age:number)=>{
      const params=new URLSearchParams({auth_date:String(Math.floor(Date.now()/1000)-age),user:JSON.stringify({id:123,username:'buyer'})});
      const check=[...params.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${k}=${v}`).join('\n');
      const key=createHmac('sha256','WebAppData').update(env.telegramBotToken!).digest();
      params.set('hash',createHmac('sha256',key).update(check).digest('hex'));
      return params.toString();
    };
    assert.deepEqual(verifyTelegramIdentity(sign(1)),{id:'123',username:'buyer'});
    assert.throws(()=>verifyTelegramIdentity(sign(7200)));
    assert.throws(()=>verifyTelegramIdentity(sign(1).replace('buyer','attacker')));
  } finally {env.telegramBotToken=before;}
});
