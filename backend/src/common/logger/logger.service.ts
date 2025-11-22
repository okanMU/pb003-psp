import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';

@Injectable()
export class LoggerService implements NestLoggerService {
  private context?: string;

  setContext(context: string) {
    this.context = context;
  }

  log(message: any, context?: string) {
    const timestamp = new Date().toISOString();
    const ctx = context || this.context || 'Application';
    console.log(`[${timestamp}] [LOG] [${ctx}] ${this.formatMessage(message)}`);
  }

  error(message: any, trace?: string, context?: string) {
    const timestamp = new Date().toISOString();
    const ctx = context || this.context || 'Application';
    console.error(
      `[${timestamp}] [ERROR] [${ctx}] ${this.formatMessage(message)}`,
    );
    if (trace) {
      console.error(`Stack trace: ${trace}`);
    }
  }

  warn(message: any, context?: string) {
    const timestamp = new Date().toISOString();
    const ctx = context || this.context || 'Application';
    console.warn(
      `[${timestamp}] [WARN] [${ctx}] ${this.formatMessage(message)}`,
    );
  }

  debug(message: any, context?: string) {
    if (process.env.NODE_ENV === 'production') return;

    const timestamp = new Date().toISOString();
    const ctx = context || this.context || 'Application';
    console.debug(
      `[${timestamp}] [DEBUG] [${ctx}] ${this.formatMessage(message)}`,
    );
  }

  verbose(message: any, context?: string) {
    if (process.env.NODE_ENV === 'production') return;

    const timestamp = new Date().toISOString();
    const ctx = context || this.context || 'Application';
    console.log(
      `[${timestamp}] [VERBOSE] [${ctx}] ${this.formatMessage(message)}`,
    );
  }

  private formatMessage(message: any): string {
    if (typeof message === 'string') {
      return message;
    }
    if (message instanceof Error) {
      return message.message;
    }
    return JSON.stringify(message);
  }
}
