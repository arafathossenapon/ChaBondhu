import { createBrowserRouter } from "react-router";
import { AppShell } from "./shell";
import { NotFound, RouteLoading } from "./route-states";

import { AccountLanding, RoleRoute } from "../features/auth/access";

export const router = createBrowserRouter([
  {
    Component: AppShell,
    HydrateFallback: RouteLoading,
    children: [
      { index: true, lazy: () => import("./home") },
      {
        path: "login",
        lazy: async () => ({
          Component: (await import("../features/auth/account-pages")).LoginPage,
        }),
      },
      {
        path: "register",
        lazy: async () => ({
          Component: (await import("../features/auth/account-pages"))
            .RegistrationPage,
        }),
      },
      {
        path: "grower",
        element: <RoleRoute role="GROWER" />,
        children: [
          {
            index: true,
            lazy: async () => {
              const { ProfilePage } =
                await import("../features/profiles/profile-page");
              return { Component: () => <ProfilePage kind="grower" /> };
            },
          },
        ],
      },
      {
        path: "factory",
        element: <RoleRoute role="FACTORY" />,
        children: [
          {
            index: true,
            lazy: async () => {
              const { ProfilePage } =
                await import("../features/profiles/profile-page");
              return { Component: () => <ProfilePage kind="factory" /> };
            },
          },
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
