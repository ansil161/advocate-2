// Session state for the admin panel.
//
// Context rather than a state library: the app already has none, the shared
// state here is one object and two functions, and §55 is explicit that a new
// dependency needs to earn its place. Everything else in the panel is local
// component state.
//
// The important property is that `user` is established by *asking the server*,
// not by trusting anything the browser kept. A panel that decides it is logged
// in because localStorage says so shows an admin a dashboard that then fails
// every request — and, worse, teaches them to expect that guard to mean
// something. The server is the only authority; this is a cache of its answer.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as api from './adminApi.js';

const AdminAuthContext = createContext(null);

export function AdminAuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // Distinct from `user === null`: "we have not asked yet" and "asked, nobody
  // is logged in" must render differently, or the login form flashes on every
  // reload for an already-authenticated admin.
  const [checking, setChecking] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const body = await api.currentUser();
      setUser(body?.is_authenticated ? body.user : null);
    } catch {
      // 401 is the expected answer when nobody is logged in, so it is a state,
      // not an error worth surfacing.
      setUser(null);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const signIn = useCallback(
    async (username, password) => {
      await api.login(username, password);
      // Re-asks the server rather than assuming the login response describes
      // the session — it is the same question the route guard will ask.
      await refresh();
    },
    [refresh]
  );

  const signOut = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      // Cleared even if the call failed: the intent was to end the session, and
      // leaving the panel looking authenticated after a failed logout is the
      // wrong direction to err in.
      setUser(null);
    }
  }, []);

  const value = useMemo(
    () => ({ user, checking, signIn, signOut, refresh }),
    [user, checking, signIn, signOut, refresh]
  );

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (!context) throw new Error('useAdminAuth must be used inside AdminAuthProvider');
  return context;
}
