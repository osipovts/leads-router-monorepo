import { ChannelEnum, LeadEntity } from '@leads-router/common';
import { Inject, Injectable, Logger } from '@nestjs/common';

import type { LeadDeliveryPort } from '../../../application/ports/lead-delivery.port';
import { HttpLeadDeliveryException } from './http-lead-delivery.exception';
import { HttpClient } from './http-client/http.client';
import { httpLeadDeliveryConfig, type HttpLeadDeliveryConfigType } from './http-lead-delivery.config';

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

    const failedEndpoints = this.config.ENDPOINTS.filter((_, index) => results[index].status === 'rejected');

    this.logger.verbose(`Fulfilled ${(results.length - failedEndpoints.length).toString()} request(s)`);
    this.logger.verbose(`Rejected ${failedEndpoints.length.toString()} request(s)`);

    if (failedEndpoints.length > 0) {
      throw new HttpLeadDeliveryException(failedEndpoints, this.config.ENDPOINTS.length);
    }
  }
}
