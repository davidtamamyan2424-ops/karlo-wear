import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";

interface ToastItem {
  id: number;
  message: string;
  variant: "success" | "info" | "error";
  exiting: boolean;
}

interface ToastContextValue {
  show: (message: string, variant?: ToastItem["variant"]) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const VISIBLE_MS = 1200;
const FADE_MS = 350;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const show = useCallback<ToastContextValue["show"]>((message, variant = "success") => {
    const id = ++counter.current;
    setToasts((prev) => [...prev, { id, message, variant, exiting: false }]);

    const duration = variant === "success" ? VISIBLE_MS : 2400;
    window.setTimeout(() => {
      setToasts((prev) =>
        prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)),
      );
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, FADE_MS);
    }, duration);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+88px)] z-50 flex flex-col items-center gap-2 px-4">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={[
              "pointer-events-auto flex max-w-sm items-center gap-2 rounded-button bg-ink/95 px-4 py-3 text-sm font-medium text-white shadow-lift backdrop-blur-sm",
              toast.exiting ? "animate-toast-out" : "animate-toast-in",
            ].join(" ")}
          >
            {toast.variant === "success" && (
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/15">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </span>
            )}
            <span>{toast.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
