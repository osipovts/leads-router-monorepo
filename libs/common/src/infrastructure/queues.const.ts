export const QUEUES = Object.freeze({
  LEADS: {
    QUEUE_NAME: 'leads',
    // Стратегия регистрируется воркером router: задержка учитывает retry_after получателя
    BACKOFF_STRATEGY: 'lead-delivery',
    JOBS: {
      SEND: 'send-lead',
    },
  },
});
