const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function parseError(res: Response): Promise<never> {
  let message = "Произошла ошибка";
  try {
    const data = await res.json();
    if (data && typeof data.error === "string") message = data.error;
  } catch {
    // ignore
  }
  throw new ApiError(res.status, message);
}

export interface RequestOptions {
  method?: string;
  body?: unknown;
  adminToken?: string;
  orderToken?: string;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  let body: BodyInit | undefined;

  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }
  if (options.adminToken && options.adminToken !== 'session') {
    headers["x-admin-token"] = options.adminToken;
  }
  if (options.orderToken) headers['x-order-token'] = options.orderToken;

  const res = await fetch(`${API_BASE}/api${path}`, {
    method: options.method ?? "GET",
    headers,
    body,
    credentials: 'include',
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) await parseError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** Загрузка файла (multipart/form-data). */
export async function apiUpload<T>(
  path: string,
  formData: FormData,
  options: { adminToken?: string; orderToken?: string } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.adminToken && options.adminToken !== 'session') headers["x-admin-token"] = options.adminToken;
  if (options.orderToken) headers['x-order-token'] = options.orderToken;
  const res = await fetch(`${API_BASE}/api${path}`, {
    method: "POST",
    headers,
    body: formData,
    credentials: 'include',
    signal: AbortSignal.timeout(120000),
  });
  if (!res.ok) await parseError(res);
  return (await res.json()) as T;
}

/** Абсолютный URL к файлу на сервере (например, к чеку). */
export function fileUrl(url: string): string {
  return `${API_BASE}${url}`;
}

export async function downloadProtectedFile(url: string) {
  const response = await fetch(fileUrl(url), { credentials:'include', signal:AbortSignal.timeout(30000) });
  if (!response.ok) return parseError(response);
  const blob = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = blob; link.download = 'chek'; link.click();
  setTimeout(() => URL.revokeObjectURL(blob), 60000);
}
