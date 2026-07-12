import { useCallback, useEffect, useState } from "react";
import { ru } from "../../i18n/ru";
import { formatPrice, formatPhone } from "../../lib/format";
import {
  DELIVERY_METHOD_LABELS,
  LEGACY_DELIVERY_METHOD_LABELS,
  ORDER_STATUS_BADGE,
  ORDER_STATUS_LABELS,
  type DeliveryMethod,
  type OrderStatus,
} from "../../constants";
import type { Order } from "../../types";
import type { OrderStats } from "../../types/crm";
import type { PeriodState } from "../../lib/period";
import {
  adminFetchOrderStats,
  adminFetchOrders,
  adminSetOrderStatus,
  type OrderListFilter,
} from "../../api/endpoints";
import { fileUrl } from "../../api/client";
import { openLink } from "../../telegram/webapp";
import DateRangeSelector from "../../components/admin/DateRangeSelector";

const STATUS_FILTERS: OrderStatus[] = [
  "NEW",
  "AWAITING_PAYMENT",
  "PAYMENT_REVIEW",
  "PAID",
  "IN_PRODUCTION",
  "SHIPPED",
  "COMPLETED",
  "CANCELLED",
];

type StatCardKey = "total" | "awaiting" | "paid" | "shipped" | "cancelled";

function nextActions(status: OrderStatus): { label: string; target: OrderStatus }[] {
  switch (status) {
    case "PAYMENT_REVIEW":
      return [
        { label: ru.admin.actions.confirmPayment, target: "PAID" },
        { label: ru.admin.actions.rejectPayment, target: "AWAITING_PAYMENT" },
        { label: ru.admin.actions.cancelled, target: "CANCELLED" },
      ];
    case "PAID":
      return [
        { label: ru.admin.actions.inProduction, target: "IN_PRODUCTION" },
        { label: ru.admin.actions.cancelled, target: "CANCELLED" },
      ];
    case "IN_PRODUCTION":
      return [
        { label: ru.admin.actions.shipped, target: "SHIPPED" },
        { label: ru.admin.actions.cancelled, target: "CANCELLED" },
      ];
    case "SHIPPED":
      return [{ label: ru.admin.actions.completed, target: "COMPLETED" }];
    case "NEW":
    case "AWAITING_PAYMENT":
      return [{ label: ru.admin.actions.cancelled, target: "CANCELLED" }];
    default:
      return [];
  }
}

function OrderItemLine({ item }: { item: Order["items"][number] }) {
  const t = ru.admin.order;
  return (
    <li className="space-y-0.5">
      <p className="font-medium">{item.productName}</p>
      <p>
        <span className="text-tg-hint">{t.color}: </span>
        {item.variantName || "—"}
      </p>
      <p>
        <span className="text-tg-hint">{t.size}: </span>
        {item.sizeLabel ?? "—"}
      </p>
      <p>
        <span className="text-tg-hint">{t.quantity}: </span>
        {item.quantity} {ru.product.pieces}
      </p>
    </li>
  );
}

interface Props {
  token: string;
  period: PeriodState;
  onPeriodChange: (period: PeriodState) => void;
}

