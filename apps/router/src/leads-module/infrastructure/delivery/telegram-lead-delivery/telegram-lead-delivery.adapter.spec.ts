import { generateLeadId, LeadEntity } from '@leads-router/common';
import { Logger } from '@nestjs/common';
import { TelegramApiError } from 'node-telegram-bot-api';

import type { TelegramClient } from './telegram-client/telegram.client';
import { TelegramLeadDeliveryAdapter } from './telegram-lead-delivery.adapter';
import type { TelegramLeadDeliveryConfigType } from './telegram-lead-delivery.config';
import { TelegramLeadDeliveryException } from './telegram-lead-delivery.exception';

const CONFIG = { ENABLED: true, CHAT_ID: '193166758' } satisfies TelegramLeadDeliveryConfigType;

describe('TelegramLeadDeliveryAdapter', (): void => {
  let sendMessage: jest.MockedFunction<TelegramClient['sendMessage']>;

  beforeAll((): void => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation((): void => undefined);
  });

  afterAll((): void => {
    jest.restoreAllMocks();
  });

  beforeEach((): void => {
    sendMessage = jest.fn();
  });

  it('sends the lead text to the configured chat', async (): Promise<void> => {
    const lead = new LeadEntity(generateLeadId(), 'Иван', 'ivan@example.com', 'hello');
    sendMessage.mockResolvedValue(undefined);
    const adapter = new TelegramLeadDeliveryAdapter(CONFIG, { sendMessage } as unknown as TelegramClient);

    await adapter.send(lead);

    expect(sendMessage).toHaveBeenCalledWith(CONFIG.CHAT_ID, lead.toString());
  });

  it('wraps a client failure into the delivery exception', async (): Promise<void> => {
    const lead = new LeadEntity(generateLeadId(), 'Иван', 'ivan@example.com', 'hello');
    const failure = new Error('telegram is down');
    sendMessage.mockRejectedValue(failure);
    const adapter = new TelegramLeadDeliveryAdapter(CONFIG, { sendMessage } as unknown as TelegramClient);

    const sending: Promise<void> = adapter.send(lead);

    const caught: unknown = await sending.catch((error: unknown): unknown => error);
    expect(caught).toBeInstanceOf(TelegramLeadDeliveryException);
    expect((caught as TelegramLeadDeliveryException).cause).toBe(failure);
  });

  it.each([
    [400, false],
    [403, false],
    [429, true],
    [500, true],
  ])('classifies Telegram API %i as isRetryable=%s', (status, isRetryable): void => {
    expect(new TelegramLeadDeliveryException(new TelegramApiError(status, 'delivery failed')).isRetryable).toBe(
      isRetryable,
    );
  });

  it('classifies an error wrapped around a Telegram API failure by its cause', (): void => {
    const wrapped = new Error('transport failure', { cause: new TelegramApiError(429, 'flood') });

    expect(new TelegramLeadDeliveryException(wrapped).isRetryable).toBe(true);
  });

  it('keeps unknown and cyclic causes retryable', (): void => {
    const cyclic: { cause?: unknown } = {};
    cyclic.cause = cyclic;

    expect(new TelegramLeadDeliveryException(new Error('unknown')).isRetryable).toBe(true);
    expect(new TelegramLeadDeliveryException(cyclic).isRetryable).toBe(true);
  });
});
