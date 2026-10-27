import { Logger } from '@nestjs/common';

import { EmailClient } from '../../../router/src/leads-module/infrastructure/delivery/email-lead-delivery/email-client/email.client';
import {
  emailClientConfig,
  type EmailClientConfigType,
} from '../../../router/src/leads-module/infrastructure/delivery/email-lead-delivery/email-client/email-client.config';
import type { E2eEnvironment } from '../support/environment';
import { waitFor } from '../support/wait-for';

export function emailAdapterSuite(env: () => E2eEnvironment): void {
  describe('email adapter', () => {
    it('sends the lead text to the configured mailbox', async () => {
      const { smtp, postLead } = env();

      const { lead } = await postLead('email');

      const delivery = await waitFor(
        () => smtp.messages.find((message) => message.text.includes(lead.contact)),
        10_000,
        'smtp message',
      );

      expect(delivery.to).toBe('inbox@test.local');
      expect(delivery.from).toBe('leads@test.local');
      expect(delivery.subject).toBe(`New lead from ${lead.name}`);
      // Тело письма при передаче по SMTP может получить \r\n вместо \n,
      // поэтому сравнивается с нормализацией переводов строк
      const expectedText = `From: ${lead.name} <${lead.contact}>\nMessage: ${lead.message}`;

      expect(delivery.text.replace(/\r\n/g, '\n').trim()).toBe(expectedText);
    });

    it('refuses to send credentials and the lead over SMTP without STARTTLS', async (): Promise<void> => {
      const { smtp, routerApp } = env();

      const errors = jest.spyOn(Logger.prototype, 'error').mockImplementation((): void => undefined);
      const client = new EmailClient({
        ...routerApp.get<EmailClientConfigType>(emailClientConfig.KEY),
        requireTLS: true,
      });
      const before = smtp.messages.length;
      try {
        await expect(client.sendMail('inbox@test.local', 'plaintext', 'secret lead')).rejects.toThrow();
        expect(smtp.messages).toHaveLength(before);
      } finally {
        errors.mockRestore();
      }
    });
  });
}
