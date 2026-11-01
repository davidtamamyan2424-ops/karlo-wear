import { readdir, stat, statfs } from 'node:fs/promises';
import path from 'node:path';
import type { RequestHandler } from 'express';
import { RECEIPTS_DIR } from '../lib/uploads.js';
const fileBudget = 20 * 1024 * 1024;
const quota = Number(process.env.RECEIPT_STORAGE_MAX_BYTES ?? 2 * 1024 ** 3);
let used = 0;
let reserved = 0;
let initial: Promise<void> | undefined;
export const receiptQuota: RequestHandler = (req, res, next) => {
  initial ??= readdir(RECEIPTS_DIR).then(async names => {
    const sizes = await Promise.all(names.map(name => stat(path.join(RECEIPTS_DIR,name)).then(s=>s.isFile()?s.size:0)));
    used = sizes.reduce((sum,size)=>sum+size,0);
  }).catch(error => { initial=undefined; throw error; });
  void initial.then(async () => {
    const disk = await statfs(RECEIPTS_DIR);
    if (used + reserved + fileBudget > quota || disk.bavail * disk.bsize < reserved + fileBudget + 100 * 1024 ** 2) {
      res.status(503).json({error:'Загрузка чеков временно недоступна. Свяжитесь с поддержкой.'}); return;
    }
    reserved += fileBudget;
    let released=false;
    const release = () => {
      if(released)return; released=true; reserved-=fileBudget;
      if(res.statusCode===201 && req.file)used+=req.file.size;
    };
    res.once('finish',release); res.once('close',release);
    next();
  }).catch(next);
};
