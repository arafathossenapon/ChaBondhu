import { ApiError, getHttpErrorMessage } from "./api-error";

type QueryValue = string | number | boolean;
type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  query?: Record<string, QueryValue | null | undefined>;
  body?: unknown;
  token?: string;
  idempotencyKey?: string;
  signal?: AbortSignal;
};

export function createApiClient(baseUrl: string | undefined, origin: string) {
  const base = resolveBase(baseUrl, origin);

  return async function request<T>(
    path: string,
    options: RequestOptions = {},
  ): Promise<T> {
    if (!path.startsWith("/") || path.startsWith("//") || /[\\?#]/.test(path)) {
      throw new ApiError(
        "configuration",
        "API paths must be absolute within the API base.",
      );
    }

    const url = new URL(path.slice(1), base);
    if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) {
      throw new ApiError(
        "configuration",
        "API path is outside the configured base.",
      );
    }

    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (value !== null && value !== undefined)
        url.searchParams.set(key, String(value));
    }

    const headers = new Headers({ Accept: "application/json" });
    if (options.token) headers.set("Authorization", `Bearer ${options.token}`);
    if (options.idempotencyKey)
      headers.set("Idempotency-Key", options.idempotencyKey);
    const body =
      options.body === undefined ? undefined : JSON.stringify(options.body);
    if (body !== undefined) headers.set("Content-Type", "application/json");

    let response: Response;
    try {
      response = await fetch(url, {
        method: options.method ?? "GET",
        headers,
        body,
        signal: options.signal,
        credentials: "omit",
        redirect: "error",
      });
    } catch (cause) {
      if (options.signal?.aborted) throw cause;
      throw new ApiError("network", "Could not reach the ChaBondhu API.", {
        cause,
      });
    }

    let payload: unknown;
    try {
      if (response.status !== 204 && response.status !== 205) {
        payload = await response.json();
      }
    } catch (cause) {
      if (options.signal?.aborted) throw cause;
      if (response.ok) {
        throw new ApiError(
          "response",
          "The API returned an invalid JSON response.",
          {
            status: response.status,
            cause,
          },
        );
      }
    }

    if (!response.ok) {
      throw new ApiError(
        "http",
        getHttpErrorMessage(payload, response.status),
        {
          status: response.status,
          details: payload,
        },
      );
    }

    return payload as T;
  };
}

function resolveBase(value: string | undefined, origin: string): URL {
  const configured = value?.trim();
  if (
    !configured ||
    !/^(https?:\/\/|\/(?!\/))/i.test(configured) ||
    configured.includes("\\")
  ) {
    throw new ApiError(
      "configuration",
      "Set VITE_API_BASE_URL to an HTTP(S) URL or a same-origin path.",
    );
  }

  try {
    const base = new URL(configured, origin);
    if (
      !["http:", "https:"].includes(base.protocol) ||
      base.username ||
      base.password ||
      base.search ||
      base.hash
    ) {
      throw new Error("Unsupported API base URL");
    }
    if (!base.pathname.endsWith("/")) base.pathname += "/";
    return base;
  } catch (cause) {
    throw new ApiError("configuration", "VITE_API_BASE_URL is invalid.", {
      cause,
    });
  }
}

export async function apiRequest<T>(
  path: string,
  options?: RequestOptions,
): Promise<T> {
  const request = createApiClient(
    import.meta.env.VITE_API_BASE_URL,
    window.location.origin,
  );
  return request<T>(path, options);
}
