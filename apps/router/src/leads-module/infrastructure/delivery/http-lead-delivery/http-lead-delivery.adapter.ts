import { ChannelEnum, LeadEntity } from '@leads-router/common';
import { Inject, Injectable, Logger } from '@nestjs/common';

import { LeadDeliveryPort } from '../../../application/ports/lead-delivery.port';
import { HttpClient } from './http-client/http.client';
import { httpLeadDeliveryConfig, HttpLeadDeliveryConfigType } from './http-lead-delivery.config';

@Injectable()
export class HttpLeadDeliveryAdapter implements LeadDeliveryPort {
  readonly channel = ChannelEnum.HTTP;
  private readonly logger = new Logger(HttpLeadDeliveryAdapter.name);

  constructor(
    @Inject(httpLeadDeliveryConfig.KEY) private readonly config: HttpLeadDeliveryConfigType,
    private readonly client: HttpClient,
  ) {}

  async send(lead: LeadEntity): Promise<void> {
    const queue = this.config.ENDPOINTS.map((endpoint) => this.client.post(endpoint, lead));
    const results = await Promise.allSettled(queue);

    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    const rejected = results.filter((result) => result.status === 'rejected');

    this.logger.verbose(`Fulfilled ${String(fulfilled.length)} request(s)`);
    this.logger.verbose(`Rejected ${String(rejected.length)} request(s)`);
  }
}
