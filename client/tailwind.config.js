/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
      },
      colors: {
        // Премиальная нейтральная палитра витрины
        paper: "#ffffff",
        ink: "#0b0b0c",
        muted: "#6b6b70",
        line: "#ededec",
        surface: "#f6f6f5",
        // Telegram theme params (для отдельных элементов)
        tg: {
          bg: "var(--tg-theme-bg-color, #ffffff)",
          text: "var(--tg-theme-text-color, #0b0b0c)",
          hint: "var(--tg-theme-hint-color, #6b6b70)",
          link: "var(--tg-theme-link-color, #2481cc)",
          button: "var(--tg-theme-button-color, #0b0b0c)",
          buttonText: "var(--tg-theme-button-text-color, #ffffff)",
          secondaryBg: "var(--tg-theme-secondary-bg-color, #f6f6f5)",
        },
      },
      borderRadius: {
        card: "24px",
        xl2: "20px",
        button: "16px",
        chip: "12px",
      },
      boxShadow: {
        soft: "0 8px 30px -12px rgba(11, 11, 12, 0.16)",
        card: "0 2px 16px -8px rgba(11, 11, 12, 0.12)",
        lift: "0 16px 40px -16px rgba(11, 11, 12, 0.22)",
      },
      transitionTimingFunction: {
        premium: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "badge-pop": {
          "0%": { transform: "scale(1)" },
          "40%": { transform: "scale(1.35)" },
          "100%": { transform: "scale(1)" },
        },
        "toast-in": {
          "0%": { opacity: "0", transform: "translateY(16px) scale(0.98)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        "check-pop": {
          "0%": { transform: "scale(0.6)", opacity: "0" },
          "60%": { transform: "scale(1.15)", opacity: "1" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.45s cubic-bezier(0.22, 1, 0.36, 1) both",
        "fade-in": "fade-in 0.3s ease both",
        "badge-pop": "badge-pop 0.4s cubic-bezier(0.22, 1, 0.36, 1)",
        "toast-in": "toast-in 0.35s cubic-bezier(0.22, 1, 0.36, 1) both",
        "check-pop": "check-pop 0.4s cubic-bezier(0.22, 1, 0.36, 1) both",
      },
    },
  },
  plugins: [],
};
