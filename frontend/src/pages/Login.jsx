import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signIn } from 'aws-amplify/auth';
import '../auth.css';
import { LogIn } from 'lucide-react';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!email.trim() || !password.trim()) {
      setError('Vui lòng điền đủ thông tin');
      return;
    }

    setIsLoading(true);
    try {
      const { isSignedIn, nextStep } = await signIn({
        username: email.trim(),
        password: password
      });

      if (isSignedIn) {
        navigate('/');
      } else if (nextStep.signInStep === 'CONFIRM_SIGN_UP') {
        // Có thể navigate sang 1 route /confirm hoặc chỉ hiện lỗi nhắc nhở
        setError('Tài khoản chưa được xác thực email. Vui lòng đăng ký lại để xác thực.');
      }
    } catch (err) {
      setError(err.message || 'Tên đăng nhập hoặc mật khẩu không đúng');
    } finally {
      setIsLoading(false);
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
          <label htmlFor="email">Email</label>
          <input 
            type="email" 
            id="email" 
            className="form-control" 
            placeholder="Nhập email của bạn" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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
        {error && <div className="error-msg" style={{ display: 'block' }}>{error}</div>}
        <button type="submit" className="btn-primary" disabled={isLoading}>
          {isLoading ? 'Đang đăng nhập...' : 'Đăng nhập'}
        </button>
      </form>
      
      <div className="auth-footer">
        Chưa có tài khoản? <Link to="/register">Đăng ký ngay</Link>
      </div>
    </div>
  );
};

export default Login;
