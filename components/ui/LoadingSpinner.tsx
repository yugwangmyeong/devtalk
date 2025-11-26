'use client';

import './LoadingSpinner.css';

interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  message?: string;
  fullScreen?: boolean;
}

export function LoadingSpinner({ 
  size = 'medium', 
  message = '로딩 중...',
  fullScreen = false 
}: LoadingSpinnerProps) {
  const spinnerSize = {
    small: '24px',
    medium: '48px',
    large: '72px',
  };

  const content = (
    <div className={`loading-spinner-container ${fullScreen ? 'loading-spinner-fullscreen' : ''}`}>
      <div className="loading-spinner-wrapper">
        <div 
          className="loading-spinner" 
          style={{ width: spinnerSize[size], height: spinnerSize[size] }}
        >
          <div className="spinner-ring"></div>
          <div className="spinner-ring"></div>
          <div className="spinner-ring"></div>
        </div>
        {message && (
          <p className="loading-spinner-message">{message}</p>
        )}
      </div>
    </div>
  );

  return content;
}



