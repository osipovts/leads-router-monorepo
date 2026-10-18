import { ChannelEnum, type LeadEntity } from '@leads-router/common';
import { Inject, Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

import type { LeadDeliveryPort } from '../../../application/ports/lead-delivery.port';
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
    return this.config.ENABLED;
  }

  async send(lead: LeadEntity): Promise<void> {
    const jobs = this.config.ENDPOINTS.map((endpoint) => this.client.post(endpoint, lead));
    const results = await Promise.allSettled(jobs);

    const failures: HttpDeliveryFailure[] = [];
    results.forEach((result, index): void => {
      if (result.status === 'rejected') {
        const error: unknown = result.reason;
        failures.push({
          endpoint: this.config.ENDPOINTS[index],
          status: axios.isAxiosError(error) ? error.response?.status : undefined,
          code: axios.isAxiosError(error) ? error.code : undefined,
          isRetryable: isRetryableHttpError(error),
        });
      }
    });

    this.logger.verbose(`Fulfilled ${(results.length - failures.length).toString()} request(s)`);
    this.logger.verbose(`Rejected ${failures.length.toString()} request(s)`);

    if (failures.length > 0) {
      throw new HttpLeadDeliveryException(failures, this.config.ENDPOINTS.length);
    }
  }
}