export default function AdminOrders({ token, period, onPeriodChange }: Props) {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [stats, setStats] = useState<OrderStats | null>(null);
  const [filter, setFilter] = useState<OrderStatus | "">("");
  const [statusGroup, setStatusGroup] = useState<OrderListFilter["statusGroup"]>();
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const listFilter: OrderListFilter = {
    period,
    ...(statusGroup ? { statusGroup } : filter ? { status: filter } : {}),
  };

  const load = useCallback(() => {
    setError(null);
    Promise.all([
      adminFetchOrders(token, listFilter),
      adminFetchOrderStats(token, period),
    ])
      .then(([orderList, orderStats]) => {
        setOrders(orderList);
        setStats(orderStats);
      })
      .catch(() => setError(ru.common.error));
  }, [token, period, statusGroup, filter]);

  useEffect(() => {
    load();
  }, [load]);

  const selectStatCard = (key: StatCardKey) => {
    setFilter("");
    if (key === "total") {
      setStatusGroup(undefined);
    } else {
      setStatusGroup(key);
    }
  };

  const changeStatus = async (orderId: string, status: OrderStatus) => {
    setBusyId(orderId);
    try {
      const updated = await adminSetOrderStatus(token, orderId, status);
      setOrders((prev) => prev?.map((o) => (o.id === orderId ? updated : o)) ?? null);
      const orderStats = await adminFetchOrderStats(token, period);
      setStats(orderStats);
    } catch {
      setError(ru.common.error);
    } finally {
      setBusyId(null);
    }
  };

  const statCards: { key: StatCardKey; emoji: string; label: string; value: number }[] = stats
    ? [
        { key: "total", emoji: "🛒", label: ru.admin.orderStats.total, value: stats.total },
        {
          key: "awaiting",
          emoji: "⏳",
          label: ru.admin.orderStats.awaiting,
          value: stats.awaitingPayment,
        },
        { key: "paid", emoji: "💳", label: ru.admin.orderStats.paid, value: stats.paid },
        { key: "shipped", emoji: "📦", label: ru.admin.orderStats.shipped, value: stats.shipped },
        {
          key: "cancelled",
          emoji: "❌",
          label: ru.admin.orderStats.cancelled,
          value: stats.cancelled,
        },
      ]
    : [];

  const activeCard: StatCardKey | null = statusGroup ?? (filter ? null : "total");

  return (
    <div className="space-y-4">
      <DateRangeSelector value={period} onChange={onPeriodChange} />

      {stats && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {statCards.map((card) => (
            <button
              key={card.key}
              type="button"
              onClick={() => selectStatCard(card.key)}
              className={[
                "rounded-xl border p-3 text-left transition",
                activeCard === card.key
                  ? "border-tg-button bg-tg-button/10"
                  : "border-black/10 bg-white hover:border-black/20",
              ].join(" ")}
            >
              <p className="text-lg">{card.emoji}</p>
              <p className="mt-1 text-xs text-tg-hint">{card.label}</p>
              <p className="text-lg font-semibold">{card.value}</p>
            </button>
          ))}
        </div>
      )}

      <div>
        <label className="mb-1 block text-sm font-medium">{ru.admin.filterByStatus}</label>
        <select
          value={filter}
          onChange={(e) => {
            setStatusGroup(undefined);
            setFilter(e.target.value as OrderStatus | "");
          }}
          className="w-full rounded-xl border border-black/15 bg-white px-3 py-2 text-sm"
        >
          <option value="">{ru.admin.allStatuses}</option>
          {STATUS_FILTERS.map((s) => (
            <option key={s} value={s}>
              {ORDER_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {!orders && <p className="text-sm text-tg-hint">{ru.admin.loading}</p>}
      {orders && orders.length === 0 && (
        <p className="text-sm text-tg-hint">{ru.admin.empty}</p>
      )}

      <ul className="space-y-3">
        {orders?.map((order) => (
          <li key={order.id} className="rounded-2xl border border-black/10 bg-white p-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold">№{order.orderNumber}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${ORDER_STATUS_BADGE[order.status]}`}
              >
                {ORDER_STATUS_LABELS[order.status]}
              </span>
            </div>

            <div className="mt-2 space-y-0.5 text-sm">
              <p>
                <span className="text-tg-hint">{ru.admin.order.customer}: </span>
                {order.customerName}
              </p>
              <p>
                <span className="text-tg-hint">{ru.admin.order.phone}: </span>
                {formatPhone(order.phone)}
              </p>
              <p>
                <span className="text-tg-hint">{ru.admin.order.telegram}: </span>
                {order.telegramUser ? `@${order.telegramUser}` : "—"}
              </p>
              <p>
                <span className="text-tg-hint">{ru.admin.order.city}: </span>
                {order.city || "—"}
              </p>
              {order.comment && (
                <p>
                  <span className="text-tg-hint">{ru.admin.order.comment}: </span>
                  {order.comment}
                </p>
              )}
              <p>
                <span className="text-tg-hint">{ru.admin.order.bank}: </span>
                {order.assignedBankName ?? "—"}
              </p>
              <p>
                <span className="text-tg-hint">{ru.admin.order.total}: </span>
                <span className="font-semibold">{formatPrice(order.totalAmount)}</span>
              </p>
            </div>

            <div className="mt-2 border-t border-black/10 pt-2 text-sm">
              <p>
                <span className="text-tg-hint">{ru.admin.order.deliveryMethod}: </span>
                {order.deliveryMethod
                  ? (DELIVERY_METHOD_LABELS[order.deliveryMethod as DeliveryMethod] ??
                     LEGACY_DELIVERY_METHOD_LABELS[order.deliveryMethod] ??
                     order.deliveryMethod)
                  : "—"}
              </p>
              {order.deliveryAddress && (
                <p>
                  <span className="text-tg-hint">{ru.admin.order.deliveryAddress}: </span>
                  {order.deliveryAddress}
                </p>
              )}
              {order.deliveryComment && (
                <p>
                  <span className="text-tg-hint">{ru.admin.order.deliveryComment}: </span>
                  {order.deliveryComment}
                </p>
              )}
            </div>

            <div className="mt-2 border-t border-black/10 pt-2 text-sm">
              <p className="mb-2 text-tg-hint">{ru.admin.order.items}:</p>
              <ul className="space-y-2">
                {order.items.map((item) => (
                  <OrderItemLine key={item.id} item={item} />
                ))}
              </ul>
            </div>

            <div className="mt-2 border-t border-black/10 pt-2 text-sm">
              {order.paymentProofs.length > 0 ? (
                <button
                  type="button"
                  onClick={() => openLink(fileUrl(order.paymentProofs[0].fileUrl))}
                  className="press inline-flex items-center gap-1.5 font-medium text-tg-link underline"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  </svg>
                  {ru.admin.viewReceipt}
                </button>
              ) : (
                <span className="text-tg-hint">{ru.admin.noReceipt}</span>
              )}
            </div>

            {nextActions(order.status).length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {nextActions(order.status).map((action) => (
                  <button
                    key={action.target}
                    type="button"
                    disabled={busyId === order.id}
                    onClick={() => changeStatus(order.id, action.target)}
                    className="rounded-lg bg-tg-button px-3 py-1.5 text-xs font-medium text-tg-buttonText disabled:opacity-50"
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
