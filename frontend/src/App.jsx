import { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { getCurrentUser } from 'aws-amplify/auth';
import Login from './pages/Login';
import Register from './pages/Register';
import ChatView from './pages/ChatView';
import Dashboard from './pages/Dashboard';
import Documents from './pages/Documents';
import Insights from './pages/Insights';
import Layout from './components/Layout';
import './index.css';

const AuthGuard = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        await getCurrentUser();
        setIsAuthenticated(true);
      } catch (err) {
        setIsAuthenticated(false);
      }
    };
    checkAuth();
  }, []);

  if (isAuthenticated === null) {
    return <div style={{ display: 'grid', placeItems: 'center', height: '100vh', background: 'var(--bg)' }}><span className="spinner"></span></div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return children;
};

function App() {
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [activeView, setActiveView] = useState('dashboard');

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);

  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/" element={
          <AuthGuard>
            <Layout
              selectedDoc={selectedDoc}
              setSelectedDoc={setSelectedDoc}
              activeView={activeView}
              setActiveView={setActiveView}
            >
              {({ docs, recent, health, refreshWorkspace, isLoading }) => {
                if (activeView === 'dashboard') {
                  return (
                    <Dashboard
                      docs={docs}
                      recent={recent}
                      health={health}
                      selectedDoc={selectedDoc}
                      setSelectedDoc={setSelectedDoc}
                      setActiveView={setActiveView}
                    />
                  );
                }
                if (activeView === 'documents') {
                  return (
                    <Documents
                      docs={docs}
                      selectedDoc={selectedDoc}
                      setSelectedDoc={setSelectedDoc}
                      setActiveView={setActiveView}
                      refreshWorkspace={refreshWorkspace}
                      isLoading={isLoading}
                    />
                  );
                }
                if (activeView === 'insights') {
                  return <Insights docs={docs} recent={recent} health={health} />;
                }
                return <ChatView selectedDoc={selectedDoc} />;
              }}
            </Layout>
          </AuthGuard>
        } />
        <Route path="/chat" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
