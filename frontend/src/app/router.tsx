import { createBrowserRouter, Navigate } from "react-router";
import { AppShell } from "./shell";
import { NotFound, RouteLoading } from "./route-states";

import {
  AccountLanding,
  RoleRoute,
  SignedInRoute,
} from "../features/auth/access";

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
          {
            lazy: async () => ({
              Component: (await import("../features/grower/dashboard"))
                .GrowerWorkspace,
            }),
            children: [
              {
                path: "dashboard",
                lazy: async () => ({
                  Component: (await import("../features/grower/dashboard"))
                    .Dashboard,
                }),
              },
              {
                path: "listings",
                lazy: async () => ({
                  Component: (await import("../features/grower/dashboard"))
                    .ManageListings,
                }),
              },
              {
                path: "listings/new",
                lazy: async () => ({
                  Component: (await import("../features/grower/edit-page"))
                    .CreateListingPage,
                }),
              },
              {
                path: "listings/:id/edit",
                lazy: async () => ({
                  Component: (await import("../features/grower/edit-page"))
                    .EditListingPage,
                }),
              },
              {
                path: "listings/:id",
                lazy: async () => ({
                  Component: (await import("../features/grower/detail"))
                    .GrowerListingDetail,
                }),
              },
            ],
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
          {
            lazy: async () => ({
              Component: (await import("../features/factory/dashboard"))
                .FactoryWorkspace,
            }),
            children: [
              {
                path: "dashboard",
                lazy: async () => ({
                  Component: (await import("../features/factory/dashboard"))
                    .FactoryDashboard,
                }),
              },
              {
                path: "requests/new",
                lazy: async () => ({
                  Component: (await import("../features/orders/submit"))
                    .SubmitRequestPage,
                }),
              },
              {
                path: "procurement",
                lazy: async () => ({
                  Component: (await import("../features/factory/procurement"))
                    .ProcurementPage,
                }),
              },
              {
                path: "offers",
                lazy: async () => ({
                  Component: (await import("../features/factory/owned-offers"))
                    .OwnedOffersPage,
                }),
              },
            ],
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
      {
        path: "marketplace",
        Component: SignedInRoute,
        children: [
          { index: true, Component: NavigateToListings },
          {
            path: "offers",
            lazy: async () => ({
              Component: (await import("../features/marketplace/offers-page"))
                .OffersPage,
            }),
          },
          {
            path: "offers/:id",
            lazy: async () => ({
              Component: (await import("../features/marketplace/offer-detail"))
                .OfferDetail,
            }),
          },
          {
            path: "listings",
            lazy: async () => ({
              Component: (await import("../features/marketplace/listings-page"))
                .ListingsPage,
            }),
          },
          {
            path: "listings/:id",
            lazy: async () => ({
              Component: (
                await import("../features/marketplace/listing-detail")
              ).ListingDetail,
            }),
          },
        ],
      },
      { path: "*", Component: NotFound },
    ],
  },
]);

function NavigateToListings() {
  return <Navigate to="/marketplace/listings" replace />;
}
