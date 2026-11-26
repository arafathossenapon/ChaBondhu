import * as Dialog from "@radix-ui/react-dialog";
import { Link, Outlet } from "react-router";
import { Brand } from "../shared/ui/brand";

import { roleHome } from "../features/auth/contracts";
import { useSession } from "../features/auth/session-context";

const links = [
  { href: "/#growers", label: "For growers" },
  { href: "/#factories", label: "For factories" },
];

export function AppShell() {
  const { session, signOut } = useSession();
  const market = session && <Link to="/marketplace/listings">Marketplace</Link>;
  const own = session?.account.role === "GROWER" && (
    <Link to="/grower/listings">My listings</Link>
  );
  const account = session ? (
    <Link to={roleHome[session.account.role]}>My account</Link>
  ) : (
    <Link to="/login">Sign in</Link>
  );
  const action = session ? (
    <button className="button button-outline" type="button" onClick={signOut}>
      Sign out
    </button>
  ) : (
    <Link className="button button-green" to="/register">
      Get started
    </Link>
  );
  return (
    <>
      <a className="skip-link" href="#content">
        Skip to content
      </a>
      <header className="site-header">
        <div className="site-width header-inner">
          <Brand />
          <nav className="desktop-nav" aria-label="Main navigation">
            {session ? (
              <>
                {market}
                {own}
              </>
            ) : (
              links.map(({ href, label }) => (
                <a key={href} href={href}>
                  {label}
                </a>
              ))
            )}
          </nav>
          <div className="desktop-nav account-links">
            {account}
            {action}
          </div>
          <Dialog.Root>
            <Dialog.Trigger className="mobile-trigger button button-outline">
              Menu <span aria-hidden="true">☰</span>
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="menu-overlay" />
              <Dialog.Content
                className="menu-panel"
                aria-describedby={undefined}
              >
                <div className="flex items-center justify-between gap-4">
                  <Dialog.Title className="font-semibold">
                    Navigation
                  </Dialog.Title>
                  <Dialog.Close className="button button-outline">
                    Close
                  </Dialog.Close>
                </div>
                <nav className="mobile-links" aria-label="Main navigation">
                  {session ? (
                    <>
                      {market && <Dialog.Close asChild>{market}</Dialog.Close>}
                      {own && <Dialog.Close asChild>{own}</Dialog.Close>}
                    </>
                  ) : (
                    links.map(({ href, label }) => (
                      <Dialog.Close key={href} asChild>
                        <a href={href}>{label}</a>
                      </Dialog.Close>
                    ))
                  )}
                  <Dialog.Close asChild>{account}</Dialog.Close>
                  <Dialog.Close asChild>{action}</Dialog.Close>
                </nav>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        </div>
      </header>
      <main id="content" tabIndex={-1}>
        <Outlet />
      </main>
      <footer className="site-width site-footer">
        <Brand />
        <span>Tea leaf marketplace · Panchagarh, Bangladesh</span>
      </footer>
    </>
  );
}
