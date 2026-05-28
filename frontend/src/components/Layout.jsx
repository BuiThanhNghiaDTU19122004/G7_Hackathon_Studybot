import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, BookOpenCheck, Files, LayoutDashboard, Menu, Moon, RefreshCcw, Server, Sun } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import Sidebar from './Sidebar';
import { callApi, deleteDocument } from '../api';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'study', label: 'Study Room', icon: BookOpenCheck },
  { id: 'documents', label: 'Documents', icon: Files },
  { id: 'insights', label: 'Insights', icon: Activity },
];

const Layout = ({ children, selectedDoc, setSelectedDoc, activeView, setActiveView }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
  const [docs, setDocs] = useState([]);
  const [recent, setRecent] = useState([]);
  const [health, setHealth] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastSync, setLastSync] = useState('');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const refreshWorkspace = useCallback(async () => {
    setIsLoading(true);
    try {
      const [healthRes, docsRes, recentRes] = await Promise.allSettled([
        callApi('/health'),
        callApi('/docs/list'),
        callApi('/queries/recent'),
      ]);

      if (healthRes.status === 'fulfilled') setHealth(healthRes.value);
      if (docsRes.status === 'fulfilled') setDocs(docsRes.value.docs || []);
      if (recentRes.status === 'fulfilled') setRecent(recentRes.value.queries || []);
      setLastSync(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshWorkspace();
    const handleUpdate = () => refreshWorkspace();
    window.addEventListener('docs-updated', handleUpdate);
    window.addEventListener('history-updated', handleUpdate);
    return () => {
      window.removeEventListener('docs-updated', handleUpdate);
      window.removeEventListener('history-updated', handleUpdate);
    };
  }, [refreshWorkspace]);

  useEffect(() => {
    if (!selectedDoc && docs.length > 0) setSelectedDoc(docs[0]);
  }, [docs, selectedDoc, setSelectedDoc]);

  const handleDeleteDoc = useCallback(async (doc) => {
    if (!doc?.doc_id) return;
    await deleteDocument(doc.doc_id);
    const remaining = docs.filter((item) => item.doc_id !== doc.doc_id);
    setDocs(remaining);
    if (selectedDoc?.doc_id === doc.doc_id) setSelectedDoc(remaining[0] || null);
    window.dispatchEvent(new Event('docs-updated'));
  }, [docs, selectedDoc, setSelectedDoc]);

  const statusPills = useMemo(() => {
    const backends = health?.backends || {};
    return [
      { label: 'AI', value: backends.ai || 'checking' },
      { label: 'Storage', value: backends.storage || 'checking' },
      { label: 'DB', value: backends.userstore || 'checking' },
      { label: 'Vector', value: backends.vector || 'checking' },
    ];
  }, [health]);

  const pageProps = { docs, recent, health, refreshWorkspace, isLoading };
  const content = typeof children === 'function' ? children(pageProps) : children;

  return (
    <div className="app-wrapper">
      <Sidebar
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
        docs={docs}
        recent={recent}
        isLoading={isLoading}
        selectedDoc={selectedDoc}
        setSelectedDoc={setSelectedDoc}
        onDeleteDoc={handleDeleteDoc}
        activeView={activeView}
        setActiveView={setActiveView}
      />

      <div className="main-content modern-main">
        <header className="topbar app-topbar">
          <div className="topbar-left">
            <button className="menu-toggle" onClick={() => setIsSidebarOpen(!isSidebarOpen)} aria-label="Toggle menu">
              <Menu size={22} />
            </button>
            <button className="product-title product-title-button" onClick={() => setActiveView('dashboard')} type="button">
              <span className="live-dot" />
              <div>
                <strong>StudyBot Command Center</strong>
                <p>{lastSync ? `Đồng bộ lúc ${lastSync}` : 'Đang kết nối workspace...'}</p>
              </div>
            </button>
          </div>

          <nav className="workspace-nav" aria-label="Workspace navigation">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  className={`nav-pill ${activeView === item.id ? 'active' : ''}`}
                  onClick={() => setActiveView(item.id)}
                  type="button"
                >
                  <Icon size={16} />
                  <span>{item.label}</span>
                  {activeView === item.id && <motion.i layoutId="activeNavPill" />}
                </button>
              );
            })}
          </nav>

          <div className="status-pills" aria-label="Backend status">
            {statusPills.map((pill) => (
              <div className="pill" key={pill.label}>
                <Server size={13} />
                <span>{pill.label}</span>
                <strong>{pill.value}</strong>
              </div>
            ))}
          </div>

          <div className="top-actions">
            <button className="icon-button" onClick={refreshWorkspace} title="Làm mới workspace">
              <RefreshCcw size={18} />
            </button>
            <button className="icon-button" onClick={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))} title="Đổi giao diện sáng/tối">
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </header>

        <AnimatePresence mode="wait">
          <motion.main
            key={activeView}
            className="workspace-page"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
          >
            {content}
          </motion.main>
        </AnimatePresence>

      </div>
    </div>
  );
};

export default Layout;
