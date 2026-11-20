import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../services/api.js';
import StatusMessage from '../components/StatusMessage.jsx';

const money = (value) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(value));
const date = (value) => new Date(value).toLocaleString('en-PH', { dateStyle: 'long', timeStyle: 'short' });
const statusLabel = (status) => status.charAt(0) + status.slice(1).toLowerCase().replaceAll('_', ' ');

function OrderStatus({ status }) {
  return <span className={'order-status order-status--' + status.toLowerCase()}><span aria-hidden="true" />{statusLabel(status)}</span>;
}

function OrderDetails({ order }) {
  const quantity = order.items.reduce((sum, item) => sum + item.quantity, 0);
  return <>
    <header className="order-detail-heading">
      <div><p className="eyebrow">ORDER DETAILS</p><h1>Order #{order.id}</h1>
        <p className="order-date">Placed <time dateTime={order.createdAt}>{date(order.createdAt)}</time></p>
      </div>
      <OrderStatus status={order.status} />
    </header>
    <div className="order-detail-grid">
      <section className="order-panel order-products" aria-labelledby="order-items-heading">
        <div className="order-panel-heading"><h2 id="order-items-heading">Items ordered</h2><span>{quantity} {quantity === 1 ? 'item' : 'items'}</span></div>
        <ul className="order-items-list">{order.items.map((item) => <li className="order-product-row" key={item.id}>
          <div className="order-product-icon" aria-hidden="true">{item.product?.emoji || '📦'}</div>
          <div className="order-product-info"><Link to={'/products/' + item.productId}>{item.product?.name || 'Product #' + item.productId}</Link>
            <p>Qty: {item.quantity}<span aria-hidden="true"> &middot; </span>{money(item.unitPrice)} each</p>
          </div>
          <strong className="order-line-total">{money(Number(item.unitPrice) * item.quantity)}</strong>
        </li>)}</ul>
        <div className="order-items-footer">Prices shown are from the time of your order.</div>
      </section>
      <div className="order-side-panels">
        <section className="order-panel" aria-labelledby="delivery-heading">
          <h2 id="delivery-heading">Delivery details</h2>
          <dl className="order-contact">
            <div><dt>Customer</dt><dd>{order.customerName}</dd></div>
            <div><dt>Email address</dt><dd>{order.email}</dd></div>
            <div><dt>Delivery address</dt><dd className="order-address">{order.address}</dd></div>
          </dl>
        </section>
        <section className="order-panel order-total-panel" aria-labelledby="order-summary-heading">
          <h2 id="order-summary-heading">Order summary</h2>
          <div className="order-total"><span>Order total</span><strong>{money(order.total)}</strong></div>
          <p className="order-demo-note">Simulated purchase. No payment was collected.</p>
        </section>
      </div>
    </div>
  </>;
}

export default function OrdersPage() {
  const { orderId } = useParams();
  const route = orderId || 'list';
  const [result, setResult] = useState({ loading: true });
  useEffect(() => {
    let active = true;
    (orderId ? api.getOrder(orderId).then((order) => ({ orders: [order] })) : api.getOrders())
      .then((data) => { if (active) setResult({ ...data, route }); })
      .catch((error) => { if (active) setResult({ error: error.message, route }); });
    return () => { active = false; };
  }, [orderId, route]);
  const current = result.route === route ? result : { loading: true };
  return <section className="orders-page">
    {orderId && <Link className="order-back-link" to="/orders"><span aria-hidden="true">&larr; </span>Back to my orders</Link>}
    {(!orderId || !current.orders?.[0]) && <header className="orders-heading"><p className="eyebrow">YOUR ACCOUNT</p><h1>{orderId ? 'Order details' : 'My orders'}</h1>
      {!orderId && <p>Keep track of your simulated purchases and view order details.</p>}
    </header>}
    {current.loading && <p role="status">Loading orders...</p>}
    <StatusMessage type="error">{current.error}</StatusMessage>
    {current.orders?.length === 0 && <div className="order-panel empty-state"><h2>No orders yet</h2><p>Your next find is waiting in the catalog.</p><Link className="button" to="/">Browse products</Link></div>}
    {orderId && current.orders?.[0] ? <OrderDetails order={current.orders[0]} /> : <div className="order-list">{current.orders?.map((order) => <article className="order-panel order-history-card" key={order.id}>
      <div><h2><Link to={'/orders/' + order.id}>Order #{order.id}</Link></h2><time className="order-date" dateTime={order.createdAt}>{date(order.createdAt)}</time></div>
      <OrderStatus status={order.status} />
      <div className="order-history-total"><small>Order total</small><strong>{money(order.total)}</strong></div>
      <Link className="button secondary" to={'/orders/' + order.id}>View details<span className="sr-only"> for order #{order.id}</span></Link>
    </article>)}</div>}
  </section>;
}
