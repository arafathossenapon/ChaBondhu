import { Link } from "react-router";

export function Brand() {
  return (
    <Link className="brand" to="/" aria-label="ChaBondhu home">
      <span className="brand-mark" aria-hidden="true">
        চা
      </span>
      ChaBondhu
    </Link>
  );
}
