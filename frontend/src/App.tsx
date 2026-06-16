import { createBrowserRouter, RouterProvider, Navigate } from "react-router-dom";
import { AppShell } from "@/shell/AppShell";
import { Home } from "@/routes/Home";
import { Workspace } from "@/routes/Workspace";

// 라우팅 (TASKS F0.2): / 홈 · /w/:id 워크스페이스, 전역 셸 안에서.
const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <Home /> },
      { path: "w/:id", element: <Workspace /> },
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
