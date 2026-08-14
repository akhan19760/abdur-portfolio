import { createBrowserRouter } from "react-router"
import { HomeRoute } from "@/routes/home-route"

// Placeholder router: only the home route exists so far.
// The project-detail route (/projects/:projectId) will be added
// as its own proposed-and-confirmed step, per the route-design skill.
export const router = createBrowserRouter([{ path: "/", element: <HomeRoute /> }])
