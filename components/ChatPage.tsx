'use client';

import { useAuthStore } from '@/stores/useAuthStore';
import { Sidebar } from '@/components/layouts/Sidebar';
import './css/ChatPage.css';

export function ChatPage() {
  const { user } = useAuthStore();

  return (
    <div className="chat-page-container">
      <Sidebar />
      <div className="chat-page-layout">
          {/* Left Panel - DM List */}
          <div className="chat-dm-panel">
            {/* Header */}
            <div className="chat-dm-header">
              <h2 className="chat-dm-title">다이렉트 메시지(DM)</h2>
            </div>

            {/* Content */}
            <div className="chat-dm-content">
              {/* Invitation Section */}
              <div className="chat-invitation-section">
                <p className="chat-invitation-text">
                  DevTALK은 함께할때 더 즐거워집니다.
                </p>
                <p className="chat-invitation-text">
                  팀원들을 초대해주세요
                </p>
                <button className="chat-invite-button">
                  팀원초대
                </button>
              </div>

              {/* Divider */}
              <div className="chat-divider"></div>

              {/* Personal Space */}
              <div className="chat-dm-item">
                <div className="chat-avatar">
                  {user?.profileImageUrl ? (
                    <img src={user.profileImageUrl} alt={user.name || user.email} />
                  ) : (
                    <div className="chat-avatar-placeholder"></div>
                  )}
                </div>
                <div className="chat-dm-item-content">
                  <div className="chat-dm-item-name">
                    {user?.name || user?.email || '사용자'}(나)
                  </div>
                  <div className="chat-dm-item-description">
                    여기는 나만의 공간입니다.
                  </div>
                  <div className="chat-dm-item-description">
                    메모장, 할 일 목록 등으로 사용해주세요.
                  </div>
                </div>
              </div>

              {/* Team Member Chat */}
              <div className="chat-dm-item">
                <div className="chat-avatar">
                  <div className="chat-avatar-placeholder"></div>
                </div>
                <div className="chat-dm-item-content">
                  <div className="chat-dm-item-name">팀원1</div>
                  <div className="chat-dm-item-last-message">
                    마지막 대화내용.....
                  </div>
                </div>
              </div>
            </div>
          </div>

        {/* Right Panel - Chat Area */}
        <div className="chat-area-panel">
          {/* Empty state - 채팅 영역이 비어있을 때 */}
          <div className="chat-area-empty">
            {/* 채팅을 선택하면 여기에 표시됩니다 */}
          </div>
        </div>
      </div>
    </div>
  );
}

