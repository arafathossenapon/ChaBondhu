import { createBrowserRouter } from "react-router";
import { AppShell } from "./shell";
import { AccountEntry, NotFound, RouteLoading } from "./route-states";

export const router = createBrowserRouter([
  {
    Component: AppShell,
    HydrateFallback: RouteLoading,
    children: [
      { index: true, lazy: () => import("./home") },
      { path: "login", element: <AccountEntry title="Sign in" /> },
      { path: "register", element: <AccountEntry title="Create an account" /> },
      { path: "*", Component: NotFound },
    ],
  },
]);
