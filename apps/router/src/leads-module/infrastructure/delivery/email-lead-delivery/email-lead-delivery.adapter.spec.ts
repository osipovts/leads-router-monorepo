import { generateLeadId, LeadEntity } from '@leads-router/common';
import { Logger } from '@nestjs/common';

import type { EmailClient } from './email-client/email.client';
import { EmailLeadDeliveryAdapter } from './email-lead-delivery.adapter';
import type { EmailLeadDeliveryConfigType } from './email-lead-delivery.config';
import { EmailLeadDeliveryException } from './email-lead-delivery.exception';

const CONFIG = { ENABLED: true, TO: 'inbox@example.com' } satisfies EmailLeadDeliveryConfigType;

describe('EmailLeadDeliveryAdapter', (): void => {
  let sendMail: jest.MockedFunction<EmailClient['sendMail']>;

  beforeAll((): void => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation((): void => undefined);
  });

  afterAll((): void => {
    jest.restoreAllMocks();
  });

  beforeEach((): void => {
    sendMail = jest.fn();
  });

  it('sends the lead text with a subject to the configured mailbox', async (): Promise<void> => {
    const lead = new LeadEntity(generateLeadId(), 'Иван', 'ivan@example.com', 'hello');
    sendMail.mockResolvedValue(undefined);
    const adapter = new EmailLeadDeliveryAdapter(CONFIG, { sendMail } as unknown as EmailClient);

    await adapter.send(lead);

    expect(sendMail).toHaveBeenCalledWith(CONFIG.TO, `New lead from ${lead.name}`, lead.toString());
  });

  it('wraps a client failure into the delivery exception', async (): Promise<void> => {
    const lead = new LeadEntity(generateLeadId(), 'Иван', 'ivan@example.com', 'hello');
    const failure = new Error('smtp is down');
    sendMail.mockRejectedValue(failure);
    const adapter = new EmailLeadDeliveryAdapter(CONFIG, { sendMail } as unknown as EmailClient);

    const sending: Promise<void> = adapter.send(lead);

    const caught: unknown = await sending.catch((error: unknown): unknown => error);
    expect(caught).toBeInstanceOf(EmailLeadDeliveryException);
    expect((caught as EmailLeadDeliveryException).cause).toBe(failure);
  });

  it.each([
    [450, true],
    [454, true],
    [535, false],
    [550, false],
  ])('classifies SMTP response code %i as isRetryable=%s', (responseCode, isRetryable): void => {
    const failure = Object.assign(new Error('smtp failed'), { responseCode });

    expect(new EmailLeadDeliveryException(failure).isRetryable).toBe(isRetryable);
  });

  it('does not retry invalid SMTP credentials without a server status', (): void => {
    const failure = Object.assign(new Error('auth failed'), { code: 'EAUTH' });

    expect(new EmailLeadDeliveryException(failure).isRetryable).toBe(false);
  });

  it('keeps unknown errors retryable', (): void => {
    expect(new EmailLeadDeliveryException(new Error('unknown')).isRetryable).toBe(true);
  });
});
