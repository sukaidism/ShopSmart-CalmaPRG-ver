import React from 'react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { CartProvider } from './context/CartContext.jsx';
import App from './App.jsx';
import AuthProvider from './context/AuthProvider.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <CartProvider>
        <AuthProvider><App /></AuthProvider>
      </CartProvider>
    </BrowserRouter>
  </StrictMode>
);
