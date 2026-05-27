import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import '../auth.css';
import { UserPlus } from 'lucide-react';

const Register = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState(false);
  const navigate = useNavigate();

  const handleRegister = (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError(true);
      return;
    }
    
    if (username.trim() && password) {
      localStorage.setItem('studybot_user', username.trim());
      navigate('/');
    }
  };

  return (
    <div className="auth-card">
      <div className="auth-header">
        <div className="logo">
          <UserPlus color="white" size={24} />
        </div>
        <h1>Tạo tài khoản</h1>
        <p>Bắt đầu hành trình học tập cùng StudyBot</p>
      </div>
      
      <form onSubmit={handleRegister}>
        <div className="form-group">
          <label htmlFor="username">Tên đăng nhập</label>
          <input 
            type="text" 
            id="username" 
            className="form-control" 
            placeholder="Chọn tên đăng nhập" 
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
            placeholder="Tạo mật khẩu" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required 
            minLength="6" 
          />
        </div>
        <div className="form-group">
          <label htmlFor="confirm-password">Xác nhận mật khẩu</label>
          <input 
            type="password" 
            id="confirm-password" 
            className="form-control" 
            placeholder="Nhập lại mật khẩu" 
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required 
            minLength="6" 
          />
        </div>
        {error && <div className="error-msg" style={{ display: 'block' }}>Mật khẩu không khớp!</div>}
        <button type="submit" className="btn-primary">Đăng ký</button>
      </form>
      
      <div className="auth-footer">
        Đã có tài khoản? <Link to="/login">Đăng nhập ngay</Link>
      </div>
    </div>
  );
};

export default Register;
