import { LayerEnum, ModuleEnum } from './enums';

export interface ExceptionInterface {
  layer: LayerEnum;
  module: ModuleEnum;
  error: string;
  message: string;
  details?: Record<string, unknown>;
}

export abstract class Exception extends Error implements ExceptionInterface {
  public abstract readonly module: ModuleEnum;
  public abstract readonly layer: LayerEnum;
  public readonly details?: Record<string, unknown>;

  public get error(): string {
    return this.constructor.name;
  }

  public get message(): string {
    return super.message || 'Internal Server Error';
  }

  constructor() {
    super();
    Object.setPrototypeOf(this, new.target.prototype);
  }

  public toJSON(): ExceptionInterface {
    return {
      layer: this.layer,
      module: this.module,
      error: this.error,
      message: this.message,
      ...(this.details && { details: this.details }),
    };
  }

  public toString(): string {
    return `[${this.module} ${this.layer}] ${this.error}: ${this.message}`;
  }

  static toJSON(exception: unknown): ExceptionInterface {
    return exception instanceof Exception
      ? exception.toJSON()
      : {
          layer: LayerEnum.UNKNOWN,
          module: ModuleEnum.UNKNOWN,
          error: exception instanceof Error ? exception.name : 'InternalServerError',
          message: exception instanceof Error ? exception.message : String(exception),
        };
  }
}

export abstract class DomainException extends Exception {
  public abstract readonly module: ModuleEnum;
  public readonly layer = LayerEnum.DOMAIN;
}

export abstract class ApplicationException extends Exception {
  public abstract readonly module: ModuleEnum;
  public readonly layer = LayerEnum.APPLICATION;
}

export abstract class InfrastructureException extends Exception {
  public abstract readonly module: ModuleEnum;
  public readonly layer = LayerEnum.INFRASTRUCTURE;
}
