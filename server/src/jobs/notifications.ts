import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { notifyOrder, getOrderById } from '../services/orders.js';
import { notifyNewReceipt } from '../services/telegram.js';
import { resolveUploadPath } from '../lib/uploads.js';
let running=false;
export async function runNotifications() {
  if(running || !env.telegramBotToken || !env.telegramAdminChatId)return;
  running=true;
  try {
    const available={OR:[{lockedAt:null},{lockedAt:{lt:new Date(Date.now()-10*60000)}}]};
    const jobs=await prisma.notificationJob.findMany({where:{...available,runAt:{lte:new Date()},attempts:{lt:8}},take:10,orderBy:{createdAt:'asc'}});
    for(const job of jobs) {
      const claim=await prisma.notificationJob.updateMany({where:{id:job.id,attempts:job.attempts,...available},data:{lockedAt:new Date(),attempts:{increment:1}}});
      if(!claim.count)continue;
      try {
        const order=await getOrderById(job.orderId);
        if(job.type==='NEW_ORDER')await notifyOrder(order);
        else {
          const proof=await prisma.paymentProof.findUniqueOrThrow({where:{id:job.receiptId!}});
          await notifyNewReceipt({orderNumber:order.orderNumber,telegramUser:order.telegramUser,totalAmount:order.totalAmount,absoluteFilePath:resolveUploadPath(proof.fileUrl)});
        }
        await prisma.notificationJob.delete({where:{id:job.id}});
      } catch {
        await prisma.notificationJob.update({where:{id:job.id},data:{lockedAt:null,runAt:new Date(Date.now()+Math.min(3600000,30000*2**job.attempts))}});
        console.warn('[notifications] Отложена повторная доставка',job.id);
      }
    }
  } finally {running=false;}
}
export function startNotifications() {
  const run=()=>void runNotifications().catch(()=>console.error('[notifications] Не удалось обработать очередь'));
  run(); const timer=setInterval(run,30000);timer.unref();
}
