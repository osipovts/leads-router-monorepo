import { ChannelEnum, type LeadEntity } from '@leads-router/common';
import { Inject, Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

import type { DeliveryCheckpoint, LeadDeliveryPort } from '../../../application/ports/lead-delivery.port';
import { endpointKey } from './endpoint-key';
import { HttpClient } from './http-client/http.client';
import { httpLeadDeliveryConfig, type HttpLeadDeliveryConfigType } from './http-lead-delivery.config';
import { type HttpDeliveryFailure, HttpLeadDeliveryException } from './http-lead-delivery.exception';
import { isRetryableHttpError } from './is-retryable-http-error';

@Injectable()
export class HttpLeadDeliveryAdapter implements LeadDeliveryPort {
  readonly channel = ChannelEnum.HTTP;
  private readonly logger = new Logger(HttpLeadDeliveryAdapter.name);

  constructor(
    @Inject(httpLeadDeliveryConfig.KEY) private readonly config: HttpLeadDeliveryConfigType,
    private readonly client: HttpClient,
  ) {}

  get enabled(): boolean {
    return this.config.enabled;
  }

  async send(lead: LeadEntity, checkpoint: DeliveryCheckpoint): Promise<void> {
    const pending = this.config.endpoints.filter(
      (endpoint): boolean => !checkpoint.delivered.has(endpointKey(endpoint)),
    );
    const results = await Promise.allSettled(pending.map((endpoint) => this.client.post(endpoint, lead)));

    const delivered: string[] = [];
    const failures: HttpDeliveryFailure[] = [];
    results.forEach((result, index): void => {
      if (result.status === 'fulfilled') {
        delivered.push(endpointKey(pending[index]));
      } else {
        const error: unknown = result.reason;
        failures.push({
          endpoint: pending[index],
          status: axios.isAxiosError(error) ? error.response?.status : undefined,
          code: axios.isAxiosError(error) ? error.code : undefined,
          isRetryable: isRetryableHttpError(error),
        });
      }
    });

    this.logger.verbose(`Fulfilled ${delivered.length.toString()} request(s)`);
    this.logger.verbose(`Rejected ${failures.length.toString()} request(s)`);

    if (failures.length > 0) {
      // Одна запись после всех запросов: параллельные записи из обработчиков POST
      // перетирали бы друг друга, и часть отметок терялась бы
      await checkpoint.markDelivered(delivered);
      throw new HttpLeadDeliveryException(failures, this.config.endpoints.length);
    }
  }
}
