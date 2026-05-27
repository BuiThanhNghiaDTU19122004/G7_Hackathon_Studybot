import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import '../auth.css';
import { LogIn } from 'lucide-react';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const navigate = useNavigate();

  const handleLogin = (e) => {
    e.preventDefault();
    if (username.trim() && password.trim()) {
      localStorage.setItem('studybot_user', username.trim());
      navigate('/');
    } else {
      setError(true);
    }
  };

  return (
    <div className="auth-card">
      <div className="auth-header">
        <div className="logo">
          <LogIn color="white" size={24} />
        </div>
        <h1>Mừng trở lại!</h1>
        <p>Đăng nhập vào StudyBot để tiếp tục học</p>
      </div>
      
      <form onSubmit={handleLogin}>
        <div className="form-group">
          <label htmlFor="username">Tên đăng nhập</label>
          <input 
            type="text" 
            id="username" 
            className="form-control" 
            placeholder="Nhập tên đăng nhập của bạn" 
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required 
            autoFocus 
          />
        </div>
        <div className="form-group">
          <label htmlFor="password">Mật khẩu</label>
          <input 
            type="password" 
            id="password" 
            className="form-control" 
            placeholder="••••••••" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required 
          />
        </div>
        {error && <div className="error-msg" style={{ display: 'block' }}>Tên đăng nhập hoặc mật khẩu không đúng</div>}
        <button type="submit" className="btn-primary">Đăng nhập</button>
      </form>
      
      <div className="auth-footer">
        Chưa có tài khoản? <Link to="/register">Đăng ký ngay</Link>
      </div>
    </div>
  );
};

export default Login;
