import { readFile } from "node:fs/promises";
import path from "node:path";
import { env } from "../config/env.js";
import { formatRub } from "../lib/money.js";
import { resolveUploadPath } from "../lib/uploads.js";
import {
  DELIVERY_METHOD_LABELS,
  LEGACY_DELIVERY_METHOD_LABELS,
  ORDER_STATUS_LABELS,
  type DeliveryMethod,
  type OrderStatus,
} from "../constants.js";

const API_BASE = "https://api.telegram.org";

function botConfigured(): boolean {
  if (!env.telegramBotToken || !env.telegramAdminChatId) {
    console.warn(
      "[telegram] TELEGRAM_BOT_TOKEN или TELEGRAM_ADMIN_CHAT_ID не заданы — уведомления отключены.",
    );
    return false;
  }
  return true;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function sendMessage(text: string): Promise<void> {
  if (!botConfigured()) return;
  try {
    const res = await fetch(`${API_BASE}/bot${env.telegramBotToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: env.telegramAdminChatId,
        text,
        parse_mode: "HTML",
      }),
    });
    if (!res.ok) {
      console.error("[telegram] sendMessage failed:", res.status, await res.text());
    }
  } catch (error) {
    console.error("[telegram] sendMessage error:", error);
  }
}

async function sendDocument(absoluteFilePath: string, caption: string): Promise<void> {
  if (!botConfigured()) return;
  try {
    const fileBuffer = await readFile(absoluteFilePath);
    const fileName = path.basename(absoluteFilePath);

    const form = new FormData();
    form.append("chat_id", String(env.telegramAdminChatId));
    form.append("caption", caption);
    form.append("parse_mode", "HTML");
    form.append("document", new Blob([fileBuffer]), fileName);

    const res = await fetch(`${API_BASE}/bot${env.telegramBotToken}/sendDocument`, {
      method: "POST",
      body: form,
    });
    if (!res.ok) {
      console.error("[telegram] sendDocument failed:", res.status, await res.text());
    }
  } catch (error) {
    console.error("[telegram] sendDocument error:", error);
  }
}

function isRemoteUrl(url: string): boolean {
  return url.startsWith("http://") || url.startsWith("https://");
}

/** Отправляет фото товара с подписью (URL или локальный файл из /uploads). */
async function sendPhoto(imageUrl: string, caption: string): Promise<void> {
  if (!botConfigured()) return;
  try {
    if (isRemoteUrl(imageUrl)) {
      const res = await fetch(`${API_BASE}/bot${env.telegramBotToken}/sendPhoto`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: env.telegramAdminChatId,
          photo: imageUrl,
          caption,
          parse_mode: "HTML",
        }),
      });
      if (!res.ok) {
        console.error("[telegram] sendPhoto failed:", res.status, await res.text());
      }
      return;
    }

    const absolutePath = resolveUploadPath(imageUrl);
    const fileBuffer = await readFile(absolutePath);
    const fileName = path.basename(absolutePath);

    const form = new FormData();
    form.append("chat_id", String(env.telegramAdminChatId));
    form.append("caption", caption);
    form.append("parse_mode", "HTML");
    form.append("photo", new Blob([fileBuffer]), fileName);

    const res = await fetch(`${API_BASE}/bot${env.telegramBotToken}/sendPhoto`, {
      method: "POST",
      body: form,
    });
    if (!res.ok) {
      console.error("[telegram] sendPhoto failed:", res.status, await res.text());
    }
  } catch (error) {
    console.error("[telegram] sendPhoto error:", error);
  }
}

function itemCaption(item: OrderNotificationItem): string {
  return [
    `<b>${escapeHtml(item.productName)}</b>`,
    `Размер: ${escapeHtml(item.sizeLabel ?? "—")}`,
    `Количество: ${item.quantity} шт.`,
  ].join("\n");
}

export interface OrderNotificationItem {
  productName: string;
  sizeLabel: string | null;
  quantity: number;
  imageUrl: string | null;
}

export interface OrderNotificationData {
  orderNumber: number;
  customerName: string;
  phone: string;
  telegramUser: string | null;
  items: OrderNotificationItem[];
  totalAmount: number;
  assignedBankName: string | null;
  status: string;
  deliveryMethod: string | null;
  deliveryAddress: string | null;
  deliveryComment: string | null;
}

/** Уведомление администратору о новом заказе. */
export async function notifyNewOrder(data: OrderNotificationData): Promise<void> {
  const statusLabel =
    ORDER_STATUS_LABELS[data.status as OrderStatus] ?? data.status;

  const itemsText = data.items
    .map(
      (item) =>
        `• ${escapeHtml(item.productName)} — Размер: ${escapeHtml(
          item.sizeLabel ?? "—",
        )} — Количество: ${item.quantity} шт.`,
    )
    .join("\n");

  const deliveryLabel = data.deliveryMethod
    ? (DELIVERY_METHOD_LABELS[data.deliveryMethod as DeliveryMethod] ??
      LEGACY_DELIVERY_METHOD_LABELS[data.deliveryMethod] ??
      data.deliveryMethod)
    : "—";

  const lines = [
    "<b>🛒 Новый заказ</b>",
    "",
    `<b>Номер заказа:</b> №${data.orderNumber}`,
    `<b>Имя клиента:</b> ${escapeHtml(data.customerName)}`,
    `<b>Телефон:</b> ${escapeHtml(data.phone)}`,
    `<b>Telegram:</b> ${data.telegramUser ? "@" + escapeHtml(data.telegramUser) : "—"}`,
    "",
    "<b>Товары:</b>",
    itemsText,
    "",
    `<b>Сумма заказа:</b> ${formatRub(data.totalAmount)}`,
    "",
    `<b>Способ доставки:</b> ${escapeHtml(deliveryLabel)}`,
  ];

  if (data.deliveryAddress) {
    lines.push("<b>Адрес:</b>", escapeHtml(data.deliveryAddress));
  }
  if (data.deliveryComment) {
    lines.push(`<b>Комментарий по доставке:</b> ${escapeHtml(data.deliveryComment)}`);
  }

  lines.push(
    "",
    `<b>Назначенный банк:</b> ${escapeHtml(data.assignedBankName ?? "—")}`,
    `<b>Статус заказа:</b> ${escapeHtml(statusLabel)}`,
  );

  await sendMessage(lines.join("\n"));

  // Фото каждого товара — чтобы администратор сразу узнал заказ.
  for (const item of data.items) {
    if (item.imageUrl) {
      await sendPhoto(item.imageUrl, itemCaption(item));
    }
  }
}

export interface ReceiptNotificationData {
  orderNumber: number;
  telegramUser: string | null;
  totalAmount: number;
  absoluteFilePath: string;
}

/** Уведомление администратору о загруженном чеке. */
export async function notifyNewReceipt(data: ReceiptNotificationData): Promise<void> {
  const caption = [
    "<b>🧾 Новый чек по заказу</b>",
    "",
    `<b>Номер заказа:</b> №${data.orderNumber}`,
    `<b>Telegram:</b> ${data.telegramUser ? "@" + escapeHtml(data.telegramUser) : "—"}`,
    `<b>Сумма заказа:</b> ${formatRub(data.totalAmount)}`,
  ].join("\n");

  await sendDocument(data.absoluteFilePath, caption);
}
