import { generateLeadId, LeadEntity } from '@leads-router/common';
import { Logger } from '@nestjs/common';

import { ConsoleLeadDeliveryAdapter } from './console-lead-delivery.adapter';
import type { ConsoleLeadDeliveryConfigType } from './console-lead-delivery.config';

describe('ConsoleLeadDeliveryAdapter', (): void => {
  it('logs the full lead text', async (): Promise<void> => {
    const logged = jest.spyOn(Logger.prototype, 'log').mockImplementation((): void => undefined);
    try {
      const lead = new LeadEntity(generateLeadId(), 'Иван', 'ivan@example.com', 'hello');
      const adapter = new ConsoleLeadDeliveryAdapter({ ENABLED: true } satisfies ConsoleLeadDeliveryConfigType);

      await adapter.send(lead);

      // toString() содержит перевод строки, поэтому сверяются части сообщения
      const loggedJson = JSON.stringify(logged.mock.calls);
      expect(loggedJson).toContain('Incoming lead: ');
      expect(loggedJson).toContain(lead.contact);
      expect(loggedJson).toContain('Message: hello');
    } finally {
      logged.mockRestore();
    }
  });
});
