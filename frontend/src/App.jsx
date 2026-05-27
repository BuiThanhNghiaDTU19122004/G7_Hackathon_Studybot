import { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import ChatView from './pages/ChatView';
import Layout from './components/Layout';
import './index.css';

const AuthGuard = ({ children }) => {
  const user = localStorage.getItem('studybot_user');
  if (!user) {
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
