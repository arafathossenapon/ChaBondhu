import * as Dialog from "@radix-ui/react-dialog";
import { Link, Outlet } from "react-router";
import { Brand } from "../shared/ui/brand";

const links = [
  { href: "/#growers", label: "For growers" },
  { href: "/#factories", label: "For factories" },
];

export function AppShell() {
  return (
    <>
      <a className="skip-link" href="#content">
        Skip to content
      </a>
      <header className="site-header">
        <div className="site-width header-inner">
          <Brand />
          <nav className="desktop-nav" aria-label="Main navigation">
            {links.map(({ href, label }) => (
              <a key={href} href={href}>
                {label}
              </a>
            ))}
          </nav>
          <div className="desktop-nav account-links">
            <Link to="/login">Sign in</Link>
            <Link className="button button-green" to="/register">
              Get started <span aria-hidden="true">↗</span>
            </Link>
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
                  {links.map(({ href, label }) => (
                    <Dialog.Close key={href} asChild>
                      <a href={href}>{label}</a>
                    </Dialog.Close>
                  ))}
                  <Dialog.Close asChild>
                    <Link to="/login">Sign in</Link>
                  </Dialog.Close>
                  <Dialog.Close asChild>
                    <Link className="button button-green" to="/register">
                      Get started
                    </Link>
                  </Dialog.Close>
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
