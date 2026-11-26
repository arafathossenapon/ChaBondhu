import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, Navigate, useLocation, useNavigate } from "react-router";
import { apiRequest } from "../../shared/api/client";
import { ApiError } from "../../shared/api/api-error";
import { FormField } from "../../shared/ui/form-field";
import { loginSchema, registrationSchema, roleHome } from "./contracts";
import { useSession } from "./session-context";

export function LoginPage() {
  const { session, signIn, notice } = useSession();
  const location = useLocation();
  const registeredEmail: string =
    typeof location.state?.registeredEmail === "string"
      ? location.state.registeredEmail
      : "";
  const form = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: registeredEmail,
      password: "",
    },
  });
  const [error, setError] = useState("");
  const { errors, isSubmitting } = form.formState;
  if (session) return <Navigate to={roleHome[session.account.role]} replace />;

  return (
    <section className="account-layout">
      <div className="account-intro">
        <h1>Sign in</h1>
        <p>
          Access your ChaBondhu account. You’ll sign in again after reloading or
          closing the page.
        </p>
      </div>
      <div className="account-card">
        {(registeredEmail || notice) && (
          <p role="status">
            {registeredEmail ? "Account created. Sign in to continue." : notice}
          </p>
        )}
        <form
          noValidate
          onSubmit={form.handleSubmit(async (body) => {
            setError("");
            try {
              await signIn(body);
            } catch (failure) {
              setError(
                failure instanceof ApiError
                  ? failure.message
                  : "Could not verify the sign-in response.",
              );
            }
          })}
        >
          <FormField
            label="Email address"
            type="email"
            autoComplete="username"
            error={errors.email?.message}
            {...form.register("email")}
          />
          <FormField
            label="Password"
            type="password"
            autoComplete="current-password"
            error={errors.password?.message}
            {...form.register("password")}
          />
          {error && (
            <p role="alert" className="field-error">
              {error}
            </p>
          )}
          <button className="button button-green" disabled={isSubmitting}>
            {isSubmitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p>
          New to ChaBondhu? <Link to="/register">Create an account</Link>
        </p>
      </div>
    </section>
  );
}

export function RegistrationPage() {
  const { session } = useSession();
  const navigate = useNavigate();
  const form = useForm({ resolver: zodResolver(registrationSchema) });
  const [error, setError] = useState("");
  const { errors, isSubmitting } = form.formState;
  if (session) return <Navigate to={roleHome[session.account.role]} replace />;

  return (
    <section className="account-layout">
      <div className="account-intro">
        <h1>Create an account</h1>
        <p>Join ChaBondhu as a tea grower or factory.</p>
      </div>
      <div className="account-card">
        <form
          noValidate
          onSubmit={form.handleSubmit(async (body) => {
            setError("");
            try {
              await apiRequest("/auth/register", { method: "POST", body });
              navigate("/login", {
                replace: true,
                state: { registeredEmail: body.email },
              });
            } catch (failure) {
              if (failure instanceof ApiError && failure.status === 409)
                form.setError(
                  "email",
                  { message: failure.message },
                  { shouldFocus: true },
                );
              else
                setError(
                  failure instanceof ApiError
                    ? failure.message
                    : "Could not create the account.",
                );
            }
          })}
        >
          <FormField
            label="Full name"
            autoComplete="name"
            error={errors.fullName?.message}
            {...form.register("fullName")}
          />
          <FormField
            label="Email address"
            type="email"
            autoComplete="email"
            error={errors.email?.message}
            {...form.register("email")}
          />
          <FormField
            label="Phone number"
            type="tel"
            autoComplete="tel"
            error={errors.phoneNumber?.message}
            {...form.register("phoneNumber")}
          />
          <FormField
            label="Password"
            type="password"
            autoComplete="new-password"
            error={errors.password?.message}
            {...form.register("password")}
          />
          <div className="form-field">
            <label htmlFor="account-role">Account type</label>
            <select
              id="account-role"
              aria-invalid={!!errors.role}
              aria-describedby={errors.role ? "account-role-error" : undefined}
              defaultValue=""
              {...form.register("role")}
            >
              <option value="" disabled>
                Choose an account type
              </option>
              <option value="GROWER">Grower</option>
              <option value="FACTORY">Factory</option>
            </select>
            {errors.role && (
              <p id="account-role-error" className="field-error">
                {errors.role.message}
              </p>
            )}
          </div>
          {error && (
            <p role="alert" className="field-error">
              {error}
            </p>
          )}
          <button className="button button-green" disabled={isSubmitting}>
            {isSubmitting ? "Creating account…" : "Create account"}
          </button>
        </form>
        <p>
          Already registered? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </section>
  );
}
