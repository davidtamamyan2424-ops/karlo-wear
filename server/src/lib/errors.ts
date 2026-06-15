// Доменная ошибка с HTTP-статусом и сообщением на русском языке.
export class AppError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "AppError";
    this.status = status;
  }
}

export function badRequest(message: string): AppError {
  return new AppError(400, message);
}

export function notFound(message: string): AppError {
  return new AppError(404, message);
}

export function conflict(message: string): AppError {
  return new AppError(409, message);
}

export function unauthorized(message: string): AppError {
  return new AppError(401, message);
}
