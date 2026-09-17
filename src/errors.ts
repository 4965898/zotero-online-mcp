export class AppError extends Error {
  constructor(public code: string, message: string, public status = 400, public details?: unknown) { super(message); }
}
export function publicError(error: unknown) {
  if (error instanceof AppError) return { code: error.code, message: error.message, details: error.details };
  return { code: 'INTERNAL_ERROR', message: 'The operation failed. No credentials or upstream response bodies are included in this error.' };
}
