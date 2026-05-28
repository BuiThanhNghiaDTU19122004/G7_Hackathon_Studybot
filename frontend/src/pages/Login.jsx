import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signIn } from 'aws-amplify/auth';
import { LogIn, Sparkles } from 'lucide-react';
import '../auth.css';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (event) => {
    event.preventDefault();
    setError('');

    if (!email.trim() || !password.trim()) {
      setError('Vui lòng điền đầy đủ thông tin.');
      return;
    }

    setIsLoading(true);
    try {
      const { isSignedIn, nextStep } = await signIn({
        username: email.trim(),
        password,
      });

      if (isSignedIn) {
        navigate('/');
      } else if (nextStep.signInStep === 'CONFIRM_SIGN_UP') {
        setError('Tài khoản chưa xác thực email. Vui lòng kiểm tra hộp thư hoặc đăng ký lại để nhận mã xác thực.');
      }
    } catch (err) {
      setError(err.message || 'Email hoặc mật khẩu không đúng.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-brand-panel">
        <div className="auth-brand">
          <div className="logo"><Sparkles color="white" size={20} /></div>
          <div>
            <strong>StudyBot</strong>
            <span>learn faster with AI</span>
          </div>
        </div>
        <p className="eyebrow">AI learning workspace</p>
        <h1>Turn documents into <span>study momentum.</span></h1>
        <p>Đăng nhập để tiếp tục hỏi đáp, tóm tắt, tạo flashcard và luyện quiz từ tài liệu của bạn.</p>
        <div className="auth-proof">
          <span>Bedrock KB</span>
          <span>Cognito</span>
          <span>S3 Documents</span>
          <span>Flashcards + Quiz</span>
        </div>
      </section>

      <section className="auth-card">
        <div className="auth-header">
          <div className="logo">
            <LogIn color="white" size={22} />
          </div>
          <h1>Mừng trở lại</h1>
          <p>Vào workspace để tiếp tục phiên học của bạn.</p>
        </div>

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              className="form-control"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
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
              placeholder="Nhập mật khẩu"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>
          {error && <div className="error-msg">{error}</div>}
          <button type="submit" className="btn-primary" disabled={isLoading}>
            {isLoading && <span className="auth-loading" />}
            {isLoading ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>
        </form>

        <div className="auth-footer">
          Chưa có tài khoản? <Link to="/register">Đăng ký ngay</Link>
        </div>
      </section>
    </main>
  );
};

export default Login;
