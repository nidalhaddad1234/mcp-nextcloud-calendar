/**
 * Sanitizes error messages to avoid exposing implementation details
 * @param error The original error
 * @returns A sanitized error object with message and status code
 */
export function sanitizeError(error: unknown): { message: string; status: number } {
  // Default error response
  const defaultError = {
    message: 'An unexpected error occurred. Please try again later.',
    status: 500,
  };

  // If no error provided, return default
  if (!error) {
    return defaultError;
  }

  // Cast to Error if possible
  const err = error as Error;
  const errorMsg = err.message || '';

  // Authorization errors
  if (
    errorMsg.toLowerCase().includes('unauthorized') ||
    errorMsg.toLowerCase().includes('permission')
  ) {
    return {
      message: 'You do not have permission to perform this action.',
      status: 403,
    };
  }

  // Not found errors
  if (errorMsg.toLowerCase().includes('not found')) {
    return {
      message: 'The requested calendar was not found.',
      status: 404,
    };
  }

  // Lock errors
  if (errorMsg.toLowerCase().includes('locked')) {
    return {
      message: 'The calendar is currently locked. Please try again later.',
      status: 423,
    };
  }

  // Validation errors
  if (errorMsg.toLowerCase().includes('invalid') || errorMsg.toLowerCase().includes('required')) {
    return {
      message: 'Invalid request data. Please check your input and try again.',
      status: 400,
    };
  }

  // Default to generic server error
  return defaultError;
}
