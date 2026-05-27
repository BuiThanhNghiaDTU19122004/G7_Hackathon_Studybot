import { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { getCurrentUser } from 'aws-amplify/auth';
import Login from './pages/Login';
import Register from './pages/Register';
import ChatView from './pages/ChatView';
import Layout from './components/Layout';
import './index.css';

const AuthGuard = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(null);
  const navigate = useNavigate();

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
  // Theme logic
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
            <Layout>
              <ChatView />
            </Layout>
          </AuthGuard>
        } />
      </Routes>
    </HashRouter>
  );
}

export default App;
