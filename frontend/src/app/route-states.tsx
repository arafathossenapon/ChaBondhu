import { Link } from "react-router";

export function RouteLoading() {
  return (
    <p className="site-width route-state" role="status">
      Loading page…
    </p>
  );
}

export function NotFound() {
  return (
    <section className="site-width route-state">
      <h1>Page not found</h1>
      <p>Check the address or return to the ChaBondhu homepage.</p>
      <Link className="button button-green" to="/">
        Back to home
      </Link>
    </section>
  );
}

export function AccountEntry({ title }: { title: string }) {
  return (
    <section className="site-width route-state">
      <h1>{title}</h1>
      <p>Account access will be available in the next milestone.</p>
      <Link className="button button-green" to="/">
        Back to home
      </Link>
    </section>
  );
}
