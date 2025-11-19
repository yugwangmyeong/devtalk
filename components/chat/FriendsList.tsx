'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getProfileImageUrl } from '@/lib/utils';

interface Friend {
  id: string;
  email: string;
  name: string | null;
  profileImageUrl: string | null;
  friendshipId: string;
  status: string;
  isRequester: boolean;
}

interface FriendsListProps {
  onFriendClick?: (friendId: string) => void;
  onCreateDM?: (email: string) => void;
}

export function FriendsList({ onFriendClick, onCreateDM }: FriendsListProps) {
  const router = useRouter();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pendingRequests, setPendingRequests] = useState<Friend[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'friends' | 'pending'>('friends');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchFriends();
  }, []);

  // 외부 클릭 시 메뉴 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuId(null);
      }
    };

    if (openMenuId) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [openMenuId]);

  const fetchFriends = async () => {
    try {
      setIsLoading(true);
      
      // Fetch accepted friends
      const friendsResponse = await fetch('/api/friends?status=ACCEPTED');
      if (friendsResponse.ok) {
        const friendsData = await friendsResponse.json();
        setFriends(friendsData.friends || []);
      }

      // Fetch pending requests (where current user is addressee)
      const pendingResponse = await fetch('/api/friends?status=PENDING');
      if (pendingResponse.ok) {
        const pendingData = await pendingResponse.json();
        // Filter: only requests where current user is addressee (received requests)
        const receivedRequests = (pendingData.friends || []).filter(
          (f: Friend) => !f.isRequester
        );
        setPendingRequests(receivedRequests);
      }
    } catch (error) {
      console.error('Failed to fetch friends:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAcceptRequest = async (friendshipId: string) => {
    try {
      const response = await fetch(`/api/friends/${friendshipId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'ACCEPT' }),
      });

      if (response.ok) {
        await fetchFriends(); // Refresh list
      } else {
        const error = await response.json();
        alert(error.error || '친구 요청 수락에 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to accept friend request:', error);
      alert('친구 요청 수락에 실패했습니다.');
    }
  };

  const handleDeclineRequest = async (friendshipId: string) => {
    try {
      const response = await fetch(`/api/friends/${friendshipId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'DECLINE' }),
      });

      if (response.ok) {
        await fetchFriends(); // Refresh list
      } else {
        const error = await response.json();
        alert(error.error || '친구 요청 거절에 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to decline friend request:', error);
      alert('친구 요청 거절에 실패했습니다.');
    }
  };

  const handleFriendClick = (friend: Friend, e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenMenuId(openMenuId === friend.id ? null : friend.id);
  };

  const handleStartChat = (friend: Friend) => {
    setOpenMenuId(null);
    if (friend.email) {
      // email 파라미터로 DM 채팅방 열기
      router.push(`/chat?email=${encodeURIComponent(friend.email)}`);
    } else if (onFriendClick) {
      onFriendClick(friend.id);
    } else if (onCreateDM) {
      onCreateDM(friend.email || '');
    }
  };

  const handleDeleteFriend = async (friend: Friend) => {
    setOpenMenuId(null);
    if (!confirm('정말 친구를 삭제하시겠습니까?')) {
      return;
    }

    try {
      const response = await fetch(`/api/friends/${friend.friendshipId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'DELETE' }),
      });

      if (response.ok) {
        await fetchFriends();
        window.dispatchEvent(new CustomEvent('friendsUpdated'));
      } else {
        const error = await response.json();
        alert(error.error || '친구 삭제에 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to delete friend:', error);
      alert('친구 삭제에 실패했습니다.');
    }
  };

  return (
    <div className="friends-list-container">
      <div className="friends-list-tabs">
        <button
          className={`friends-tab ${activeTab === 'friends' ? 'active' : ''}`}
          onClick={() => setActiveTab('friends')}
        >
          친구 ({friends.length})
        </button>
        <button
          className={`friends-tab ${activeTab === 'pending' ? 'active' : ''}`}
          onClick={() => setActiveTab('pending')}
        >
          요청 {pendingRequests.length > 0 && `(${pendingRequests.length})`}
        </button>
      </div>

      <div className="friends-list-content">
        {isLoading ? (
          <div className="friends-loading">로딩 중...</div>
        ) : activeTab === 'friends' ? (
          friends.length === 0 ? (
            <div className="friends-empty">친구가 없습니다.</div>
          ) : (
            <div className="friends-list">
              {friends.map((friend) => (
                <div key={friend.id} className="friends-item" ref={openMenuId === friend.id ? menuRef : null}>
                  <div
                    className="friends-item-content"
                    onClick={(e) => handleFriendClick(friend, e)}
                  >
                    <div className="friends-avatar">
                      <img
                        src={getProfileImageUrl(friend.profileImageUrl)}
                        alt={friend.name || friend.email}
                      />
                    </div>
                    <div className="friends-info">
                      <div className="friends-name">
                        {friend.name || friend.email}
                      </div>
                      {friend.name && (
                        <div className="friends-email">{friend.email}</div>
                      )}
                    </div>
                  </div>
                  {openMenuId === friend.id && (
                    <div className="friends-context-menu">
                      <button
                        className="friends-menu-item"
                        onClick={() => handleStartChat(friend)}
                      >
                        채팅하기
                      </button>
                      <button
                        className="friends-menu-item friends-menu-item-danger"
                        onClick={() => handleDeleteFriend(friend)}
                      >
                        친구 삭제하기
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        ) : (
          pendingRequests.length === 0 ? (
            <div className="friends-empty">받은 친구 요청이 없습니다.</div>
          ) : (
            <div className="friends-list">
              {pendingRequests.map((request) => (
                <div key={request.id} className="friends-item">
                  <div className="friends-item-content">
                    <div className="friends-avatar">
                      <img
                        src={getProfileImageUrl(request.profileImageUrl)}
                        alt={request.name || request.email}
                      />
                    </div>
                    <div className="friends-info">
                      <div className="friends-name">
                        {request.name || request.email}
                      </div>
                      {request.name && (
                        <div className="friends-email">{request.email}</div>
                      )}
                    </div>
                  </div>
                  <div className="friends-request-actions">
                    <button
                      className="friends-accept-button"
                      onClick={() => handleAcceptRequest(request.friendshipId)}
                    >
                      수락
                    </button>
                    <button
                      className="friends-decline-button"
                      onClick={() => handleDeclineRequest(request.friendshipId)}
                    >
                      거절
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}

