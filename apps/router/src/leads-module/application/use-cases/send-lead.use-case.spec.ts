import { ApplicationException, ChannelEnum, LeadEntity } from '@leads-router/common';
import { Logger } from '@nestjs/common';

import { UnsupportedLeadChannelException } from '../exceptions/unsupported-lead-channel.exception';
import type { LeadDeliveryPort } from '../ports/lead-delivery.port';
import { SendLeadUseCase } from './send-lead.use-case';

class AdapterFake implements LeadDeliveryPort {
  readonly sent: LeadEntity[] = [];

  constructor(
    readonly channel: ChannelEnum,
    readonly enabled: boolean,
  ) {}

  send(lead: LeadEntity): Promise<void> {
    this.sent.push(lead);
    return Promise.resolve();
  }
}

// Контракт ENABLED-флага: выключенный канал молча пропускается, нерегистрированный - ошибка приложения
describe('SendLeadUseCase', () => {
  let loggerVerbose: jest.SpyInstance;
  let consoleAdapter: AdapterFake;
  let telegramAdapter: AdapterFake;
  let useCase: SendLeadUseCase;

  const makeLead = (): LeadEntity => LeadEntity.generate('Иван', 'ivan@example.com', 'hello');

  beforeAll(() => {
    loggerVerbose = jest.spyOn(Logger.prototype, 'verbose').mockImplementation(() => undefined);
  });

  afterAll(() => {
    loggerVerbose.mockRestore();
  });

  beforeEach(() => {
    consoleAdapter = new AdapterFake(ChannelEnum.CONSOLE, true);
    telegramAdapter = new AdapterFake(ChannelEnum.TELEGRAM, false);
    useCase = new SendLeadUseCase(
      new Map([
        [ChannelEnum.CONSOLE, consoleAdapter],
        [ChannelEnum.TELEGRAM, telegramAdapter],
      ]),
    );
  });

  it('sends the lead through an enabled adapter', async () => {
    const lead = makeLead();

    await useCase.execute(ChannelEnum.CONSOLE, lead);

    expect(consoleAdapter.sent).toEqual([lead]);
    expect(telegramAdapter.sent).toEqual([]);
  });

  it('skips a disabled adapter without sending or throwing', async () => {
    await useCase.execute(ChannelEnum.TELEGRAM, makeLead());

    expect(telegramAdapter.sent).toEqual([]);
    expect(loggerVerbose).toHaveBeenCalledTimes(1);
  });

  it('throws an application exception for an unregistered channel', async () => {
    await expect(useCase.execute(ChannelEnum.HTTP, makeLead())).rejects.toBeInstanceOf(
      UnsupportedLeadChannelException,
    );
    await expect(useCase.execute(ChannelEnum.HTTP, makeLead())).rejects.toBeInstanceOf(ApplicationException);
    expect(consoleAdapter.sent).toEqual([]);
    expect(telegramAdapter.sent).toEqual([]);
  });
});
