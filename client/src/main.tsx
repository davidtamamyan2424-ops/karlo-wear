import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { CartProvider } from "./cart/CartContext";
import { ToastProvider } from "./components/Toast";
import { initTelegram } from "./telegram/webapp";
import "./index.css";
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import ErrorBoundary from './components/ErrorBoundary';

async function bootstrap() {
  // В обычном браузере — мгновенно, без запроса к telegram.org.
  // В Mini App — сначала SDK, затем ready()/expand().
  void initTelegram().catch(error => console.warn("[telegram]", error));

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <ErrorBoundary>
      <BrowserRouter>
        <ToastProvider>
          <CartProvider>
            <App />
          </CartProvider>
        </ToastProvider>
      </BrowserRouter>
      </ErrorBoundary>
    </StrictMode>,
  );
}

void bootstrap();

