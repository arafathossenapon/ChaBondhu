import { Navigate, Outlet } from "react-router";
import { roleHome, type Role } from "./contracts";
import { useSession } from "./session-context";

export function RoleRoute({ role }: { role: Role }) {
  const { session } = useSession();
  if (!session) return <Navigate to="/login" replace />;
  if (session.account.role !== role)
    return <Navigate to={roleHome[session.account.role]} replace />;
  return <Outlet />;
}

export function AccountLanding({ title }: { title: string }) {
  const { session } = useSession();
  return (
    <section className="site-width route-state">
      <h1>{title}</h1>
      <p>Signed in as {session?.account.fullName}.</p>
    </section>
  );
}

export function SignedInRoute() {
  const { session } = useSession();
  return session ? <Outlet /> : <Navigate to="/login" replace />;
}
