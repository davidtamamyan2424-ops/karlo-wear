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
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  let body: BodyInit | undefined;

  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }
  if (options.adminToken) {
    headers["x-admin-token"] = options.adminToken;
  }

  const res = await fetch(`${API_BASE}/api${path}`, {
    method: options.method ?? "GET",
    headers,
    body,
  });

  if (!res.ok) await parseError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** Загрузка файла (multipart/form-data). */
export async function apiUpload<T>(
  path: string,
  formData: FormData,
  options: { adminToken?: string } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.adminToken) headers["x-admin-token"] = options.adminToken;
  const res = await fetch(`${API_BASE}/api${path}`, {
    method: "POST",
    headers,
    body: formData,
  });
  if (!res.ok) await parseError(res);
  return (await res.json()) as T;
}

/** Абсолютный URL к файлу на сервере (например, к чеку). */
export function fileUrl(url: string): string {
  return `${API_BASE}${url}`;
}
