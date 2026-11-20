import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/auth.js';
import StatusMessage from '../components/StatusMessage.jsx';
export default function AccountPage() {
  const { user, loading, authenticate } = useAuth();
  const location = useLocation();
  const destination = ['/checkout', '/orders'].includes(location.state?.from) || /^\/orders\/\d+$/.test(location.state?.from || '') ? location.state.from : '/orders';
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (loading) return <p role="status">Checking your session...</p>;
  if (user) return <Navigate to={destination} replace />;
  const update = (event) => setForm({ ...form, [event.target.name]: event.target.value });
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('');
    try { await authenticate(mode, form); }
    catch (caught) { setError(caught.message); }
    finally { setBusy(false); }
  }
  return <section className="account-panel">
    <h1>{mode === 'login' ? 'Sign in' : 'Create an account'}</h1>
    <p>Use fictional customer details for this classroom demonstration.</p>
    <form onSubmit={submit}>
      <StatusMessage type="error">{error}</StatusMessage>
      {mode === 'register' && <label>Full name<input name="name" value={form.name} onChange={update} autoComplete="name" minLength="2" maxLength="80" required /></label>}
      <label>Email address<input name="email" type="email" value={form.email} onChange={update} autoComplete="username" maxLength="254" required /></label>
      <label>Password<input name="password" type="password" value={form.password} onChange={update} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength="12" maxLength="128" required /></label>
      <small>Use 12-128 characters.</small>
      <button disabled={busy}>{busy ? 'Please wait...' : mode === 'login' ? 'Sign in' : 'Create account'}</button>
      <button type="button" className="button secondary" disabled={busy} onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); setForm({ ...form, password: '' }); }}>{mode === 'login' ? 'Create an account instead' : 'Sign in instead'}</button>
    </form>
  </section>;
}
