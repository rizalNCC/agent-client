import { AiAgentApiError, AiAgentClientError } from "./errors";
import type { AiAgentClientConfig, RequestOptions, RetryOptions } from "./types";

const DEFAULT_RETRY_ON_STATUSES = [408, 429, 500, 502, 503, 504];

function normalizeBaseUrl(baseUrl: string): string {
  if (!baseUrl || typeof baseUrl !== "string") {
    throw new AiAgentClientError("baseUrl is required.", "invalid_config");
  }
  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
}

function normalizePath(path: string): string {
  if (!path) {
    return "";
  }
  return path.startsWith("/") ? path : `/${path}`;
}

function buildUrl(baseUrl: string, path: string): string {
  return `${normalizeBaseUrl(baseUrl)}${normalizePath(path)}`;
}

function mergeHeaders(defaultHeaders?: HeadersInit, requestHeaders?: HeadersInit): Headers {
  const headers = new Headers(defaultHeaders || undefined);
  if (requestHeaders) {
    const incoming = new Headers(requestHeaders);
    incoming.forEach((value, key) => headers.set(key, value));
  }
  return headers;
}

async function resolveAccessToken(
  provider: AiAgentClientConfig["getAccessToken"]
): Promise<string | undefined> {
  if (!provider) {
    return undefined;
  }
  if (typeof provider === "string") {
    return provider;
  }
  return provider();
}

function setupAbortController(
  optionsSignal?: AbortSignal,
  timeoutMs?: number
): { controller: AbortController; cleanup: () => void } {
  const controller = new AbortController();
  const onAbort = () => controller.abort();

  if (optionsSignal) {
    if (optionsSignal.aborted) {
      controller.abort();
    } else {
      optionsSignal.addEventListener("abort", onAbort);
    }
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  if (timeoutMs && timeoutMs > 0) {
    timer = setTimeout(() => controller.abort(), timeoutMs);
  }

  return {
    controller,
    cleanup: () => {
      if (optionsSignal) {
        optionsSignal.removeEventListener("abort", onAbort);
      }
      if (timer) {
        clearTimeout(timer);
      }
    }
  };
}

function sanitizeNonNegativeInt(value: number | undefined, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return fallback;
  }
  return Math.floor(value);
}

interface ResolvedRetryOptions {
  retries: number;
  backoffMs: number;
  maxBackoffMs: number;
  retryOnStatuses: number[];
  retryOnNetworkError: boolean;
}

function resolveRetryOptions(
  method: "GET" | "POST",
  configRetry?: RetryOptions,
  requestRetry?: RetryOptions | false
): ResolvedRetryOptions {
  if (requestRetry === false) {
    return {
      retries: 0,
      backoffMs: 0,
      maxBackoffMs: 0,
      retryOnStatuses: DEFAULT_RETRY_ON_STATUSES,
      retryOnNetworkError: false
    };
  }

  const methodDefaults: Required<RetryOptions> = {
    retries: method === "GET" ? 2 : 0,
    backoffMs: 250,
    maxBackoffMs: 2000,
    retryOnStatuses: DEFAULT_RETRY_ON_STATUSES,
    retryOnNetworkError: true
  };

  const merged = {
    ...methodDefaults,
    ...(configRetry || {}),
    ...(requestRetry || {})
  };

  return {
    retries: sanitizeNonNegativeInt(merged.retries, methodDefaults.retries),
    backoffMs: sanitizeNonNegativeInt(merged.backoffMs, methodDefaults.backoffMs),
    maxBackoffMs: sanitizeNonNegativeInt(merged.maxBackoffMs, methodDefaults.maxBackoffMs),
    retryOnStatuses: Array.isArray(merged.retryOnStatuses)
      ? merged.retryOnStatuses
      : DEFAULT_RETRY_ON_STATUSES,
    retryOnNetworkError: Boolean(merged.retryOnNetworkError)
  };
}

