import type { ChannelEnum } from '@leads-router/common';
import type { Provider, Type } from '@nestjs/common';

import type { LeadDeliveryPort } from '../../application/ports/lead-delivery.port';
import { LEAD_DELIVERY_ADAPTERS } from '../../application/ports/lead-delivery.port';
import { ConsoleLeadDeliveryAdapter } from './console-lead-delivery/console-lead-delivery.adapter';
import { ConsoleLeadDeliveryModule } from './console-lead-delivery/console-lead-delivery.module';
import { DatabaseLeadDeliveryAdapter } from './database-lead-delivery/database-lead-delivery.adapter';
import { DatabaseLeadDeliveryModule } from './database-lead-delivery/database-lead-delivery.module';
import { EmailLeadDeliveryAdapter } from './email-lead-delivery/email-lead-delivery.adapter';
import { EmailLeadDeliveryModule } from './email-lead-delivery/email-lead-delivery.module';
import { HttpLeadDeliveryAdapter } from './http-lead-delivery/http-lead-delivery.adapter';
import { HttpLeadDeliveryModule } from './http-lead-delivery/http-lead-delivery.module';
import { TelegramLeadDeliveryAdapter } from './telegram-lead-delivery/telegram-lead-delivery.adapter';
import { TelegramLeadDeliveryModule } from './telegram-lead-delivery/telegram-lead-delivery.module';

interface DeliveryAdapter {
  readonly module: Type<unknown>;
  readonly adapter: Type<LeadDeliveryPort>;
}

// Модули и провайдеры адаптеров собираются из одного списка.
const DELIVERY_ADAPTERS: readonly DeliveryAdapter[] = [
  { module: ConsoleLeadDeliveryModule, adapter: ConsoleLeadDeliveryAdapter },
  { module: DatabaseLeadDeliveryModule, adapter: DatabaseLeadDeliveryAdapter },
  { module: TelegramLeadDeliveryModule, adapter: TelegramLeadDeliveryAdapter },
  { module: HttpLeadDeliveryModule, adapter: HttpLeadDeliveryAdapter },
  { module: EmailLeadDeliveryModule, adapter: EmailLeadDeliveryAdapter },
];

export const DELIVERY_ADAPTER_MODULES: ReadonlyArray<Type<unknown>> = DELIVERY_ADAPTERS.map(({ module }) => module);

export const LEAD_DELIVERY_ADAPTERS_PROVIDER: Provider = {
  provide: LEAD_DELIVERY_ADAPTERS,
  inject: DELIVERY_ADAPTERS.map(({ adapter }) => adapter),
  useFactory: (...adapters: LeadDeliveryPort[]): ReadonlyMap<ChannelEnum, LeadDeliveryPort> =>
    new Map(adapters.map((adapter) => [adapter.channel, adapter] as const)),
};
