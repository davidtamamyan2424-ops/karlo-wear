import "dotenv/config";

function optional(key: string): string | undefined {
  const value = process.env[key];
  return value && value.length > 0 ? value : undefined;
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  nodeEnv: process.env.NODE_ENV ?? "development",
  clientOrigins: (process.env.CLIENT_ORIGIN ?? "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  telegramBotToken: optional("TELEGRAM_BOT_TOKEN"),
  telegramAdminChatId: optional("TELEGRAM_ADMIN_CHAT_ID"),
  adminApiToken: optional("ADMIN_API_TOKEN"),
  get isProduction() {
    return this.nodeEnv === "production";
  },
};
