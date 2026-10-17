import axios from 'axios';
import { isTransientError, TelegramApiError } from 'node-telegram-bot-api';

import { Prisma } from '../../../common/infrastructure/prisma/generated/client';
import { UnsupportedLeadChannelException } from '../../application/exceptions/unsupported-lead-channel.exception';
import { HttpLeadDeliveryException } from './http-lead-delivery/http-lead-delivery.exception';

const PERMANENT_DATABASE_ERROR_CODES = new Set([
  'P1000',
  'P1003',
  'P1010',
  'P1012',
  'P2000',
  'P2002',
  'P2003',
  'P2011',
  'P2025',
]);

export function isRetryableDeliveryError(error: unknown): boolean {
  const visited = new Set<object>();
  let current: unknown = error;

  while (typeof current === 'object' && current !== null && !visited.has(current)) {
    visited.add(current);

    if (current instanceof UnsupportedLeadChannelException) {
      return false;
    }
    if (current instanceof HttpLeadDeliveryException) {
      return current.retryable;
    }
    if (axios.isAxiosError(current)) {
      const status = current.response?.status;
      return status === undefined || status >= 500 || [408, 425, 429].includes(status);
    }
    if (current instanceof TelegramApiError) {
      return isTransientError(current);
    }
    if (current instanceof Prisma.PrismaClientKnownRequestError) {
      return !PERMANENT_DATABASE_ERROR_CODES.has(current.code);
    }
    if (current instanceof Prisma.PrismaClientInitializationError && current.errorCode !== undefined) {
      return !PERMANENT_DATABASE_ERROR_CODES.has(current.errorCode);
    }
    if ('responseCode' in current && typeof current.responseCode === 'number') {
      return current.responseCode < 500;
    }
    if ('code' in current && current.code === 'EAUTH') {
      return false;
    }

    current = 'cause' in current ? current.cause : undefined;
  }

  // Неизвестная ошибка остаётся повторяемой, чтобы новая ошибка не приводила к потере доставки.
  return true;
}
