import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import { Menu, Sun, Moon } from 'lucide-react';
import { callApi } from '../api';

const Layout = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
  const [docs, setDocs] = useState([]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  useEffect(() => {
    const fetchDocs = async () => {
      try {
        const res = await callApi('/docs/list');
        setDocs(res.docs || []);
      } catch (err) {
        console.error('Lỗi tải tài liệu:', err);
      }
    };
    fetchDocs();
    
    // Listen for doc updates
    const handleDocUpdate = () => fetchDocs();
    window.addEventListener('docs-updated', handleDocUpdate);
    return () => window.removeEventListener('docs-updated', handleDocUpdate);
  }, []);

  return (
    <div className="app-wrapper">
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} docs={docs} />
      
      <div className="main-content">
        <header className="topbar">
          <div className="topbar-left">
            <button className="menu-toggle" onClick={() => setIsSidebarOpen(!isSidebarOpen)} aria-label="Toggle Menu">
              <Menu size={24} />
            </button>
            <p>AI Study Buddy — Trợ lý học tập thông minh</p>
          </div>

          <div className="top-actions">
            <div className="status-pills" id="status-pills">
              {/* Status pills can be injected via global state if needed, omitting for brevity */}
            </div>
            <button className="theme-toggle-btn" onClick={toggleTheme} title="Đổi giao diện">
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          </div>
        </header>

        {children}
      </div>
    </div>
  );
};

export default Layout;
