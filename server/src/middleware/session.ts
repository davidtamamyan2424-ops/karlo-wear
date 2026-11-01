import session from 'express-session';
import type { RequestHandler } from 'express';
import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { hashSecret } from '../lib/security.js';

declare module 'express-session' { interface SessionData { adminVersion?: string } }
class DatabaseSessions extends session.Store {
  get(id: string, done: (err?: unknown, session?: session.SessionData | null) => void) {
    void prisma.adminSession.findUnique({ where: { id } }).then(row => {
      if (!row || row.expiresAt < new Date()) return done(null, null);
      done(null, JSON.parse(row.data));
    }).catch(done);
  }
  set(id: string, value: session.SessionData, done: (err?: unknown) => void = () => {}) {
    const data = JSON.stringify(value);
    const expiresAt = value.cookie.expires ? new Date(value.cookie.expires) : new Date(Date.now() + 8 * 3600000);
    void prisma.adminSession.upsert({ where: { id }, create: { id, data, expiresAt }, update: { data, expiresAt } }).then(() => done()).catch(done);
  }
  destroy(id: string, done: (err?: unknown) => void = () => {}) {
    void prisma.adminSession.deleteMany({ where: { id } }).then(() => done()).catch(done);
  }
}
export const adminVersion = () => hashSecret(env.adminApiToken ?? 'disabled');
export const sessions = session({
  name: 'karlo.admin', secret: env.sessionSecret ?? hashSecret('karlo-session:' + (env.adminApiToken ?? 'development-only')),
  store: new DatabaseSessions(), resave: false, saveUninitialized: false,
  cookie: { httpOnly: true, secure: env.isProduction, sameSite: 'strict', maxAge: 8 * 3600000 },
});
// Browser mutations require same-origin context. CLI bearer tokens are intentionally supported.
export const protectOrigin: RequestHandler = (req, res, next) => {
  if (['GET','HEAD','OPTIONS'].includes(req.method)) return next();
  const origin = req.get('origin');
  const expected = new URL(req.protocol + '://' + req.get('host')).origin;
  if ((origin && origin !== expected && !env.clientOrigins.includes(origin)) || req.get('sec-fetch-site') === 'cross-site') {
    res.status(403).json({ error: 'Запрос с другого сайта запрещён' }); return;
  }
  next();
};
