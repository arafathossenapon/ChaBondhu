import { useQuery } from "@tanstack/react-query";
import { ApiError } from "../../shared/api/api-error";
import { useSession } from "../auth/session-context";
import {
  parseProfile,
  profileKinds,
  type ProfileKind,
} from "./profile-contracts";

export function profileKey(id: number | undefined, kind: ProfileKind) {
  return ["profile", id, kind] as const;
}

export function useOwnProfile(kind: ProfileKind) {
  const { session, request } = useSession();
  return useQuery({
    queryKey: profileKey(session?.account.id, kind),
    queryFn: async ({ signal }) => {
      try {
        return parseProfile(
          kind,
          await request(profileKinds[kind].path + "/me", { signal }),
        );
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) return null;
        throw error;
      }
    },
  });
}
