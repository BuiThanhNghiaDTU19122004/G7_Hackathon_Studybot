import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signUp, confirmSignUp } from 'aws-amplify/auth';
import { Mail, Sparkles, UserPlus } from 'lucide-react';
import '../auth.css';

const Register = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [step, setStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (event) => {
    event.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }

    setIsLoading(true);
    try {
      const { isSignUpComplete, nextStep } = await signUp({
        username: email,
        password,
        options: {
          userAttributes: { email },
        },
      });

      if (nextStep.signUpStep === 'CONFIRM_SIGN_UP') {
        setStep(1);
      } else if (isSignUpComplete) {
        navigate('/login');
      }
    } catch (err) {
      setError(err.message || 'Không đăng ký được tài khoản.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = async (event) => {
    event.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const { isSignUpComplete } = await confirmSignUp({
        username: email,
        confirmationCode: code,
      });
      if (isSignUpComplete) navigate('/login');
    } catch (err) {
      setError(err.message || 'Mã xác thực không đúng.');
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
            <span>personal study cockpit</span>
          </div>
        </div>
        <p className="eyebrow">Build your knowledge base</p>
        <h1>Upload once. <span>Learn everywhere.</span></h1>
        <p>Tạo tài khoản để lưu tài liệu, lịch sử hỏi, flashcard và quiz theo đúng workspace của bạn.</p>
        <div className="auth-proof">
          <span>Private docs</span>
          <span>Metadata filter</span>
          <span>Fast summaries</span>
          <span>Practice mode</span>
        </div>
      </section>

      <section className="auth-card">
        <div className="auth-header">
          <div className="logo">
            {step === 1 ? <Mail color="white" size={22} /> : <UserPlus color="white" size={22} />}
          </div>
          <h1>{step === 1 ? 'Xác thực email' : 'Tạo tài khoản'}</h1>
          <p>{step === 1 ? `Mã xác thực đã được gửi tới ${email}.` : 'Bắt đầu một workspace học tập riêng.'}</p>
        </div>

        {step === 1 ? (
          <form onSubmit={handleConfirm}>
            <div className="form-group">
              <label htmlFor="code">Mã xác thực</label>
              <input
                type="text"
                id="code"
                className="form-control"
                placeholder="Nhập mã OTP"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                required
                autoFocus
              />
            </div>
            {error && <div className="error-msg">{error}</div>}
            <button type="submit" className="btn-primary" disabled={isLoading}>
              {isLoading && <span className="auth-loading" />}
              {isLoading ? 'Đang xác thực...' : 'Xác thực'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister}>
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
                placeholder="Tối thiểu 8 ký tự"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
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
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
                minLength="8"
              />
            </div>
            {error && <div className="error-msg">{error}</div>}
            <button type="submit" className="btn-primary" disabled={isLoading}>
              {isLoading && <span className="auth-loading" />}
              {isLoading ? 'Đang tạo tài khoản...' : 'Đăng ký'}
            </button>
          </form>
        )}

        {step === 0 && (
          <div className="auth-footer">
            Đã có tài khoản? <Link to="/login">Đăng nhập ngay</Link>
          </div>
        )}
      </section>
    </main>
  );
};

export default Register;
