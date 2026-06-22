import { createBrowserRouter, RouterProvider, Navigate } from "react-router-dom";
import { WorkspaceProvider } from "@/store/workspaces";
import { AppShell } from "@/shell/AppShell";
import { Home } from "@/screens/home/Home";
import { NewEvent } from "@/screens/new/NewEvent";
import { WorkspaceShell } from "@/routes/WorkspaceShell";
import { Workspace } from "@/routes/Workspace";
import { Board } from "@/routes/Board";
import { Doc } from "@/routes/Doc";
import { CaseView } from "@/screens/case/CaseView";
import { CasesList } from "@/screens/case/CasesList";

// 라우팅: / 홈(S1) · /new 기획 폼(S2) · /w/:id 워크스페이스(S3), 전역 셸 안에서.
const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <Home /> },
      { path: "new", element: <NewEvent /> },
      {
        path: "w/:id",
        element: <WorkspaceShell />,
        children: [
          { index: true, element: <Workspace /> },
          { path: "board", element: <Board /> },
          { path: "doc", element: <Doc /> },
        ],
      },
      { path: "cases", element: <CasesList /> },
      { path: "case/:id", element: <CaseView /> },
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
]);

export function App() {
  return (
    <WorkspaceProvider>
      <RouterProvider router={router} />
    </WorkspaceProvider>
  );
}
