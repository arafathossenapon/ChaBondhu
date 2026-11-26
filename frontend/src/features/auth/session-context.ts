import { createContext, useContext } from "react";
import { apiRequest } from "../../shared/api/client";
import type { z } from "zod";
import type { accountSchema, loginSchema } from "./contracts";

export type Session = {
  token: string;
  account: z.infer<typeof accountSchema>;
  expiresAt: number;
};
type Auth = {
  session: Session | null;
  notice: string;
  signIn: (input: z.infer<typeof loginSchema>) => Promise<void>;
  signOut: () => void;
  request: <T>(
    path: string,
    options?: Parameters<typeof apiRequest>[1],
  ) => Promise<T>;
};
export const SessionContext = createContext<Auth | null>(null);
export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error("SessionProvider is missing");
  return value;
}
