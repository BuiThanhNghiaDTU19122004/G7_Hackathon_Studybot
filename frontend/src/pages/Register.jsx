import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signUp, confirmSignUp } from 'aws-amplify/auth';
import '../auth.css';
import { UserPlus, Mail } from 'lucide-react';

const Register = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [step, setStep] = useState(0); // 0 = register form, 1 = confirm OTP
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Mật khẩu không khớp!');
      return;
    }
    
    setIsLoading(true);
    try {
      const { isSignUpComplete, nextStep } = await signUp({
        username: email,
        password,
        options: {
          userAttributes: {
            email,
          }
        }
      });

      if (nextStep.signUpStep === 'CONFIRM_SIGN_UP') {
        setStep(1);
      } else if (isSignUpComplete) {
        navigate('/login');
      }
    } catch (err) {
      setError(err.message || 'Lỗi đăng ký');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const { isSignUpComplete } = await confirmSignUp({
        username: email,
        confirmationCode: code
      });
      if (isSignUpComplete) {
        // Sau khi confirm xong, user cần đăng nhập lại theo chuẩn Cognito, hoặc ta có thể autoSignIn.
        // Tốt nhất là đưa về trang login.
        navigate('/login');
      }
    } catch (err) {
      setError(err.message || 'Mã xác thực không đúng');
    } finally {
      setIsLoading(false);
    }
  };

  if (step === 1) {
    return (
      <div className="auth-card">
        <div className="auth-header">
          <div className="logo">
            <Mail color="white" size={24} />
          </div>
          <h1>Xác thực Email</h1>
          <p>Mã xác thực 6 số đã được gửi tới {email}</p>
        </div>
        <form onSubmit={handleConfirm}>
          <div className="form-group">
            <label htmlFor="code">Mã xác thực</label>
            <input 
              type="text" 
              id="code" 
              className="form-control" 
              placeholder="Nhập mã OTP" 
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required 
              autoFocus 
            />
          </div>
          {error && <div className="error-msg" style={{ display: 'block' }}>{error}</div>}
          <button type="submit" className="btn-primary" disabled={isLoading}>
            {isLoading ? 'Đang xác thực...' : 'Xác thực'}
          </button>
        </form>
      </div>
    );
  }

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
          <label htmlFor="email">Email</label>
          <input 
            type="email" 
            id="email" 
            className="form-control" 
            placeholder="Địa chỉ email của bạn" 
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
            placeholder="Tạo mật khẩu" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required 
            minLength="8" 
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
            minLength="8" 
          />
        </div>
        {error && <div className="error-msg" style={{ display: 'block' }}>{error}</div>}
        <button type="submit" className="btn-primary" disabled={isLoading}>
          {isLoading ? 'Đang tạo...' : 'Đăng ký'}
        </button>
      </form>
      
      <div className="auth-footer">
        Đã có tài khoản? <Link to="/login">Đăng nhập ngay</Link>
      </div>
    </div>
  );
};

export default Register;
