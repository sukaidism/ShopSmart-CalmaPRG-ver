import { useState } from 'react';
import { useAuth } from './context/auth.js';
import AccountPage from './pages/AccountPage.jsx';
import OrdersPage from './pages/OrdersPage.jsx';
import RequireAuth from './components/RequireAuth.jsx';
import { NavLink, Route, Routes } from 'react-router-dom';
import { useCart } from './context/CartContext.jsx';
import ProductsPage from './pages/ProductsPage.jsx';
import ProductDetailsPage from './pages/ProductDetailsPage.jsx';
import CartPage from './pages/CartPage.jsx';
import CheckoutPage from './pages/CheckoutPage.jsx';
import AssistantPage from './pages/AssistantPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';

export default function App() {
  const { itemCount, clearCart } = useCart();
  const { user, loading, logout } = useAuth();
  const [logoutError, setLogoutError] = useState('');
  async function signOut() {
    try { await logout(); clearCart(); setLogoutError(''); }
    catch (error) { setLogoutError(error.message); }
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <NavLink className="brand" to="/">ShopSmart</NavLink>
        <nav aria-label="Primary navigation">
          <NavLink to="/">Products</NavLink>
          <NavLink to="/assistant">AI Assistant</NavLink>
          <NavLink to="/cart">Cart ({itemCount})</NavLink>
          {user ? <><NavLink to="/orders">My orders</NavLink><button onClick={signOut}>Sign out</button></> : !loading && <NavLink to="/account">Sign in</NavLink>}
        </nav>
      </header>

      <main>
        {logoutError && <p role="alert">{logoutError}</p>}
        <Routes>
          <Route path="/" element={<ProductsPage />} />
          <Route path="/products/:productId" element={<ProductDetailsPage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/orders" element={<RequireAuth><OrdersPage key={user?.id} /></RequireAuth>} />
          <Route path="/orders/:orderId" element={<RequireAuth><OrdersPage key={user?.id} /></RequireAuth>} />
          <Route path="/checkout" element={<RequireAuth><CheckoutPage key={user?.id} /></RequireAuth>} />
          <Route path="/assistant" element={<AssistantPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>

      <footer className="site-footer">
        ShopSmart classroom starter • Simulated purchases only
      </footer>
    </div>
  );
}
