type ApiError = {
  code?: string;
  message?: string;
  status?: number;
  response?: { status?: number };
};

const NETWORK_ERROR_CODES = new Set([
  "ERR_NETWORK",
  "ECONNABORTED",
  "ETIMEDOUT",
  "ECONNRESET",
  "EAI_AGAIN",
]);

export function isApiNotFound(error: unknown): boolean {
  const apiError = error as ApiError;
  const status = apiError?.response?.status ?? apiError?.status;
  const message = apiError?.message?.toLowerCase() || "";

  return (
    status === 404 ||
    message.includes("conteúdo não encontrado") ||
    message.includes("usuário não encontrado") ||
    message.includes("not found")
  );
}

export function isApiConflict(error: unknown): boolean {
  const apiError = error as ApiError;
  const status = apiError?.response?.status ?? apiError?.status;
  const message = apiError?.message?.toLowerCase() || "";

  return status === 409 || message.includes("já existe");
}

export function isRetryableApiError(error: unknown): boolean {
  const apiError = error as ApiError;
  const status = apiError?.response?.status ?? apiError?.status;

  if (status !== undefined) {
    return status === 408 || status === 425 || status === 429 || status >= 500;
  }

  const message = apiError?.message?.toLowerCase() || "";
  return (
    (!!apiError?.code && NETWORK_ERROR_CODES.has(apiError.code)) ||
    /network error|timed out|timeout|socket hang up|connection reset|connection refused/i.test(
      message
    )
  );
}

export async function withApiRetries<T>(
  operation: () => Promise<T>,
  shouldRetry: (error: unknown) => boolean = isRetryableApiError,
  maxAttempts = 3,
  baseDelayMs = 400
): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === maxAttempts || !shouldRetry(error)) {
        throw error;
      }

      await new Promise((resolve) =>
        setTimeout(resolve, baseDelayMs * 2 ** (attempt - 1))
      );
    }
  }

  throw new Error("A operação da API não foi concluída");
}
