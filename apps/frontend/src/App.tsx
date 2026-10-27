import { useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';

import { sendLead, SendLeadError } from './api';

const EMPTY_FORM = { name: '', contact: '', message: '' };

export function App() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);
  // id лида, которому gateway не смог поставить все каналы в очередь: повтор с ним дедуплицируется
  const [retryLeadId, setRetryLeadId] = useState<string | undefined>(undefined);
  // Поля заблокированы на время запроса: иначе ответ с retryLeadId привязал бы id прежнего лида к изменённой форме
  const sending = status === 'sending';

  const handleChange = (field: keyof typeof EMPTY_FORM) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
    // Изменённая форма — уже другой лид, его нельзя склеивать с прежним через дедупликацию
    setRetryLeadId(undefined);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus('sending');
    setError(null);

    try {
      await sendLead(form, retryLeadId);
      setStatus('sent');
      setForm(EMPTY_FORM);
      setRetryLeadId(undefined);
    } catch (e: unknown) {
      setStatus('idle');
      if (e instanceof SendLeadError && e.leadId !== undefined) {
        setRetryLeadId(e.leadId);
      }
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
          <input value={form.name} onChange={handleChange('name')} disabled={sending} required maxLength={64} />
        </label>

        <label>
          Контакт
          <input value={form.contact} onChange={handleChange('contact')} disabled={sending} required maxLength={128} />
        </label>

        <label>
          Сообщение
          <textarea value={form.message} onChange={handleChange('message')} disabled={sending} required maxLength={2048} rows={4} />
        </label>

        <button type="submit" disabled={sending}>
          {sending ? 'Отправка…' : 'Отправить'}
        </button>
      </form>
    </main>
  );
}
