import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Navigate, Route, Routes } from "react-router-dom";
import { BrowserRouter } from "react-router-dom";
import { api } from "./api/client";
import { Skeleton } from "./components/Skeleton";
import { ThemeProvider } from "./components/Theme";
import { ToastProvider } from "./components/Toast";
import { LandingPage, LoginPage, SignupPage } from "./features/auth/AuthPages";
import { DashboardPage } from "./features/dashboard/DashboardPage";
import { GroupPage } from "./features/group/GroupPage";
import { CreateGroupPage } from "./features/groups/CreateGroupPage";
import { JoinPage } from "./features/groups/JoinPage";
import { Shell } from "./features/shell/Shell";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
});

function RequireAuth() {
  const me = useQuery({ queryKey: ["me"], queryFn: api.me, retry: false });
  if (me.isLoading) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <Skeleton className="h-40" />
      </main>
    );
  }
  if (!me.data) {
    return <Navigate to="/login" replace />;
  }
  return <Shell user={me.data} />;
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ToastProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />
              <Route path="/join/:code" element={<JoinPage />} />
              <Route element={<RequireAuth />}>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/groups/new" element={<CreateGroupPage />} />
                <Route path="/groups/:groupId" element={<GroupPage />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
