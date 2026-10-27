import type { ChangeEvent, ReactElement, SubmitEvent } from 'react';
import { useState } from 'react';

import { sendLead } from './api';

const EMPTY_FORM = { name: '', contact: '', message: '' };

export function App(): ReactElement {
  const [form, setForm] = useState(EMPTY_FORM);
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);
  // id назначается до первой отправки: повтор неизменённой формы, даже после потерянного ответа, дедуплицируется
  const [leadId, setLeadId] = useState(() => crypto.randomUUID());
  // Поля заблокированы на время запроса: иначе отправленная форма и её id разошлись бы
  const sending = status === 'sending';

  const handleChange =
    (field: keyof typeof EMPTY_FORM) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
      setForm((prev) => ({ ...prev, [field]: event.target.value }));
      // Изменённая форма — уже другой лид, его нельзя склеивать с прежним через дедупликацию
      setLeadId(crypto.randomUUID());
    };

  const submit = async (): Promise<void> => {
    setStatus('sending');
    setError(null);

    try {
      await sendLead(form, leadId);
      setStatus('sent');
      setForm(EMPTY_FORM);
      setLeadId(crypto.randomUUID());
    } catch (e: unknown) {
      setStatus('idle');
      setError(e instanceof Error ? e.message : 'Неизвестная ошибка');
    }
  };

  const handleSubmit = (event: SubmitEvent<HTMLFormElement>): void => {
    event.preventDefault();
    void submit();
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
          <textarea
            value={form.message}
            onChange={handleChange('message')}
            disabled={sending}
            required
            maxLength={2048}
            rows={4}
          />
        </label>

        <button type="submit" disabled={sending}>
          {sending ? 'Отправка…' : 'Отправить'}
        </button>
      </form>
    </main>
  );
}
