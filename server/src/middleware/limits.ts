import { rateLimit } from 'express-rate-limit';
const limiter = (limit: number, windowMs: number) => rateLimit({
  windowMs, limit, standardHeaders: 'draft-7', legacyHeaders: false,
  message: { error: 'Слишком много запросов. Попробуйте позже.' },
});
export const apiLimit = limiter(300, 60000);
export const orderLimit = limiter(10, 15 * 60000);
export const receiptLimit = limiter(10, 15 * 60000);
export const loginLimit = limiter(8, 15 * 60000);
export const failedAuthLimit = rateLimit({windowMs:15*60000,limit:20,skipSuccessfulRequests:true,standardHeaders:'draft-7',legacyHeaders:false,message:{error:'Слишком много неудачных попыток входа'}});
