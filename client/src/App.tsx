import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import CatalogPage from "./pages/CatalogPage";
import ProductPage from "./pages/ProductPage";
import CartPage from "./pages/CartPage";
import CheckoutPage from "./pages/CheckoutPage";
import PaymentPage from "./pages/PaymentPage";
import AdminPage from "./pages/admin/AdminPage";
import OfferPage from "./pages/legal/OfferPage";
import PrivacyPage from "./pages/legal/PrivacyPage";
import PersonalDataConsentPage from "./pages/legal/PersonalDataConsentPage";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<CatalogPage />} />
        <Route path="product/:id" element={<ProductPage />} />
        <Route path="cart" element={<CartPage />} />
        <Route path="checkout" element={<CheckoutPage />} />
        <Route path="order/:id" element={<PaymentPage />} />
        <Route path="offer" element={<OfferPage />} />
        <Route path="privacy" element={<PrivacyPage />} />
        <Route path="personal-data-consent" element={<PersonalDataConsentPage />} />
        <Route path="admin" element={<AdminPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
