import { generateLeadId, LeadEntity } from '@leads-router/common';
import { Logger } from '@nestjs/common';
import request from 'supertest';

import type { E2eEnvironment } from '../support/environment';
import type { TelegramApiCall } from '../support/telegram-api-sink';
import { waitFor } from '../support/wait-for';

export function telegramAdapterSuite(env: () => E2eEnvironment): void {
  describe('telegram adapter', () => {
    it('sends the lead text to the configured chat', async () => {
      const { telegramApi, postLead } = env();

      const { lead } = await postLead('telegram');

      const delivery = await waitFor(
        () => telegramApi.calls.find((call) => call.params.text.includes(lead.contact)),
        10_000,
        'telegram api call',
      );

      expect(delivery.url).toBe('https://api.telegram.org/bot123456:test-token/sendMessage');
      expect(delivery.params.chat_id).toBe('123456789');
      expect(delivery.params.text).toBe(`From: ${lead.name} <${lead.contact}>\nMessage: ${lead.message}`);
    });

    it('waits the retry_after requested by a 429 before the next attempt', async (): Promise<void> => {
      const { telegramApi, gatewayApp, waitForQueueIdle } = env();

      await waitForQueueIdle();
      const errors = jest.spyOn(Logger.prototype, 'error').mockImplementation((): void => undefined);
      const lead = new LeadEntity(generateLeadId(), 'Telegram flood', 'telegram-flood@test.local', 'hello');
      const ofLead = (call: TelegramApiCall): boolean => call.params.text.includes(lead.contact);
      telegramApi.respond = (call: TelegramApiCall): Response | undefined =>
        ofLead(call) && telegramApi.calls.filter(ofLead).length === 1
          ? Response.json(
              { ok: false, error_code: 429, description: 'Too Many Requests', parameters: { retry_after: 1 } },
              { status: 429 },
            )
          : undefined;
      try {
        await request(gatewayApp.getHttpServer()).post('/api/v1/leads').send(lead).expect(201);

        const [first, second] = await waitFor(
          (): TelegramApiCall[] | undefined => {
            const calls = telegramApi.calls.filter(ofLead);
            return calls.length >= 2 ? calls : undefined;
          },
          10_000,
          'telegram retry after 429',
        );

        // LEADS_QUEUE_BACKOFF=50: без учёта retry_after повтор пришёл бы через ~50 мс
        expect(second.at - first.at).toBeGreaterThanOrEqual(1_000);
      } finally {
        telegramApi.respond = undefined;
        errors.mockRestore();
      }
    });
  });
}
