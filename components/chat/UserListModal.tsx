'use client';

import type { User } from '@/stores/useAuthStore';

interface UserListModalProps {
  users: User[];
  onSelectUser: (userId: string) => void;
  onClose: () => void;
}

export function UserListModal({ users, onSelectUser, onClose }: UserListModalProps) {
  return (
    <div className="chat-user-list-modal">
      <div className="chat-user-list-header">
        <h3>사용자 선택</h3>
        <button onClick={onClose}>✕</button>
      </div>
      <div className="chat-user-list-content">
        {users.map((u) => (
          <div
            key={u.id}
            className="chat-user-list-item"
            onClick={() => onSelectUser(u.id)}
          >
            <div className="chat-avatar">
              {u.profileImageUrl ? (
                <img src={u.profileImageUrl} alt={u.name || u.email} />
              ) : (
                <div className="chat-avatar-placeholder"></div>
              )}
            </div>
            <div className="chat-user-list-item-name">
              {u.name || u.email}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

