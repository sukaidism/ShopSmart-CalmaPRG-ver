import { useState } from 'react';
import { Link } from 'react-router-dom';
import StatusMessage from '../components/StatusMessage.jsx';
import { api } from '../services/api.js';

export default function AssistantPage() {
  const [question, setQuestion] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function ask(event) {
    event.preventDefault(); setError(''); setResult(null); setLoading(true);
    try { setResult(await api.askAssistant(question)); }
    catch (caught) { setError(caught.message); }
    finally { setLoading(false); }
  }

  return (
    <section className="assistant-layout">
      <div>
        <p className="eyebrow">PRODUCT ASSISTANT</p>
        <h1>Find a product</h1>
        <p>Answers are drafted by AI from our live catalog and checked against current prices and stock.</p>

        <form onSubmit={ask}>
          <label>Your question<textarea value={question} onChange={(event) => setQuestion(event.target.value)} minLength="3" maxLength="300" placeholder="Which keyboard is below ₱2,000?" required /></label>
          <button disabled={loading}>{loading ? 'Searching…' : 'Ask ShopSmart'}</button>
        </form>
      </div>
      <div className="assistant-answer">
        <h2>Assistant response</h2>
        <StatusMessage type="error">{error}</StatusMessage>
        {!result && !error && <p>Your answer will appear here.</p>}
        {
        result && <>
          <p>{result.answer}</p>
          {result.notice && <StatusMessage type="error">{result.notice}</StatusMessage>}
          {result.recommendedProducts.length > 0 && (
            <div className="recommendations">
              {result.recommendedProducts.map((product) => (
                <Link key={product.id} to={`/products/${product.id}`}>{product.name} — ₱{Number(product.price).toLocaleString('en-PH')}</Link>
              ))}
            </div>
          )}
          {result.sources.length > 0 && (
            <details open>
              <summary>Sources ({result.sources.length})</summary>
              <ul>
                {result.sources.map((s) => (
                  <li key={s.id}><Link to={`/products/${s.id}`}>{s.name}</Link> (catalog product #{s.id})</li>
                ))}
              </ul>
            </details>
          )}
        </>
        }
      </div>
    </section>
  );
}
