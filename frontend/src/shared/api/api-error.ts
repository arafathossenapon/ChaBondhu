export type ApiErrorKind = "configuration" | "network" | "http" | "response";

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status?: number;
  readonly details?: unknown;

  constructor(
    kind: ApiErrorKind,
    message: string,
    options: { status?: number; details?: unknown; cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = "ApiError";
    this.kind = kind;
    this.status = options.status;
    this.details = options.details;
  }
}

export function getHttpErrorMessage(payload: unknown, status: number) {
  if (typeof payload === "object" && payload !== null && "message" in payload) {
    const message = payload.message;
    if (typeof message === "string" && message.trim()) return message;
    if (Array.isArray(message)) {
      const parts = message.filter(
        (part): part is string => typeof part === "string" && !!part.trim(),
      );
      if (parts.length) return parts.join(" ");
    }
  }

  return `Request failed (HTTP ${status}).`;
}
