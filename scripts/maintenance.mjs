import { config } from 'dotenv';
import { readdir, stat, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
config({path:new URL('../server/.env',import.meta.url)});
const { prisma } = await import('../server/dist/lib/prisma.js');
try {
  await prisma.adminSession.deleteMany({where:{expiresAt:{lt:new Date()}}});
  // Retain two weeks of this application's scheduled backups only.
  const directory='/var/backups/karlo-wear';
  const cutoff=Date.now()-14*24*60*60*1000;
  for(const name of await readdir(directory)) {
    if(!/^(karlo-[\dT.Z-]+\.dump|media-\d{8}\.tar\.gz)$/.test(name)) continue;
    const file=resolve(directory,name), info=await stat(file);
    if(info.isFile() && info.mtimeMs<cutoff) await unlink(file);
  }
} finally {await prisma.$disconnect();}
