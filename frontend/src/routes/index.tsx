import { createBrowserRouter } from "react-router-dom";
import notificationRoutes from "../modules/notifications/routes/notificationRoutes";

// Combine routes from various modules.
export const router = createBrowserRouter([
  ...notificationRoutes,
  // You can easily import and spread other module routes here as the app scales
]);

export default router;
