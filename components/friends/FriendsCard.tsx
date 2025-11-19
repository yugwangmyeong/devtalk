'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import './FriendsCard.css';

interface Friend {
  id: string;
  email: string;
  name: string | null;
  profileImageUrl: string | null;
  friendshipId: string;
  status: string;
  isRequester: boolean;
}

export function FriendsCard() {
  const router = useRouter();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pendingRequests, setPendingRequests] = useState<Friend[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'friends' | 'pending'>('friends');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{
    id: string;
    email: string;
    name: string | null;
    profileImageUrl: string | null;
  }>>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [sendingRequests, setSendingRequests] = useState<Set<string>>(new Set());
  const [showSearch, setShowSearch] = useState(false);

  useEffect(() => {
    fetchFriends();
  }, []);

  const fetchFriends = async () => {
    try {
      setIsLoading(true);
      
      const friendsResponse = await fetch('/api/friends?status=ACCEPTED');
      if (friendsResponse.ok) {
        const friendsData = await friendsResponse.json();
        setFriends(friendsData.friends || []);
      }

      const pendingResponse = await fetch('/api/friends?status=PENDING');
      if (pendingResponse.ok) {
        const pendingData = await pendingResponse.json();
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
    handleSearchUsers(value);
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
        await fetchFriends();
        setSearchQuery('');
        setSearchResults([]);
        setShowSearch(false);
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
        await fetchFriends();
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
        await fetchFriends();
      } else {
        const error = await response.json();
        alert(error.error || '친구 요청 거절에 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to decline friend request:', error);
      alert('친구 요청 거절에 실패했습니다.');
    }
  };

  const handleDeleteFriend = async (friendshipId: string) => {
    if (!confirm('정말 친구를 삭제하시겠습니까?')) {
      return;
    }

    try {
      const response = await fetch(`/api/friends/${friendshipId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'DELETE' }),
      });

      if (response.ok) {
        await fetchFriends();
      } else {
        const error = await response.json();
        alert(error.error || '친구 삭제에 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to delete friend:', error);
      alert('친구 삭제에 실패했습니다.');
    }
  };

  const handleFriendClick = (friend: Friend) => {
    router.push(`/chat?email=${encodeURIComponent(friend.email)}`);
  };

  return (
    <div className="friends-card">
      <div className="friends-card-header">
        <h2 className="friends-card-title">👥 친구</h2>
        <div className="friends-card-actions">
          <button
            className="friends-card-button"
            onClick={() => setShowSearch(!showSearch)}
          >
            {showSearch ? '취소' : '+ 친구 추가'}
          </button>
        </div>
      </div>

      {showSearch && (
        <div className="friends-search-section">
          <input
            type="text"
            className="friends-search-input"
            placeholder="이메일 또는 이름으로 검색..."
            value={searchQuery}
            onChange={handleSearchInputChange}
          />
          {isSearching && (
            <div className="friends-search-loading">검색 중...</div>
          )}
          {searchResults.length > 0 && (
            <div className="friends-search-results">
              {searchResults.map((user) => (
                <div key={user.id} className="friends-search-item">
                  <div className="friends-avatar-small">
                    {user.profileImageUrl ? (
                      <img src={user.profileImageUrl} alt={user.name || user.email} />
                    ) : (
                      <div className="friends-avatar-placeholder-small"></div>
                    )}
                  </div>
                  <div className="friends-info-small">
                    <div className="friends-name-small">{user.name || user.email}</div>
                    {user.name && <div className="friends-email-small">{user.email}</div>}
                  </div>
                  <button
                    className="friends-add-button-small"
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
      )}

      <div className="friends-tabs">
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

      <div className="friends-card-content">
        {isLoading ? (
          <div className="friends-loading">로딩 중...</div>
        ) : activeTab === 'friends' ? (
          friends.length === 0 ? (
            <div className="friends-empty">친구가 없습니다.</div>
          ) : (
            <div className="friends-list">
              {friends.slice(0, 5).map((friend) => (
                <div key={friend.id} className="friends-item">
                  <div
                    className="friends-item-content"
                    onClick={() => handleFriendClick(friend)}
                  >
                    <div className="friends-avatar-small">
                      {friend.profileImageUrl ? (
                        <img
                          src={friend.profileImageUrl}
                          alt={friend.name || friend.email}
                        />
                      ) : (
                        <div className="friends-avatar-placeholder-small"></div>
                      )}
                    </div>
                    <div className="friends-info-small">
                      <div className="friends-name-small">
                        {friend.name || friend.email}
                      </div>
                      {friend.name && (
                        <div className="friends-email-small">{friend.email}</div>
                      )}
                    </div>
                  </div>
                  <button
                    className="friends-delete-button-small"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteFriend(friend.friendshipId);
                    }}
                    title="친구 삭제"
                  >
                    ×
                  </button>
                </div>
              ))}
              {friends.length > 5 && (
                <div className="friends-more">
                  외 {friends.length - 5}명의 친구가 더 있습니다
                </div>
              )}
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
                    <div className="friends-avatar-small">
                      {request.profileImageUrl ? (
                        <img
                          src={request.profileImageUrl}
                          alt={request.name || request.email}
                        />
                      ) : (
                        <div className="friends-avatar-placeholder-small"></div>
                      )}
                    </div>
                    <div className="friends-info-small">
                      <div className="friends-name-small">
                        {request.name || request.email}
                      </div>
                      {request.name && (
                        <div className="friends-email-small">{request.email}</div>
                      )}
                    </div>
                  </div>
                  <div className="friends-request-actions-small">
                    <button
                      className="friends-accept-button-small"
                      onClick={() => handleAcceptRequest(request.friendshipId)}
                    >
                      수락
                    </button>
                    <button
                      className="friends-decline-button-small"
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

