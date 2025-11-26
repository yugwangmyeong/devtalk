'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/useAuthStore';
import './css/LoginPage.css';
import '@/app/styles/font.css';

type FormMode = 'initial' | 'login' | 'signup';

interface FormData {
  email: string;
  password: string;
  name?: string;
  confirmPassword?: string;
}

export function LoginPage() {
  const router = useRouter();
  const { setUser } = useAuthStore();
  const [formMode, setFormMode] = useState<FormMode>('initial');
  const [formData, setFormData] = useState<FormData>({
    email: '',
    password: '',
    name: '',
    confirmPassword: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignInClick = () => {
    setFormMode('login');
    setError(null);
  };

  const handleSignUpClick = () => {
    setFormMode('signup');
    setError(null);
  };

  const handleBackClick = () => {
    setFormMode('initial');
    setError(null);
    setFormData({ email: '', password: '', name: '', confirmPassword: '' });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    let fieldName = id.replace('login-', '').replace('signup-', '');
    
    // Convert kebab-case to camelCase for formData keys
    if (fieldName === 'confirm-password') {
      fieldName = 'confirmPassword';
    }
    
    setFormData((prev) => ({
      ...prev,
      [fieldName]: value,
    }));
    setError(null);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    // Basic validation
    if (!formData.email || !formData.password) {
      setError('이메일과 비밀번호를 입력해주세요.');
      setIsLoading(false);
      return;
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('올바른 이메일 형식을 입력해주세요.');
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email.trim(),
          password: formData.password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '로그인에 실패했습니다.');
      }

      // Update auth store
      setUser(data.user);
      
      // Success - redirect or update UI
      router.push('/');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    // Basic validation
    if (!formData.email || !formData.password || !formData.confirmPassword) {
      setError('모든 필드를 입력해주세요.');
      setIsLoading(false);
      return;
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('올바른 이메일 형식을 입력해주세요.');
      setIsLoading(false);
      return;
    }

    // Password length validation
    if (formData.password.length < 6) {
      setError('비밀번호는 최소 6자 이상이어야 합니다.');
      setIsLoading(false);
      return;
    }

    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email.trim(),
          password: formData.password,
          name: formData.name?.trim() || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '회원가입에 실패했습니다.');
      }

      // Update auth store
      setUser(data.user);

      // Success - redirect or update UI
      router.push('/');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-wrapper">
        {/* Left Side - Logo */}
        <div className="logo-container">
          <Image
            src="/devtalk-logo-new.svg"
            alt="DEV TALK Logo"
            width={128}
            height={128}
            className="logo-image"
            unoptimized
          />
        </div>

        {/* Right Side - Content */}
        <div className="login-content">
          {/* Title */}
          <h1 className="login-title">
            <span>DevTALK</span>
          </h1>

          {/* Divider */}
          <div className="login-divider"></div>

          {/* Tagline */}
          <p className="login-tagline">
            코드로 말하고, 생각을 나누다.
          </p>

          {/* Initial State - Buttons */}
          {formMode === 'initial' && (
            <>
              <div className="login-buttons">
                {/* Sign In Button */}
                <button className="login-button" onClick={handleSignInClick}>
                  Sign In
                </button>

                {/* Google Sign In Button */}
                <button 
                  className="login-button google-button"
                  onClick={() => {
                    window.location.href = '/api/auth/google';
                  }}
                >
                  <svg
                    className="google-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M22.56 12.25C22.56 11.47 22.49 10.72 22.36 10H12V14.51H17.92C17.66 15.99 16.89 17.24 15.74 18.09V21.09H19.42C21.38 19.24 22.56 16.06 22.56 12.25Z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23C15.24 23 17.95 21.93 19.42 19.09L15.74 16.09C14.76 16.72 13.48 17.11 12 17.11C8.87 17.11 6.22 14.96 5.28 12.09H1.49V15.18C2.95 18.03 7.2 23 12 23Z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.28 12.09C5.03 11.33 4.89 10.53 4.89 9.71C4.89 8.89 5.03 8.09 5.28 7.33V4.24H1.49C0.64 5.95 0.09 7.78 0.09 9.71C0.09 11.64 0.64 13.47 1.49 15.18L5.28 12.09Z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 4.38C13.62 4.38 15.06 4.93 16.21 6.02L19.52 2.71C17.93 1.18 15.24 0 12 0C7.2 0 2.95 4.97 1.49 7.82L5.28 10.91C6.22 8.04 8.87 5.89 12 5.89V4.38Z"
                      fill="#EA4335"
                    />
                  </svg>
                  <span>Sign in With Google</span>
                </button>
              </div>

              {/* Sign Up Link */}
              <div className="login-signup">
                <span>처음이용하시나요? </span>
                <button
                  className="login-signup-link"
                  onClick={handleSignUpClick}
                >
                  Sign up
                </button>
              </div>
            </>
          )}

          {/* Form State - Login/Signup */}
          {(formMode === 'login' || formMode === 'signup') && (
            <div className="auth-form-wrapper">
              {/* Tabs */}
              <div className={`auth-form-tabs ${formMode === 'signup' ? 'signup-active' : ''}`}>
                <button
                  className={`auth-form-tab ${formMode === 'login' ? 'active' : ''}`}
                  onClick={() => setFormMode('login')}
                >
                  Sign In
                </button>
                <button
                  className={`auth-form-tab ${formMode === 'signup' ? 'active' : ''}`}
                  onClick={() => setFormMode('signup')}
                >
                  Sign Up
                </button>
              </div>

              {/* Error Message */}
              {error && (
                <div className="auth-form-error">
                  {error}
                </div>
              )}

              {/* Form */}
              <form className="auth-form" onSubmit={formMode === 'login' ? handleLogin : handleSignup}>
                {formMode === 'login' ? (
                  <>
                    <div className="auth-form-group">
                      <label htmlFor="login-email" className="auth-form-label">이메일</label>
                      <input
                        type="email"
                        id="login-email"
                        className="auth-form-input"
                        placeholder="your@email.com"
                        value={formData.email}
                        onChange={handleInputChange}
                        required
                        disabled={isLoading}
                      />
                    </div>
                    <div className="auth-form-group">
                      <label htmlFor="login-password" className="auth-form-label">비밀번호</label>
                      <input
                        type="password"
                        id="login-password"
                        className="auth-form-input"
                        placeholder="••••••••"
                        value={formData.password}
                        onChange={handleInputChange}
                        required
                        disabled={isLoading}
                      />
                    </div>
                    <button type="submit" className="auth-form-submit" disabled={isLoading}>
                      {isLoading ? '로그인 중...' : '로그인'}
                    </button>
                  </>
                ) : (
                  <>
                    <div className="auth-form-group">
                      <label htmlFor="signup-name" className="auth-form-label">이름</label>
                      <input
                        type="text"
                        id="signup-name"
                        className="auth-form-input"
                        placeholder="이름을 입력하세요"
                        value={formData.name}
                        onChange={handleInputChange}
                        disabled={isLoading}
                      />
                    </div>
                    <div className="auth-form-group">
                      <label htmlFor="signup-email" className="auth-form-label">이메일</label>
                      <input
                        type="email"
                        id="signup-email"
                        className="auth-form-input"
                        placeholder="your@email.com"
                        value={formData.email}
                        onChange={handleInputChange}
                        required
                        disabled={isLoading}
                      />
                    </div>
                    <div className="auth-form-group">
                      <label htmlFor="signup-password" className="auth-form-label">비밀번호</label>
                      <input
                        type="password"
                        id="signup-password"
                        className="auth-form-input"
                        placeholder="최소 6자 이상"
                        value={formData.password}
                        onChange={handleInputChange}
                        required
                        disabled={isLoading}
                        minLength={6}
                      />
                    </div>
                    <div className="auth-form-group">
                      <label htmlFor="signup-confirm-password" className="auth-form-label">비밀번호 확인</label>
                      <input
                        type="password"
                        id="signup-confirm-password"
                        className="auth-form-input"
                        placeholder="비밀번호를 다시 입력하세요"
                        value={formData.confirmPassword}
                        onChange={handleInputChange}
                        required
                        disabled={isLoading}
                        minLength={6}
                      />
                    </div>
                    <button type="submit" className="auth-form-submit" disabled={isLoading}>
                      {isLoading ? '가입 중...' : '가입하기'}
                    </button>
                  </>
                )}
              </form>

              {/* Back Button */}
              <button className="auth-form-back" onClick={handleBackClick}>
                ← 뒤로가기
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

