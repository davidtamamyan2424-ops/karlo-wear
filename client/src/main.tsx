import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { CartProvider } from "./cart/CartContext";
import { ToastProvider } from "./components/Toast";
import { initTelegram } from "./telegram/webapp";
import "./index.css";

async function bootstrap() {
  // В обычном браузере — мгновенно, без запроса к telegram.org.
  // В Mini App — сначала SDK, затем ready()/expand().
  await initTelegram();

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <BrowserRouter>
        <ToastProvider>
          <CartProvider>
            <App />
          </CartProvider>
        </ToastProvider>
      </BrowserRouter>
    </StrictMode>,
  );
}

void bootstrap();

