import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider, createBrowserRouter } from "react-router-dom";
import { App } from "./App";
import { BenchPage } from "./features/bench/BenchPage";
import { BriefPage } from "./features/brief/BriefPage";
import { CampaignsPage } from "./features/campaigns/CampaignsPage";
import { GapsPage } from "./features/gaps/GapsPage";
import { HomePage } from "./features/home/HomePage";
import { RecordPage } from "./features/intelligence/RecordPage";
import { TicketDetailPage } from "./features/inbox/TicketDetailPage";
import { InboxPage } from "./features/inbox/InboxPage";
import { LivePage } from "./features/live/LivePage";
import { ThemesPage } from "./features/themes/ThemesPage";
import "./globals.css";

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "live", element: <LivePage /> },
      { path: "inbox", element: <InboxPage /> },
      { path: "inbox/:id", element: <TicketDetailPage /> },
      { path: "intelligence/:ticketId", element: <RecordPage /> },
      { path: "gaps", element: <GapsPage /> },
      { path: "themes", element: <ThemesPage /> },
      { path: "campaigns", element: <CampaignsPage /> },
      { path: "brief", element: <BriefPage /> },
      { path: "bench", element: <BenchPage /> },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
