import type { AddressInfo, Server } from 'node:net';

import type { AddressObject } from 'mailparser';
import { simpleParser } from 'mailparser';
import { SMTPServer } from 'smtp-server';

export interface SmtpMessage {
  from: string;
  to: string;
  subject: string;
  text: string;
}

export interface SmtpSink {
  port: number;
  messages: SmtpMessage[];
  close(): Promise<void>;
}

const addressText = (value: AddressObject | AddressObject[] | undefined): string =>
  Array.isArray(value) ? (value[0]?.text ?? '') : (value?.text ?? '');

/**
 * Локальный SMTP-сервер, записывающий все приходящие письма.
 * Используется как почтовый сервер для email delivery-адаптера: клиент делает
 * настоящую SMTP-сессию через nodemailer, а тест контролирует доставку по
 * содержимому `messages` (письма парсятся через mailparser).
 */
export function startSmtpSink(): Promise<SmtpSink> {
  const messages: SmtpMessage[] = [];

  const server = new SMTPServer({
    authOptional: true,
    disabledCommands: ['STARTTLS'],
    // nodemailer шлёт AUTH, если в транспорте заданы креды, поэтому синк
    // принимает любые: проверка аутентификации не входит в сценарий теста
    onAuth: (auth, session, callback) => {
      callback(null, { user: auth.username });
    },
    onData: (stream, session, callback) => {
      const chunks: Buffer[] = [];

      stream.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });

      stream.on('end', () => {
        // callback вызывается после парсинга: в противном случае close()
        // может оборвать обработку последнего письма
        void simpleParser(Buffer.concat(chunks))
          .then((parsed) => {
            messages.push({
              from: addressText(parsed.from),
              to: addressText(parsed.to),
              subject: parsed.subject ?? '',
              text: parsed.text ?? '',
            });
          })
          .finally(() => {
            callback();
          });
      });
    },
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      // SMTPServer не наследует net.Server: реальный слушатель лежит в поле server,
      // а сам класс не типизирует адрес
      const { port } = (server as unknown as { server: Server }).server.address() as AddressInfo;

      resolve({
        port,
        messages,
        close: () =>
          new Promise((done) => {
            server.close(() => {
              done();
            });
          }),
      });
    });
  });
}
