import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Menu, Moon, RefreshCcw, Server, Sun } from 'lucide-react';
import Sidebar from './Sidebar';
import { callApi } from '../api';

const Layout = ({ children, selectedDoc, setSelectedDoc }) => {
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
    const handleDocUpdate = () => refreshWorkspace();
    const handleHistoryUpdate = () => refreshWorkspace();
    window.addEventListener('docs-updated', handleDocUpdate);
    window.addEventListener('history-updated', handleHistoryUpdate);
    return () => {
      window.removeEventListener('docs-updated', handleDocUpdate);
      window.removeEventListener('history-updated', handleHistoryUpdate);
    };
  }, [refreshWorkspace]);

  useEffect(() => {
    if (!selectedDoc && docs.length > 0) {
      setSelectedDoc(docs[0]);
    }
  }, [docs, selectedDoc, setSelectedDoc]);

  const statusPills = useMemo(() => {
    const backends = health?.backends || {};
    return [
      { label: 'AI', value: backends.ai || '...' },
      { label: 'Storage', value: backends.storage || '...' },
      { label: 'DB', value: backends.userstore || '...' },
      { label: 'Vector', value: backends.vector || '...' },
    ];
  }, [health]);

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
      />

      <div className="main-content">
        <header className="topbar app-topbar">
          <div className="topbar-left">
            <button className="menu-toggle" onClick={() => setIsSidebarOpen(!isSidebarOpen)} aria-label="Toggle menu">
              <Menu size={22} />
            </button>
            <div className="product-title">
              <span className="live-dot" />
              <div>
                <strong>AI Study Buddy</strong>
                <p>{lastSync ? `Đồng bộ lúc ${lastSync}` : 'Đang kết nối workspace...'}</p>
              </div>
            </div>
          </div>

          <div className="top-actions">
            <div className="status-pills">
              {statusPills.map((pill) => (
                <div className="pill" key={pill.label}>
                  <Server size={13} />
                  <span>{pill.label}</span>
                  <strong>{pill.value}</strong>
                </div>
              ))}
            </div>
            <button className="icon-button" onClick={refreshWorkspace} title="Làm mới workspace">
              <RefreshCcw size={18} />
            </button>
            <button className="icon-button" onClick={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))} title="Đổi giao diện sáng/tối">
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </header>

        {children}
      </div>
    </div>
  );
};

export default Layout;
