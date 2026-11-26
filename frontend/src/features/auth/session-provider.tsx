import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../../shared/api/client";
import { ApiError } from "../../shared/api/api-error";
import { accountSchema, loginResponseSchema } from "./contracts";
import { SessionContext, type Session } from "./session-context";

function readExpiry(token: string): number {
  try {
    const parts = token.split(".");
    if (parts.length !== 3 || parts.some((part) => !part)) return 0;
    const payload: unknown = JSON.parse(
      atob(parts[1].replaceAll("-", "+").replaceAll("_", "/")),
    );
    if (
      typeof payload === "object" &&
      payload &&
      "exp" in payload &&
      typeof payload.exp === "number" &&
      Number.isFinite(payload.exp)
    )
      return payload.exp * 1000;
  } catch {
    return 0;
  }
  return 0;
}

export function SessionProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [notice, setNotice] = useState("");
  const current = useRef<Session | null>(null);
  const cache = useQueryClient();

  const endSession = useCallback(
    (message: string) => {
      current.current = null;
      setSession(null);
      setNotice(message);
      cache.clear();
    },
    [cache],
  );

  useEffect(() => {
    if (!session) return;
    const expire = () => {
      if (current.current === session)
        endSession("Your session expired. Sign in again.");
    };
    const timer = window.setTimeout(
      expire,
      Math.max(0, session.expiresAt - Date.now()),
    );
    return () => window.clearTimeout(timer);
  }, [session, endSession]);

  return (
    <SessionContext.Provider
      value={{
        session,
        notice,
        async signIn(body) {
          const result = loginResponseSchema.parse(
            await apiRequest("/auth/login", { method: "POST", body }),
          );
          const expiresAt = readExpiry(result.accessToken);
          if (expiresAt <= Date.now())
            throw new ApiError(
              "http",
              "The server returned an expired or invalid session.",
              { status: 401 },
            );
          const account = accountSchema.parse(
            await apiRequest("/users/me", { token: result.accessToken }),
          );
          if (account.id !== result.user.id || expiresAt <= Date.now())
            throw new ApiError(
              "response",
              "The session could not be verified.",
            );
          const next = { token: result.accessToken, account, expiresAt };
          cache.clear();
          current.current = next;
          setNotice("");
          setSession(next);
        },
        signOut: () => endSession("You signed out."),
        async request<T>(
          path: string,
          options?: Parameters<typeof apiRequest>[1],
        ) {
          const active = current.current;
          if (!active || active.expiresAt <= Date.now()) {
            if (active) endSession("Your session expired. Sign in again.");
            throw new ApiError("http", "Sign in to continue.", { status: 401 });
          }
          try {
            return await apiRequest<T>(path, {
              ...options,
              token: active.token,
            });
          } catch (error) {
            if (
              error instanceof ApiError &&
              error.status === 401 &&
              current.current === active
            ) {
              endSession("Your session ended. Sign in again.");
            }
            throw error;
          }
        },
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}
