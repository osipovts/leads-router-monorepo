import { QueueUnavailableException } from '../../infrastructure/queue/queue-unavailable.exception';
import { HealthController } from './health.controller';

describe('HealthController', (): void => {
  it('reports ok while the queue accepts leads', (): void => {
    const controller = new HealthController({ isReady: (): boolean => true, sendLead: jest.fn() });

    expect(controller.get()).toEqual({ success: true, data: { status: 'ok' } });
  });

  it('reports a temporary outage while the queue is not connected', (): void => {
    const controller = new HealthController({ isReady: (): boolean => false, sendLead: jest.fn() });

    expect((): unknown => controller.get()).toThrow(QueueUnavailableException);
  });
});
