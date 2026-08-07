import type { RouteObject } from "react-router-dom";
import NotificationPage from "../pages/NotificationPage";

export const notificationRoutes: RouteObject[] = [
  {
    path: "/",
    element: <NotificationPage />,
  },
];

export default notificationRoutes;
