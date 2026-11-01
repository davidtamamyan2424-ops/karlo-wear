import {test} from 'node:test';
import assert from 'node:assert/strict';
import {serializeProduct} from '../services/products.js';

test('product total includes every color while displayed sizes follow the default color',()=>{
  const product={
    id:'product',sku:'P',name:'Hoodie',price:650000,unitCost:0,
    imageUrl:null,imagesJson:null,sizes:[],
    variants:[
      {id:'black',name:'Black',isDefault:true,price:null,imageUrl:'/black.webp',imagesJson:null,sizes:[{label:'S',stock:2},{label:'M',stock:4}]},
      {id:'white',name:'White',isDefault:false,price:null,imageUrl:'/white.webp',imagesJson:null,sizes:[{label:'S',stock:1},{label:'M',stock:3}]},
    ],
  } as unknown as Parameters<typeof serializeProduct>[0];
  const result=serializeProduct(product);
  assert.equal(result.totalStock,10);
  assert.deepEqual(result.variants.map(v=>v.totalStock),[6,4]);
  assert.deepEqual(result.sizes.map(s=>s.stock),[2,4]);
  assert.equal(result.defaultVariantId,'black');
  assert.deepEqual(result.variants.map(v=>v.images),[['/black.webp'],['/white.webp']]);
});
