export class ValidationError extends Error {
  readonly code = 'VALIDATION_ERROR';

  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends Error {
  readonly code = 'NOT_FOUND_ERROR';

  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends Error {
  readonly code = 'CONFLICT_ERROR';

  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
    Object.setPrototypeOf(this, ConflictError.prototype);
  }
}

export class InfraError extends Error {
  readonly code = 'INFRA_ERROR';

  constructor(message: string) {
    super(message);
    this.name = 'InfraError';
    Object.setPrototypeOf(this, InfraError.prototype);
  }
}

export type AppErrorType = ValidationError | NotFoundError | ConflictError | InfraError;

export class AppError extends Error {
  readonly code: string;
  readonly type: AppErrorType;

  constructor(error: AppErrorType) {
    super(error.message);
    this.name = 'AppError';
    this.code = error.code;
    this.type = error;
    Object.setPrototypeOf(this, AppError.prototype);
  }

  static isValidationError(error: unknown): error is ValidationError {
    return error instanceof ValidationError;
  }

  static isNotFoundError(error: unknown): error is NotFoundError {
    return error instanceof NotFoundError;
  }

  static isConflictError(error: unknown): error is ConflictError {
    return error instanceof ConflictError;
  }

  static isInfraError(error: unknown): error is InfraError {
    return error instanceof InfraError;
  }
}
