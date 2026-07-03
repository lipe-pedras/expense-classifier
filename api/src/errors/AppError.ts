export type AppErrorCode =
  | 'AUTH_INVALID_CREDENTIALS'
  | 'AUTH_TOKEN_EXPIRED'
  | 'AUTH_TOKEN_INVALID'
  | 'AUTH_REFRESH_TOKEN_INVALID'
  | 'USER_NOT_FOUND'
  | 'USER_EMAIL_TAKEN'
  | 'USER_USERNAME_TAKEN'
  | 'USER_CONFIRMATION_MISMATCH'
  | 'DOCUMENT_NOT_FOUND'
  | 'DOCUMENT_UPLOAD_FAILED'
  | 'DOCUMENT_UNSUPPORTED_TYPE'
  | 'DOCUMENT_TOO_LARGE'
  | 'EXPENSE_NOT_FOUND'
  | 'CATEGORY_NOT_FOUND'
  | 'CATEGORY_SYSTEM_DELETE'
  | 'CATEGORY_SYSTEM_MODIFY'
  | 'CATEGORY_SLUG_TAKEN'
  | 'CATEGORY_NAME_TAKEN'
  | 'CHART_UNSUPPORTED'
  | 'CHART_GENERATION_FAILED'
  | 'INTERNAL_ERROR';

export class AppError extends Error {
  public readonly code: AppErrorCode;
  public readonly statusCode: number;

  constructor(code: AppErrorCode, message: string, statusCode: number) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
  }

  toJSON() {
    return { error: { code: this.code, message: this.message } };
  }
}

export class AuthInvalidCredentialsError extends AppError {
  constructor(message = 'Invalid email or password') {
    super('AUTH_INVALID_CREDENTIALS', message, 401);
  }
}

export class AuthTokenExpiredError extends AppError {
  constructor(message = 'Authentication token has expired') {
    super('AUTH_TOKEN_EXPIRED', message, 401);
  }
}

export class AuthTokenInvalidError extends AppError {
  constructor(message = 'Authentication token is invalid') {
    super('AUTH_TOKEN_INVALID', message, 401);
  }
}

export class AuthRefreshTokenInvalidError extends AppError {
  constructor(message = 'Refresh token is invalid or expired') {
    super('AUTH_REFRESH_TOKEN_INVALID', message, 401);
  }
}

export class UserNotFoundError extends AppError {
  constructor(message = 'User not found') {
    super('USER_NOT_FOUND', message, 404);
  }
}

export class UserEmailTakenError extends AppError {
  constructor(message = 'Email already registered') {
    super('USER_EMAIL_TAKEN', message, 409);
  }
}

export class UserUsernameTakenError extends AppError {
  constructor(message = 'Username already taken') {
    super('USER_USERNAME_TAKEN', message, 409);
  }
}

export class UserConfirmationMismatchError extends AppError {
  constructor(message = 'Confirmation does not match your username') {
    super('USER_CONFIRMATION_MISMATCH', message, 400);
  }
}

export class DocumentNotFoundError extends AppError {
  constructor(message = 'Document not found') {
    super('DOCUMENT_NOT_FOUND', message, 404);
  }
}

export class DocumentUploadFailedError extends AppError {
  constructor(message = 'Document upload failed') {
    super('DOCUMENT_UPLOAD_FAILED', message, 500);
  }
}

export class DocumentUnsupportedTypeError extends AppError {
  constructor(message = 'Unsupported document type') {
    super('DOCUMENT_UNSUPPORTED_TYPE', message, 415);
  }
}

export class DocumentTooLargeError extends AppError {
  constructor(message = 'Document exceeds maximum file size') {
    super('DOCUMENT_TOO_LARGE', message, 413);
  }
}

export class ExpenseNotFoundError extends AppError {
  constructor(message = 'Expense not found') {
    super('EXPENSE_NOT_FOUND', message, 404);
  }
}

export class CategoryNotFoundError extends AppError {
  constructor(message = 'Category not found') {
    super('CATEGORY_NOT_FOUND', message, 404);
  }
}

export class CategorySystemDeleteError extends AppError {
  constructor(message = 'System categories cannot be deleted') {
    super('CATEGORY_SYSTEM_DELETE', message, 403);
  }
}

export class CategorySystemModifyError extends AppError {
  constructor(message = 'System categories cannot be modified') {
    super('CATEGORY_SYSTEM_MODIFY', message, 403);
  }
}

export class CategorySlugTakenError extends AppError {
  constructor(message = 'Category slug already exists for this user') {
    super('CATEGORY_SLUG_TAKEN', message, 409);
  }
}

export class CategoryNameTakenError extends AppError {
  constructor(message = 'Category name already exists for this user') {
    super('CATEGORY_NAME_TAKEN', message, 409);
  }
}

export class ChartUnsupportedError extends AppError {
  constructor(message = "Could not turn that request into a chart. Try naming a measure (total, count, average), a grouping (category, month, vendor, currency), and a period.") {
    super('CHART_UNSUPPORTED', message, 422);
  }
}

export class ChartGenerationFailedError extends AppError {
  constructor(message = 'Chart generation timed out or failed. Please try again.') {
    super('CHART_GENERATION_FAILED', message, 503);
  }
}

export class InternalError extends AppError {
  constructor(message = 'Internal server error') {
    super('INTERNAL_ERROR', message, 500);
  }
}
