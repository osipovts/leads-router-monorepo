import { Inject, Logger } from '@nestjs/common';
import type { AxiosInstance, Method } from 'axios';
import axios from 'axios';

import { httpClientConfig, type HttpClientConfigType } from './http-client.config';

export class HttpClient {
  private readonly logger = new Logger(HttpClient.name);
  private readonly client: AxiosInstance;

  constructor(@Inject(httpClientConfig.KEY) config: HttpClientConfigType) {
    this.client = axios.create({
      timeout: config.timeout,
      maxContentLength: 65_536,
      // Редиректы не отслеживаются: follow-redirects превращает POST в GET без тела,
      // и доставка молча становится успешной
      maxRedirects: 0,
    });

    // Клиентские ретраи намеренно отключены: единственный слой повторов — attempts задачи BullMQ.
    // Повтор POST на уровне клиента выполнялся бы и после таймаута, когда сервер мог уже
    // получить запрос, и умножал дубли на каждый уровень ретраев
  }

  async post<TResponse>(url: string, data: unknown): Promise<TResponse> {
    const method: Method = 'POST';
    const startedAt = Date.now();
    this.logger.debug(`-> ${method} ${url}`);

    try {
      const response = await this.client.request<TResponse>({ method, url, data });

      const duration = Date.now() - startedAt;

      this.logger.debug(`<- ${method} ${url} ${response.status.toString()} (${duration.toString()}ms)`);

      return response.data;
    } catch (error) {
      const duration = Date.now() - startedAt;

      this.logError(method, url, duration, error);

      throw error;
    }
  }

  private logError(method: Method, url: string, duration: number, error: unknown): void {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      this.logger.error(
        `<- ${method} ${url} ${status?.toString() ?? String(error)} duration=${duration.toString()}ms`,
        { code: error.code, status },
      );

      return;
    }

    this.logger.error(
      `<- ${method} ${url} UNKNOWN ERROR duration=${duration.toString()}ms`,
      error instanceof Error ? error.message : String(error),
    );
  }
}
