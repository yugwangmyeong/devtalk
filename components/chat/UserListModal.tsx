'use client';

import { useState, useEffect } from 'react';
import type { User } from '@/stores/useAuthStore';

interface UserListModalProps {
  users: User[];
  onSelectUser: (userId: string) => void;
  onClose: () => void;
}

export function UserListModal({ users, onSelectUser, onClose }: UserListModalProps) {
  const [friendStatuses, setFriendStatuses] = useState<Record<string, string>>({});
  const [sendingRequests, setSendingRequests] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Fetch friend statuses for all users
    const fetchFriendStatuses = async () => {
      try {
        const response = await fetch('/api/friends?status=ACCEPTED');
        if (response.ok) {
          const data = await response.json();
          const friendsMap: Record<string, string> = {};
          data.friends.forEach((f: any) => {
            friendsMap[f.id] = 'ACCEPTED';
          });
          setFriendStatuses(friendsMap);
        }
      } catch (error) {
        console.error('Failed to fetch friend statuses:', error);
      }
    };

    fetchFriendStatuses();
  }, []);

  const handleAddFriend = async (userId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    setSendingRequests(prev => new Set(prev).add(userId));
    
    try {
      const response = await fetch('/api/friends', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });

      if (response.ok) {
        const data = await response.json();
        setFriendStatuses(prev => ({
          ...prev,
          [userId]: data.friendship?.status || 'PENDING',
        }));
        alert(data.message || '친구 요청을 보냈습니다.');
      } else {
        const error = await response.json();
        alert(error.error || '친구 요청 전송에 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to send friend request:', error);
      alert('친구 요청 전송에 실패했습니다.');
    } finally {
      setSendingRequests(prev => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }
  };

  return (
    <div className="chat-user-list-modal">
      <div className="chat-user-list-header">
        <h3>사용자 선택</h3>
        <button onClick={onClose}>✕</button>
      </div>
      <div className="chat-user-list-content">
        {users.map((u) => {
          const isFriend = friendStatuses[u.id] === 'ACCEPTED';
          const isPending = friendStatuses[u.id] === 'PENDING';
          const isSending = sendingRequests.has(u.id);

          return (
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
              {!isFriend && !isPending && (
                <button
                  className="chat-add-friend-button"
                  onClick={(e) => handleAddFriend(u.id, e)}
                  disabled={isSending}
                >
                  {isSending ? '요청 중...' : '+ 친구'}
                </button>
              )}
              {isPending && (
                <span className="chat-friend-status">요청됨</span>
              )}
              {isFriend && (
                <span className="chat-friend-status">친구</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

