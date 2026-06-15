# Karlo Wear — Telegram Mini App Clothing Store

A clothing store built as a Telegram Mini App.

- **Client**: React + TypeScript + Vite + Tailwind CSS, with Telegram WebApp integration
- **Server**: Node.js + Express + TypeScript
- **Database**: Prisma ORM + PostgreSQL

## Conventions

- **Язык интерфейса:** весь UI на русском языке (см. `client/src/i18n/ru.ts`). Английский текст пользователю не показывается.
- **Размеры:** только `S, M, L, XL` (см. `SIZES` в `server/src/constants.ts` и `client/src/constants.ts`).
- **Валюта:** российский рубль (₽). Цены хранятся в копейках, форматирование — `client/src/lib/format.ts`.

## Project structure

```
karlo-wear/
├── client/          # React + Vite frontend (Telegram Mini App)
├── server/          # Express API + Prisma + PostgreSQL
├── package.json     # npm workspaces + root scripts
└── README.md
```

## Features

- [x] Product catalog (карточка: цена, артикул, размеры в наличии, остаток по размерам)
- [x] Product page (рост модели, размер на модели, выбор размера)
- [x] Product sizes and stock management (S, M, L, XL)
- [x] Cart (добавление/удаление, количество, подытог и итог, лимит по складу)
- [x] Checkout form (имя, телефон, Telegram username с префиллом, город, комментарий)
- [x] Manual payment workflow (случайный банк, страница оплаты, загрузка чека)
- [x] Order statuses (8 статусов, см. ниже)
- [x] Inventory reservation + авто-отмена неоплаченных заказов через 12 ч
- [x] Telegram order + receipt notifications
- [x] Admin panel (заказы, смена статусов, платёжные реквизиты)

### Order workflow

1. Checkout → заказ создаётся в транзакции, склад резервируется, назначается случайный
   активный банк (фиксируется навсегда), статус **Ожидает оплаты**, срок оплаты 12 ч.
2. Клиент видит реквизиты и загружает чек (JPG/JPEG/PNG/PDF) → статус **Ожидает проверки оплаты**.
3. Админ подтверждает/отклоняет оплату и ведёт заказ по статусам:
   Новый → Ожидает оплаты → Ожидает проверки оплаты → Оплачен → Передан в производство →
   Отправлен → Завершён (или Отменён — с возвратом склада).
4. Неоплаченные заказы старше 12 ч отменяются автоматически (фоновая задача), склад возвращается.

### Telegram bot

Set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_ADMIN_CHAT_ID` in `server/.env` to enable admin
notifications (новый заказ и новый чек с вложением). Без них магазин работает, уведомления отключены.

### Admin panel

Open `/admin` in the Mini App and sign in with `ADMIN_API_TOKEN` (см. `server/.env`).

## Getting started

Install all workspace dependencies from the repo root:

```bash
npm install
```

Set up environment variables:

```bash
# server
cp server/.env.example server/.env

# client
cp client/.env.example client/.env
```

Generate the Prisma client, start PostgreSQL, and apply migrations:

```bash
npm run prisma:generate

# Local PostgreSQL (Docker)
docker compose up -d postgres

# Configure server/.env (see server/.env.example)
cp server/.env.example server/.env

npm run prisma:migrate:deploy
```

> The initial migration (`server/prisma/migrations/20260615170000_init`) targets PostgreSQL.
> For production deploy steps see [server/DEPLOYMENT.md](server/DEPLOYMENT.md).

Seed the database with realistic Russian demo products:

```bash
npm run prisma:seed
```

Run both apps in development:

```bash
npm run dev
```

- Client dev server: http://localhost:5173
- Server API: http://localhost:4000

## Scripts (root)

| Script | Description |
| --- | --- |
| `npm run dev` | Run client + server in parallel |
| `npm run build` | Build server then client |
| `npm run typecheck` | Type-check both workspaces |
| `npm run prisma:generate` | Generate Prisma client |
| `npm run prisma:migrate` | Create/apply migrations in development |
| `npm run prisma:migrate:deploy` | Apply migrations in production/CI |
