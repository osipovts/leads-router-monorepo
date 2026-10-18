import { Inject, Logger } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';

import { emailClientConfig, type EmailClientConfigType } from './email-client.config';

export class EmailClient {
  private readonly logger = new Logger(EmailClient.name);
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(@Inject(emailClientConfig.KEY) config: EmailClientConfigType) {
    this.transporter = createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: { user: config.user, pass: config.password },
      connectionTimeout: config.connectionTimeout,
      greetingTimeout: config.greetingTimeout,
      socketTimeout: config.socketTimeout,
    });
    this.from = config.from;
  }

  async sendMail(to: string, subject: string, text: string): Promise<void> {
    try {
      await this.transporter.sendMail({ from: this.from, to, subject, text });
    } catch (error: unknown) {
      this.logger.error(error);
      throw error;
    }
  }
}
