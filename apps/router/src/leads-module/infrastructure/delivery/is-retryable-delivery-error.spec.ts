import { ChannelEnum } from '@leads-router/common';
import { AxiosError, AxiosHeaders } from 'axios';
import { TelegramApiError } from 'node-telegram-bot-api';

import { Prisma } from '../../../common/infrastructure/prisma/generated/client';
import { DatabaseUnavailableException } from '../../../common/infrastructure/prisma/prisma.exceptions';
import { UnsupportedLeadChannelException } from '../../application/exceptions/unsupported-lead-channel.exception';
import { HttpLeadDeliveryException } from './http-lead-delivery/http-lead-delivery.exception';
import { isRetryableDeliveryError } from './is-retryable-delivery-error';

function httpError(status: number): AxiosError {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError('request failed', undefined, config, undefined, {
    status,
    statusText: '',
    data: null,
    headers: {},
    config,
  });
}

describe('isRetryableDeliveryError', (): void => {
  it.each([
    [400, false],
    [401, false],
    [403, false],
    [404, false],
    [422, false],
    [408, true],
    [425, true],
    [429, true],
    [500, true],
    [503, true],
  ])('classifies HTTP %i as retryable=%s', (status, expected): void => {
    expect(isRetryableDeliveryError(httpError(status))).toBe(expected);
  });

  it.each([
    [400, false],
    [401, false],
    [403, false],
    [429, true],
    [500, true],
  ])('uses Telegram error classification for %i', (status, expected): void => {
    const cause = new TelegramApiError(status, 'delivery failed');
    expect(isRetryableDeliveryError(new Error('wrapper', { cause }))).toBe(expected);
  });

  it.each([
    [450, true],
    [454, true],
    [535, false],
    [550, false],
  ])('classifies SMTP %i', (responseCode, expected): void => {
    expect(isRetryableDeliveryError({ cause: { code: 'EAUTH', responseCode } })).toBe(expected);
  });

  it('does not retry invalid SMTP credentials without a server status', (): void => {
    expect(isRetryableDeliveryError({ code: 'EAUTH' })).toBe(false);
  });

  it.each([
    ['P2000', false],
    ['P2003', false],
    ['P2034', true],
    ['P2024', true],
  ])('classifies Prisma %s', (code, expected): void => {
    const cause = new Prisma.PrismaClientKnownRequestError('database failed', { code, clientVersion: 'test' });
    expect(isRetryableDeliveryError(new DatabaseUnavailableException(cause))).toBe(expected);
  });

  it('does not treat invalid database credentials as a temporary outage', (): void => {
    const cause = new Prisma.PrismaClientInitializationError('authentication failed', 'test', 'P1000');
    expect(isRetryableDeliveryError(new DatabaseUnavailableException(cause))).toBe(false);
  });

  it('retries mixed HTTP failures while any endpoint has a temporary error', (): void => {
    const error = new HttpLeadDeliveryException(
      [
        { endpoint: 'http://one.test', status: 400, retryable: false },
        { endpoint: 'http://two.test', status: 503, retryable: true },
      ],
      2,
    );
    expect(isRetryableDeliveryError(error)).toBe(true);
  });

  it('does not retry an unsupported channel', (): void => {
    expect(isRetryableDeliveryError(new UnsupportedLeadChannelException(ChannelEnum.HTTP))).toBe(false);
  });

  it('keeps unknown and cyclic causes retryable', (): void => {
    const error: { cause?: object } = {};
    error.cause = error;
    expect(isRetryableDeliveryError(error)).toBe(true);
    expect(isRetryableDeliveryError(new Error('unknown'))).toBe(true);
  });
});
