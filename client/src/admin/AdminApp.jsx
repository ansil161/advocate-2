// The admin panel's root.
//
// Reached only through the lazy import in App.jsx, so none of this — nor the
// Django API client, nor Admin.css — is in the bundle a visitor downloads
// (§39).
//
// Note what is deliberately absent: Preloader, Cursor, PageReveal, Lenis and
// the chatbot widget. Those belong to the public site. Smooth-scrolling an
// admin table is actively worse than native scrolling, and a drawn cursor over
// a form is a liability rather than a flourish. The split happens in App.jsx
// before any of that mounts, which is also what guarantees the admin panel
// cannot interfere with the site's GSAP/ScrollTrigger setup.

import { Suspense, useEffect, useState } from 'react';

import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import './Admin.css';
import SlaLogo from '../components/ui/SlaLogo.jsx';
import Icon from '../components/ui/Icon.jsx';
import RequireAuth from './components/RequireAuth.jsx';
import { AdminAuthProvider, useAdminAuth } from './lib/useAdminAuth.jsx';
import Dashboard from './pages/Dashboard.jsx';
import KnowledgeEditor from './pages/KnowledgeEditor.jsx';
import KnowledgeList from './pages/KnowledgeList.jsx';
import Login from './pages/Login.jsx';
import System from './pages/System.jsx';
import Versions from './pages/Versions.jsx';

function Shell({ children }) {
  const { user, signOut } = useAdminAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="adm-shell">
      <header className="adm-mobile-header">
        <SlaLogo size="sm" />
        <button
          className="adm-mobile-toggle"
          onClick={() => setMobileOpen(o => !o)}
          aria-label="Toggle Navigation"
        >
          <Icon name={mobileOpen ? "close" : "menu"} />
        </button>
      </header>

      <aside className={`adm-sidebar ${mobileOpen ? 'is-mobile-open' : ''}`}>
        <div className="adm-brand">
          <SlaLogo size="sm" />
          <span className="adm-brand-tag">Admin Console</span>
        </div>

        <nav className="adm-nav" onClick={() => setMobileOpen(false)}>
          <NavLink to="/admin" end>
            <Icon name="grid" />
            <span>Dashboard</span>
          </NavLink>
          <NavLink to="/admin/knowledge">
            <Icon name="book" />
            <span>Knowledge Base</span>
          </NavLink>
          <NavLink to="/admin/system">
            <Icon name="sparkles" />
            <span>System Health</span>
          </NavLink>
          <a href="/" target="_blank" rel="noopener noreferrer" className="adm-nav-link-out">
            <Icon name="home" />
            <span>View Website</span>
          </a>
        </nav>

        <div className="adm-sidebar-foot">
          <div className="adm-user-badge">
            <div className="adm-user-avatar">
              {user?.username?.charAt(0)?.toUpperCase() || 'A'}
            </div>
            <div className="adm-user-info">
              <strong>{user?.username || 'Administrator'}</strong>
              <span className="adm-user-status"><i /> Active Session</span>
            </div>
          </div>
          <button className="adm-btn is-small is-ghost" onClick={signOut}>
            Sign Out
          </button>
        </div>
      </aside>

      <main className="adm-main">{children}</main>
    </div>
  );
}


/**
 * The panel's routes.
 *
 * `/admin/login` sits outside the shell and outside the guard: it has no
 * sidebar to render and no session to require. Everything else is wrapped in
 * RequireAuth, which redirects to the login page and remembers where it
 * interrupted.
 *
 * The guard is convenience, not security — it stops an administrator seeing a
 * dashboard that would fail every request. Every endpoint behind it is
 * independently guarded server-side, because the browser is the attacker's
 * machine and no check that runs here can be relied upon.
 */
function AdminRoutes() {
  return (
    <Routes>
      {/* Declared before the guarded tree so signing in is always reachable,
          including from a session that has just expired. */}
      <Route path="/admin/login" element={<Login />} />
      <Route
        path="/admin/*"
        element={
          <RequireAuth>
            <GuardedRoutes />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  );
}

function GuardedRoutes() {
  return (
    <Shell>
      {/*
        These paths are RELATIVE, and must stay that way.

        This <Routes> is rendered inside `<Route path="/admin/*">` above, so it
        matches against the *remaining* path after the parent consumed `/admin`
        — `evaluation`, not `/admin/evaluation`. Writing them absolutely, or
        re-adding a `<Route path="/admin">` wrapper here, makes every URL fall
        through to the catch-all below and silently bounce to the dashboard.
        The symptom is subtle and easy to misread: the panel works, the sidebar
        renders, and every deep link just quietly lands on /admin instead.
      */}
      <Routes>
        <Route index element={<Dashboard />} />
        <Route path="knowledge" element={<KnowledgeList />} />
        {/* Declared before :id so "new" is never parsed as a document id. */}
        <Route path="knowledge/new" element={<KnowledgeEditor />} />
        <Route path="knowledge/:id" element={<KnowledgeEditor />} />
        <Route path="knowledge/:id/versions" element={<Versions />} />
        <Route path="system" element={<System />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </Shell>
  );
}

export default function AdminApp() {
  // The public site's PageMeta component never mounts here, so without this the
  // tab keeps whatever SEO title index.html shipped with — an admin with
  // several tabs open cannot tell which is the panel. Restored on unmount so
  // navigating back to the site does not leave the admin title behind.
  useEffect(() => {
    const previous = document.title;
    document.title = 'SLA Advocates — Admin';
    return () => {
      document.title = previous;
    };
  }, []);

  return (
    <div className="adm-root">
      <AdminAuthProvider>
        <Suspense fallback={<div className="adm-empty">Loading…</div>}>
          <AdminRoutes />
        </Suspense>
      </AdminAuthProvider>
    </div>
  );
}