function computeBackoffDelay(retryAttempt: number, backoffMs: number, maxBackoffMs: number): number {
  if (backoffMs <= 0 || maxBackoffMs <= 0) {
    return 0;
  }
  const delay = backoffMs * 2 ** Math.max(0, retryAttempt - 1);
  return Math.min(delay, maxBackoffMs);
}

async function waitForRetry(delayMs: number, signal: AbortSignal): Promise<void> {
  if (delayMs <= 0) {
    return;
  }
  await new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(new AiAgentClientError("Request aborted or timed out.", "aborted"));
      return;
    }

    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, delayMs);

    const onAbort = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
      reject(new AiAgentClientError("Request aborted or timed out.", "aborted"));
    };

    signal.addEventListener("abort", onAbort, { once: true });
  });
}

async function parseResponseBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }
  try {
    return await response.text();
  } catch {
    return null;
  }
}

interface JsonRequestConfig {
  clientConfig: AiAgentClientConfig;
  method: "GET" | "POST";
  path: string;
  body?: unknown;
  options?: RequestOptions;
}

function normalizeRequestError(error: unknown): AiAgentClientError {
  if (error instanceof AiAgentApiError || error instanceof AiAgentClientError) {
    return error;
  }
  if (error instanceof Error && error.name === "AbortError") {
    return new AiAgentClientError("Request aborted or timed out.", "aborted");
  }
  if (error instanceof TypeError) {
    return new AiAgentClientError(error.message || "Network request failed.", "network_error");
  }
  if (error instanceof Error) {
    return new AiAgentClientError(error.message, "request_error");
  }
  return new AiAgentClientError("Unexpected request error.", "request_error");
}

export async function requestJson<T>({
  clientConfig,
  method,
  path,
  body,
  options
}: JsonRequestConfig): Promise<T> {
  const fetchImpl = clientConfig.fetchImpl || fetch;
  if (typeof fetchImpl !== "function") {
    throw new AiAgentClientError("fetch implementation is not available.", "fetch_unavailable");
  }

  const headers = mergeHeaders(clientConfig.defaultHeaders, options?.headers);
  headers.set("Accept", "application/json");

  const token = await resolveAccessToken(clientConfig.getAccessToken);
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const hasBody = body !== undefined;
  if (hasBody && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const serializedBody = hasBody ? JSON.stringify(body) : undefined;

  const timeoutMs = options?.timeoutMs ?? clientConfig.timeoutMs;
  const retry = resolveRetryOptions(method, clientConfig.retry, options?.retry);
  const { controller, cleanup } = setupAbortController(options?.signal, timeoutMs);

  try {
    const maxAttempts = retry.retries + 1;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const response = await fetchImpl(buildUrl(clientConfig.baseUrl, path), {
          method,
          headers,
          signal: controller.signal,
          body: serializedBody
        });

        const parsed = await parseResponseBody(response);
        if (!response.ok) {
          const apiError = new AiAgentApiError(
            `Request failed with status ${response.status}`,
            response.status,
            parsed
          );

          const shouldRetry =
            attempt < maxAttempts && retry.retryOnStatuses.includes(response.status);
          if (!shouldRetry) {
            throw apiError;
          }

          const delayMs = computeBackoffDelay(attempt, retry.backoffMs, retry.maxBackoffMs);
          await waitForRetry(delayMs, controller.signal);
          continue;
        }

        return parsed as T;
      } catch (error) {
        const normalizedError = normalizeRequestError(error);

        if (normalizedError instanceof AiAgentApiError) {
          throw normalizedError;
        }

        if (normalizedError.code === "aborted") {
          throw normalizedError;
        }

        const shouldRetryNetworkError =
          attempt < maxAttempts &&
          retry.retryOnNetworkError &&
          normalizedError.code === "network_error";

        if (!shouldRetryNetworkError) {
          throw normalizedError;
        }

        const delayMs = computeBackoffDelay(attempt, retry.backoffMs, retry.maxBackoffMs);
        await waitForRetry(delayMs, controller.signal);
      }
    }
    throw new AiAgentClientError("Unexpected request flow.", "request_error");
  } finally {
    cleanup();
  }
}
