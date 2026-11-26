import { createBrowserRouter } from "react-router";
import { AppShell } from "./shell";
import { NotFound, RouteLoading } from "./route-states";
import { LoginPage, RegistrationPage } from "../features/auth/account-pages";
import { AccountLanding, RoleRoute } from "../features/auth/access";

export const router = createBrowserRouter([
  {
    Component: AppShell,
    HydrateFallback: RouteLoading,
    children: [
      { index: true, lazy: () => import("./home") },
      { path: "login", Component: LoginPage },
      { path: "register", Component: RegistrationPage },
      {
        path: "grower",
        element: <RoleRoute role="GROWER" />,
        children: [
          { index: true, element: <AccountLanding title="Grower account" /> },
        ],
      },
      {
        path: "factory",
        element: <RoleRoute role="FACTORY" />,
        children: [
          { index: true, element: <AccountLanding title="Factory account" /> },
        ],
      },
      {
        path: "admin",
        element: <RoleRoute role="ADMIN" />,
        children: [
          { index: true, element: <AccountLanding title="Admin account" /> },
        ],
      },
      { path: "*", Component: NotFound },
    ],
  },
]);
