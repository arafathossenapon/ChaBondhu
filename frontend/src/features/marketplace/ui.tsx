import { Link, NavLink } from "react-router";
import { ApiError } from "../../shared/api/api-error";

const quantity = new Intl.NumberFormat("en-BD", { maximumFractionDigits: 3 });
const calendar = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export const kg = (value: number) => quantity.format(value) + " kg";
export const day = (value: string) => calendar.format(new Date(value));

export function MarketHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <header className="market-banner">
      <div className="site-width">
        <nav aria-label="Marketplace navigation">
          <NavLink end to="/marketplace/listings">
            Harvest listings
          </NavLink>
          <NavLink to="/marketplace/offers">Factory offers</NavLink>
        </nav>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
    </header>
  );
}

export function Status({ status }: { status: string }) {
  return (
    <span
      className={
        status === "ACTIVE"
          ? "market-badge market-badge-active"
          : "market-badge"
      }
    >
      {status.toLowerCase().replace(/^./, (letter) => letter.toUpperCase())}
    </span>
  );
}

export function LoadingCards() {
  return (
    <div
      role="status"
      aria-label="Loading marketplace results"
      className="market-grid"
    >
      {[1, 2, 3].map((id) => (
        <div
          key={id}
          aria-hidden="true"
          className="market-card h-44 animate-pulse bg-tea/10 motion-reduce:animate-none"
        />
      ))}
    </div>
  );
}

export function MarketError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  return (
    <div className="market-card space-y-3">
      <p role="alert">
        {error instanceof ApiError
          ? error.status === 403
            ? "You do not have access to these results."
            : error.message
          : "The marketplace could not load."}
      </p>
      <button className="button button-outline" type="button" onClick={retry}>
        Try again
      </button>
    </div>
  );
}

export function Pagination({
  page,
  totalPages,
  to,
}: {
  page: number;
  totalPages: number;
  to: (page: number) => string;
}) {
  if (totalPages <= 1 && page === 1) return null;
  return (
    <nav aria-label="Pagination" className="market-pagination">
      {page > 1 && (
        <Link
          className="button button-outline"
          to={to(Math.min(page - 1, Math.max(1, totalPages)))}
        >
          Previous page
        </Link>
      )}
      <span>
        Page {page} of {Math.max(1, totalPages)}
      </span>
      {page < totalPages && (
        <Link className="button button-outline" to={to(page + 1)}>
          Next page
        </Link>
      )}
    </nav>
  );
}
