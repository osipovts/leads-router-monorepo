import { useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';

import { sendLead } from './api';

const EMPTY_FORM = { name: '', contact: '', message: '' };

export function App() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);

  const handleChange = (field: keyof typeof EMPTY_FORM) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus('sending');
    setError(null);

    try {
      await sendLead(form);
      setStatus('sent');
      setForm(EMPTY_FORM);
    } catch (e: unknown) {
      setStatus('idle');
      setError(e instanceof Error ? e.message : 'Неизвестная ошибка');
    }
  };

  return (
    <main className="page">
      <h1>Отправить лид</h1>

      {status === 'sent' && <p className="notice notice--ok">Лид отправлен.</p>}
      {error !== null && <p className="notice notice--error">Ошибка: {error}</p>}

      <form onSubmit={handleSubmit}>
        <label>
          Имя
          <input value={form.name} onChange={handleChange('name')} required maxLength={64} />
        </label>

        <label>
          Контакт
          <input value={form.contact} onChange={handleChange('contact')} required maxLength={128} />
        </label>

        <label>
          Сообщение
          <textarea value={form.message} onChange={handleChange('message')} required maxLength={2048} rows={4} />
        </label>

        <button type="submit" disabled={status === 'sending'}>
          {status === 'sending' ? 'Отправка…' : 'Отправить'}
        </button>
      </form>
    </main>
  );
}
