import { afterEach, describe, expect, it, vi } from "vitest";
import { createApiClient, apiRequest } from "../../src/shared/api/client";

const origin = "https://app.example.com";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("frontend API client", () => {
  it("reads the configured environment base and encodes query values", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ data: [] }));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("window", { location: { origin } });
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example.com");
    await expect(
      apiRequest("/listings", {
        query: { teaGrade: "Green Leaf", page: 1, district: undefined },
      }),
    ).resolves.toEqual({ data: [] });
    const [url, options] = fetchMock.mock.calls[0];
    expect(url.href).toBe(
      "https://api.example.com/listings?teaGrade=Green+Leaf&page=1",
    );
    expect(options.credentials).toBe("omit");
    expect(options.headers.has("Authorization")).toBe(false);
  });

  it("sends a JSON body, JWT and idempotency key through a same-origin proxy", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(Response.json({ paymentId: 1 }, { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    const request = createApiClient("/backend", origin);
    const body = { method: "CASH", paymentDate: "2026-11-25" };
    await request("/payments/order/1/attempts", {
      method: "POST",
      token: "example-token",
      idempotencyKey: "example-key",
      body,
    });
    const [url, options] = fetchMock.mock.calls[0];
    expect(url.href).toBe(origin + "/backend/payments/order/1/attempts");
    expect(Object.fromEntries(options.headers)).toMatchObject({
      authorization: "Bearer example-token",
      "content-type": "application/json",
      "idempotency-key": "example-key",
    });
    expect(JSON.parse(options.body)).toEqual(body);
  });

  it("keeps the NestJS message and status on HTTP failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json(
            { statusCode: 400, message: "Bad Request Payload" },
            { status: 400 },
          ),
        ),
    );
    const request = createApiClient(origin, origin);
    await expect(
      request("/auth/login", { method: "POST" }),
    ).rejects.toMatchObject({
      kind: "http",
      status: 400,
      message: "Bad Request Payload",
    });
  });

  it("normalizes network errors without treating cancellation as an API error", async () => {
    const cause = new DOMException("The operation was aborted.", "AbortError");
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockRejectedValueOnce(cause);
    vi.stubGlobal("fetch", fetchMock);
    const request = createApiClient(origin, origin);
    await expect(request("/listings")).rejects.toMatchObject({
      kind: "network",
    });
    const signal = AbortSignal.abort();
    await expect(request("/listings", { signal })).rejects.toBe(cause);
  });

  it("rejects bad bases and paths before requests can leave the configured API", async () => {
    expect(() => createApiClient(undefined, origin)).toThrow(
      /VITE_API_BASE_URL/,
    );
    expect(() =>
      createApiClient("https://user:password@example.com", origin),
    ).toThrow(/invalid/);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const request = createApiClient("/backend", origin);
    await expect(request("//example.com/listings")).rejects.toMatchObject({
      kind: "configuration",
    });
    await expect(request("/../users/me")).rejects.toMatchObject({
      kind: "configuration",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("accepts empty success and flags non-JSON responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(new Response(null, { status: 204 }))
        .mockResolvedValueOnce(new Response("<html>wrong host</html>")),
    );
    const request = createApiClient(origin, origin);
    await expect(
      request<void>("/listings/1", { method: "DELETE" }),
    ).resolves.toBeUndefined();
    await expect(request("/listings")).rejects.toMatchObject({
      kind: "response",
      status: 200,
    });
  });
});
