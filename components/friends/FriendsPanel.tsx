'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import './FriendsPanel.css';

interface Friend {
  id: string;
  email: string;
  name: string | null;
  profileImageUrl: string | null;
  friendshipId: string;
  status: string;
  isRequester: boolean;
}

interface FriendsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function FriendsPanel({ isOpen, onClose }: FriendsPanelProps) {
  const router = useRouter();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{
    id: string;
    email: string;
    name: string | null;
    profileImageUrl: string | null;
  }>>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [sendingRequests, setSendingRequests] = useState<Set<string>>(new Set());
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const fetchFriends = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Fetch accepted friends only
      const friendsResponse = await fetch('/api/friends?status=ACCEPTED', {
        credentials: 'include',
      });
      if (friendsResponse.ok) {
        const friendsData = await friendsResponse.json();
        console.log('[FriendsPanel] Fetched friends:', friendsData.friends?.length || 0);
        setFriends(friendsData.friends || []);
      } else {
        console.error('[FriendsPanel] Failed to fetch friends:', friendsResponse.status);
      }
    } catch (error) {
      console.error('[FriendsPanel] Failed to fetch friends:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchFriends();
    }
  }, [isOpen, fetchFriends]);

  // 친구 목록 업데이트 이벤트 리스너 (패널이 열려있든 닫혀있든 항상 리스닝)
  useEffect(() => {
    const handleFriendsUpdated = (event: Event) => {
      console.log('[FriendsPanel] friendsUpdated event received:', {
        isOpen,
        eventType: event.type,
      });
      // 패널이 열려있으면 즉시 새로고침, 닫혀있으면 다음에 열릴 때 새로고침됨
      if (isOpen) {
        console.log('[FriendsPanel] Panel is open, refreshing immediately...');
        fetchFriends();
      } else {
        console.log('[FriendsPanel] Panel is closed, will refresh when opened');
        // 닫혀있어도 다음에 열릴 때 자동으로 새로고침되도록 플래그 설정
        // (useEffect에서 isOpen이 true가 되면 자동으로 fetchFriends 호출됨)
      }
    };

    console.log('[FriendsPanel] Setting up friendsUpdated event listener, isOpen:', isOpen);
    window.addEventListener('friendsUpdated', handleFriendsUpdated);
    return () => {
      console.log('[FriendsPanel] Removing friendsUpdated event listener');
      window.removeEventListener('friendsUpdated', handleFriendsUpdated);
    };
  }, [isOpen, fetchFriends]);

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

  const handleSearchUsers = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(`/api/users/search?q=${encodeURIComponent(query.trim())}`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        // Filter out existing friends
        const friendIds = new Set(friends.map(f => f.id));
        const filteredUsers = (data.users || []).filter(
          (u: { id: string }) => !friendIds.has(u.id)
        );
        setSearchResults(filteredUsers);
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      console.error('Failed to search users:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    // 실시간 검색 제거 - 버튼 클릭 시에만 검색
  };

  const handleSearchSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (searchQuery.trim()) {
      handleSearchUsers(searchQuery);
    }
  };

  const handleSearchKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearchSubmit();
    }
  };

  const handleAddFriend = async (userId: string) => {
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
        // 친구 요청이 자동으로 수락된 경우 즉시 새로고침
        if (data.friendship?.status === 'ACCEPTED') {
          await fetchFriends(); // Refresh list
          // 다른 컴포넌트에도 알림
          window.dispatchEvent(new CustomEvent('friendsUpdated'));
        }
        setSearchQuery('');
        setSearchResults([]);
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


  const handleFriendClick = (friend: Friend, e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenMenuId(openMenuId === friend.id ? null : friend.id);
  };

  const handleStartChat = (friend: Friend) => {
    setOpenMenuId(null);
    router.push(`/chat?email=${encodeURIComponent(friend.email)}`);
    onClose();
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

  if (!isOpen) {
    return null;
  }

  return (
    <div className="friends-panel">
      <div className="friends-panel-header">
        <h2 className="friends-panel-title">친구</h2>
        {/* <button
          className="friends-panel-close"
          onClick={onClose}
          title="닫기"
        >
          ×
        </button> */}
      </div>

      <div className="friends-panel-content">
        {/* Search Section */}
        <div className="friends-search-section">
          <form onSubmit={handleSearchSubmit} className="friends-search-form">
            <input
              type="text"
              className="friends-search-input"
              placeholder="이메일 또는 이름으로 검색..."
              value={searchQuery}
              onChange={handleSearchInputChange}
              onKeyPress={handleSearchKeyPress}
            />
            <button
              type="submit"
              className="friends-search-button"
              disabled={isSearching || !searchQuery.trim()}
            >
              {isSearching ? '검색 중...' : '검색'}
            </button>
          </form>
          {searchResults.length > 0 && (
            <div className="friends-search-results">
              {searchResults.map((user) => (
                <div key={user.id} className="friends-search-item">
                  <div className="friends-avatar">
                    {user.profileImageUrl ? (
                      <img src={user.profileImageUrl} alt={user.name || user.email} />
                    ) : (
                      <div className="friends-avatar-placeholder"></div>
                    )}
                  </div>
                  <div className="friends-info">
                    <div className="friends-name">{user.name || user.email}</div>
                    {user.name && <div className="friends-email">{user.email}</div>}
                  </div>
                  <button
                    className="friends-add-button"
                    onClick={() => handleAddFriend(user.id)}
                    disabled={sendingRequests.has(user.id)}
                  >
                    {sendingRequests.has(user.id) ? '요청 중...' : '+ 친구'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Friends List */}
        <div className="friends-content">
          {isLoading ? (
            <div className="friends-loading">로딩 중...</div>
          ) : friends.length === 0 ? (
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
                      {friend.profileImageUrl ? (
                        <img
                          src={friend.profileImageUrl}
                          alt={friend.name || friend.email}
                        />
                      ) : (
                        <div className="friends-avatar-placeholder"></div>
                      )}
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
          )}
        </div>
      </div>
    </div>
  );
}

