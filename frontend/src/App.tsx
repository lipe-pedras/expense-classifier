import { useEffect, useRef } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { LoginPage } from '@/pages/LoginPage';
import { RegisterPage } from '@/pages/RegisterPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { CategoriesPage } from '@/pages/CategoriesPage';
import { ChartsPage } from '@/pages/ChartsPage';
import { ProfilePage } from '@/pages/ProfilePage';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function RedirectIfAuth({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return isAuthenticated ? <Navigate to="/" replace /> : <>{children}</>;
}

/**
 * Wipes the React Query cache whenever the authenticated identity changes.
 * Query keys (['documents'], ['expenses'], …) are not user-scoped, so without
 * this the next user briefly sees the previous user's cached data on login
 * until a refetch — clearing on identity change fixes that without a reload.
 */
function useClearCacheOnUserChange() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const previousUserId = useRef(userId);

  useEffect(() => {
    if (previousUserId.current !== userId) {
      previousUserId.current = userId;
      queryClient.clear();
    }
  }, [userId, queryClient]);
}

export function App() {
  useClearCacheOnUserChange();

  return (
    <Routes>
      <Route
        path="/login"
        element={
          <RedirectIfAuth>
            <LoginPage />
          </RedirectIfAuth>
        }
      />
      <Route
        path="/register"
        element={
          <RedirectIfAuth>
            <RegisterPage />
          </RedirectIfAuth>
        }
      />
      <Route
        path="/"
        element={
          <RequireAuth>
            <DashboardPage />
          </RequireAuth>
        }
      />
      <Route
        path="/categories"
        element={
          <RequireAuth>
            <CategoriesPage />
          </RequireAuth>
        }
      />
      <Route
        path="/charts"
        element={
          <RequireAuth>
            <ChartsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/profile"
        element={
          <RequireAuth>
            <ProfilePage />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
