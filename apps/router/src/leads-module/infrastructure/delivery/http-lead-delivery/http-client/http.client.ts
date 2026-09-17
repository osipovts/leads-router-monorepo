import { Inject, Logger } from '@nestjs/common';
import type { AxiosInstance, AxiosRequestConfig, Method } from 'axios';
import axios from 'axios';
import axiosRetry from 'axios-retry';

import { httpClientConfig, type HttpClientConfigType } from './http-client.config';
import type { HttpClientRequestConfig } from './http-client.types';

export class HttpClient {
  private readonly logger = new Logger(HttpClient.name);
  private readonly client: AxiosInstance;

  constructor(@Inject(httpClientConfig.KEY) config: HttpClientConfigType) {
    this.client = axios.create({
      timeout: config.timeout,
    });

    axiosRetry(this.client, {
      retries: config.retryCount,
      retryDelay: (retryCount, error) => axiosRetry.exponentialDelay(retryCount, error),
      retryCondition: (error) => {
        const isRetryable = axiosRetry.isNetworkOrIdempotentRequestError(error);
        const isRateLimited = error.response?.status === 429;

        return isRetryable || isRateLimited;
      },
    });
  }

  async get<TResponse>(url: string, config?: HttpClientRequestConfig): Promise<TResponse> {
    return this.request<TResponse>('GET', url, undefined, config);
  }

  async post<TResponse>(url: string, data?: unknown, config?: HttpClientRequestConfig): Promise<TResponse> {
    return this.request<TResponse>('POST', url, data, config);
  }

  async put<TResponse>(url: string, data?: unknown, config?: HttpClientRequestConfig): Promise<TResponse> {
    return this.request<TResponse>('PUT', url, data, config);
  }

  async patch<TResponse>(url: string, data?: unknown, config?: HttpClientRequestConfig): Promise<TResponse> {
    return this.request<TResponse>('PATCH', url, data, config);
  }

  async delete<TResponse>(url: string, config?: HttpClientRequestConfig): Promise<TResponse> {
    return this.request<TResponse>('DELETE', url, undefined, config);
  }

  private async request<TResponse>(
    method: Method,
    url: string,
    data?: unknown,
    config?: HttpClientRequestConfig,
  ): Promise<TResponse> {
    const requestConfig: AxiosRequestConfig = {
      method,
      url,
      data,
      ...config,
    };

    const startedAt = Date.now();
    this.logger.debug(`-> ${method} ${url}`);

    try {
      const response = await this.client.request<TResponse>(requestConfig);

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
      const responseData: unknown = error.response?.data;

      this.logger.error(
        `<- ${method} ${url} ${status?.toString() ?? String(error)} duration=${duration.toString()}ms`,
        responseData == true ? JSON.stringify(responseData) : error.message,
      );

      return;
    }

    this.logger.error(
      `<- ${method} ${url} UNKNOWN ERROR duration=${duration.toString()}ms`,
      error instanceof Error ? error.message : String(error),
    );
  }
}
