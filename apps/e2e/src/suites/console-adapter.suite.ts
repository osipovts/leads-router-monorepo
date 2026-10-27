import type { E2eEnvironment } from '../support/environment';
import { waitFor } from '../support/wait-for';

export function consoleAdapterSuite(env: () => E2eEnvironment): void {
  describe('console adapter', () => {
    it('logs the delivered lead', async () => {
      const { adapterLog, postLead } = env();

      const { lead } = await postLead('console');

      await waitFor(
        () =>
          adapterLog.mock.calls.some(
            ([message]) => String(message).includes('Incoming lead') && String(message).includes(lead.contact),
          ),
        10_000,
        'console adapter log',
      );
    });
  });
}
