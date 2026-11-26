import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ApiError } from "../../shared/api/api-error";
import { FormField } from "../../shared/ui/form-field";
import { useSession } from "../auth/session-context";
import {
  parseProfile,
  profileKinds,
  profileSchema,
  reviewHistory,
  type ProfileKind,
} from "./profile-contracts";

function errorMessage(error: unknown) {
  return error instanceof ApiError
    ? error.message
    : "Could not read or save the profile. Try again.";
}

export function ProfilePage({ kind }: { kind: ProfileKind }) {
  const { session, request } = useSession();
  const { path, title, fields } = profileKinds[kind];
  const client = useQueryClient();
  const key = ["profile", session?.account.id, kind] as const;
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState("");
  const profile = useQuery({
    queryKey: key,
    queryFn: async ({ signal }) => {
      try {
        return parseProfile(kind, await request(path + "/me", { signal }));
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) return null;
        throw error;
      }
    },
  });
  const status = profile.data?.status;
  const reviews = useQuery({
    queryKey: [...key, "reviews"],
    enabled: kind === "factory" && status === "REJECTED",
    queryFn: async ({ signal }) =>
      reviewHistory.parse(
        await request("/factory-profiles/me/verification-history", { signal }),
      ),
  });
  const resubmit = useMutation({
    mutationFn: async () =>
      parseProfile(
        "factory",
        await request("/factory-profiles/me/resubmit-verification", {
          method: "PATCH",
        }),
      ),
    onSuccess: (updated) => {
      client.setQueryData(key, updated);
      setNotice("Your profile was resubmitted for review.");
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 409)
        void client.invalidateQueries({ queryKey: key });
    },
  });

  async function save(body: Record<string, string>) {
    try {
      const update = !!profile.data;
      const result = parseProfile(
        kind,
        await request(update ? path + "/me" : path, {
          method: update ? "PATCH" : "POST",
          body,
        }),
      );
      client.setQueryData(key, result);
      setNotice("Profile saved.");
      setEditing(false);
    } catch (error) {
      if (error instanceof ApiError && error.status === 409)
        void client.invalidateQueries({ queryKey: key });
      throw error;
    }
  }

  return (
    <section className="account-layout">
      <div className="account-intro">
        <h1>{title}</h1>
        <p>
          {kind === "grower"
            ? "Tell us where you grow tea and the name of your garden."
            : "Set up your factory profile so an administrator can verify it."}
        </p>
      </div>
      <div className="account-card">
        {profile.isPending && <p role="status">Loading profile…</p>}
        {profile.isError && (
          <div>
            <p role="alert" className="field-error">
              {errorMessage(profile.error)}
            </p>
            <button
              className="button button-outline"
              onClick={() => void profile.refetch()}
            >
              Try again
            </button>
          </div>
        )}
        {notice && <p role="status">{notice}</p>}
        {profile.isSuccess && (
          <>
            <h2 className="text-xl font-bold">
              {profile.data ? "Profile complete" : "Complete your profile"}
            </h2>
            {!profile.data || editing ? (
              <ProfileForm
                kind={kind}
                initial={profile.data?.details}
                save={save}
                onCancel={editing ? () => setEditing(false) : undefined}
              />
            ) : (
              <div>
                <dl className="grid gap-3 sm:grid-cols-2">
                  {fields.map(({ name, label }) => (
                    <div key={name}>
                      <dt className="text-sm font-semibold">{label}</dt>
                      <dd>{profile.data?.details[name]}</dd>
                    </div>
                  ))}
                </dl>
                <button
                  className="button button-outline mt-4"
                  onClick={() => setEditing(true)}
                >
                  Edit profile
                </button>
              </div>
            )}
            {status && (
              <div className="space-y-2 border-t border-ink/15 pt-4">
                <h2 className="text-lg font-semibold">Factory verification</h2>
                {status === "PENDING" && (
                  <p>
                    <strong>Pending</strong> · Offer publishing and procurement
                    requests remain unavailable while your profile is under
                    review.
                  </p>
                )}
                {status === "VERIFIED" && (
                  <p>
                    <strong>Verified</strong> · Your factory profile was
                    approved.
                  </p>
                )}
                {status === "REJECTED" && (
                  <>
                    <p>
                      <strong>Rejected</strong> · Offer publishing and
                      procurement requests remain unavailable.
                    </p>
                    {reviews.isPending && (
                      <p role="status">Loading review decision…</p>
                    )}
                    {reviews.isError && (
                      <div>
                        <p role="alert" className="field-error">
                          {errorMessage(reviews.error)}
                        </p>
                        <button
                          className="button button-outline"
                          onClick={() => void reviews.refetch()}
                        >
                          Retry review lookup
                        </button>
                      </div>
                    )}
                    {reviews.data?.find(
                      (review) => review.decision === "REJECTED",
                    )?.reason && (
                      <p>
                        Reason:{" "}
                        {
                          reviews.data.find(
                            (review) => review.decision === "REJECTED",
                          )?.reason
                        }
                      </p>
                    )}
                    {resubmit.isError && (
                      <p role="alert" className="field-error">
                        {errorMessage(resubmit.error)}
                      </p>
                    )}
                    <button
                      className="button button-green"
                      disabled={resubmit.isPending || editing}
                      onClick={() => resubmit.mutate()}
                    >
                      {resubmit.isPending
                        ? "Resubmitting…"
                        : "Resubmit for review"}
                    </button>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function ProfileForm({
  kind,
  initial,
  save,
  onCancel,
}: {
  kind: ProfileKind;
  initial?: Record<string, string>;
  save: (body: Record<string, string>) => Promise<void>;
  onCancel?: () => void;
}) {
  const form = useForm({
    resolver: zodResolver(profileSchema(kind)),
    defaultValues: initial,
  });
  const { errors, isSubmitting } = form.formState;
  return (
    <form
      noValidate
      onSubmit={form.handleSubmit(async (values) => {
        form.clearErrors("root");
        try {
          await save(values);
        } catch (error) {
          form.setError("root", { message: errorMessage(error) });
        }
      })}
    >
      {profileKinds[kind].fields.map(({ name, label }) => (
        <FormField
          key={name}
          label={label}
          error={errors[name]?.message}
          {...form.register(name)}
        />
      ))}
      {errors.root?.message && (
        <p role="alert" className="field-error">
          {errors.root.message}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <button className="button button-green" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : "Save profile"}
        </button>
        {onCancel && (
          <button
            type="button"
            className="button button-outline"
            disabled={isSubmitting}
            onClick={onCancel}
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
