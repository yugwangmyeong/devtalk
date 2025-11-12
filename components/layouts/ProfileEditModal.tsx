'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/useAuthStore';
import './css/MainLayout.css';

interface ProfileEditModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ProfileEditModal({ isOpen, onClose }: ProfileEditModalProps) {
  const { user, setUser } = useAuthStore();
  const [formData, setFormData] = useState({
    name: '',
    profileImageUrl: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Load user data when modal opens
  useEffect(() => {
    if (isOpen && user) {
      setFormData({
        name: user.name || '',
        profileImageUrl: user.profileImageUrl || '',
      });
      setPreviewUrl(user.profileImageUrl || null);
      setError(null);
    }
  }, [isOpen, user]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    setError(null);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 파일 타입 검증
    if (!file.type.startsWith('image/')) {
      setError('이미지 파일만 업로드할 수 있습니다.');
      return;
    }

    // 파일 크기 제한 (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('파일 크기는 5MB 이하여야 합니다.');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      // 미리보기 생성
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);

      // 파일 업로드
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload/image', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '이미지 업로드에 실패했습니다.');
      }

      // 업로드된 URL을 폼에 설정
      setFormData((prev) => ({
        ...prev,
        profileImageUrl: data.url,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : '이미지 업로드 중 오류가 발생했습니다.');
      setPreviewUrl(null);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name.trim() || null,
          profileImageUrl: formData.profileImageUrl.trim() || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '회원정보 수정에 실패했습니다.');
      }

      // Update auth store with new user data
      setUser(data.user);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="profile-modal-overlay" onClick={onClose}>
      <div className="profile-modal" onClick={(e) => e.stopPropagation()}>
        <div className="profile-modal-header">
          <h3>회원정보 수정</h3>
          <button
            className="profile-modal-close"
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </div>

        <form className="profile-modal-form" onSubmit={handleSubmit}>
          <div className="profile-modal-group">
            <label className="profile-modal-label">이름</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              className="profile-modal-input"
              placeholder="이름을 입력하세요"
            />
          </div>

          <div className="profile-modal-group">
            <label className="profile-modal-label">프로필 이미지</label>
            
            {/* 이미지 미리보기 */}
            {previewUrl && (
              <div className="profile-modal-preview">
                <img src={previewUrl} alt="프로필 미리보기" />
              </div>
            )}

            {/* 파일 업로드 */}
            <div className="profile-modal-upload-section">
              <label className="profile-modal-upload-label">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  disabled={isUploading}
                  className="profile-modal-file-input"
                />
                <span className="profile-modal-upload-button">
                  {isUploading ? '업로드 중...' : '이미지 선택'}
                </span>
              </label>
            </div>
          </div>

          {error && (
            <div className="profile-modal-error">{error}</div>
          )}

          <div className="profile-modal-actions">
            <button
              type="button"
              className="profile-modal-button profile-modal-button-cancel"
              onClick={onClose}
              disabled={isLoading}
            >
              취소
            </button>
            <button
              type="submit"
              className="profile-modal-button profile-modal-button-submit"
              disabled={isLoading}
            >
              {isLoading ? '저장 중...' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

