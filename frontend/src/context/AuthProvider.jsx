import { useEffect, useState } from 'react';
import { AuthContext } from './auth.js';
import { api } from '../services/api.js';
export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    api.me().then((data) => { if (active) setUser(data.user); }).catch((caught) => {
      if (active && caught.status !== 401) setError(caught.message);
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  const value = {
    user, loading, error,
    async authenticate(mode, form) {
      const data = await api[mode](form);
      setUser(data.user); setError('');
    },
    async logout() { await api.logout(); setUser(null); }
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
