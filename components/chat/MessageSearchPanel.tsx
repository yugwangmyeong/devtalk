'use client';

import { useState, useEffect, useRef } from 'react';
import type { Message } from './types';
import { getProfileImageUrl } from '@/lib/utils';
import './MessageSearchPanel.css';

interface MessageSearchPanelProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  onMessageClick?: (message: Message) => void;
}

type SortBy = 'newest' | 'oldest' | 'relevance';

export function MessageSearchPanel({
  isOpen,
  onClose,
  roomId,
  onMessageClick,
}: MessageSearchPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('newest');
  const [results, setResults] = useState<Message[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Reset when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setResults([]);
      setHasSearched(false);
      setIsSearching(false);
    }
  }, [isOpen]);

  // Search messages
  const handleSearch = async () => {
    if (!searchQuery.trim() || !roomId) {
      return;
    }

    setIsSearching(true);
    setHasSearched(true);

    try {
      const response = await fetch(
        `/api/chat/messages/search?roomId=${roomId}&query=${encodeURIComponent(searchQuery.trim())}&sortBy=${sortBy}`
      );

      if (response.ok) {
        const data = await response.json();
        setResults(data.messages || []);
      } else {
        console.error('Search failed');
        setResults([]);
      }
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Search on Enter key
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // Format time for search results
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return '방금';
    if (minutes < 60) return `${minutes}분 전`;
    if (hours < 24) return `${hours}시간 전`;
    if (days < 7) return `${days}일 전`;

    const year = date.getFullYear().toString().slice(-2);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}.${month}.${day}`;
  };

  // Highlight search query in message content
  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text;
    
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, index) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={index} className="message-search-highlight">{part}</mark>
      ) : (
        part
      )
    );
  };

  if (!isOpen) return null;

  return (
    <aside className="message-search-panel">
      {/* Header */}
      <div className="message-search-header">
        <div className="message-search-header-title">
          {hasSearched && results.length === 0 ? '결과 없음' : '메시지 검색'}
        </div>
        <button className="message-search-close" onClick={onClose}>
          ×
        </button>
      </div>

      {/* Search Input */}
      <div className="message-search-input-container">
        <div className="message-search-input-wrapper">
          <svg className="message-search-input-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={searchInputRef}
            type="text"
            className="message-search-input"
            placeholder="검색어를 입력하세요..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          {searchQuery && (
            <>
              <button
                className="message-search-clear"
                onClick={() => {
                  setSearchQuery('');
                  setResults([]);
                  setHasSearched(false);
                }}
              >
                ×
              </button>
              <button
                className="message-search-submit"
                onClick={handleSearch}
                disabled={isSearching}
              >
                검색
              </button>
            </>
          )}
        </div>
      </div>

      {/* Sort Tabs */}
      {hasSearched && (
        <div className="message-search-tabs">
          <button
            className={`message-search-tab ${sortBy === 'newest' ? 'active' : ''}`}
            onClick={() => {
              setSortBy('newest');
              if (searchQuery.trim()) {
                setTimeout(() => handleSearch(), 0);
              }
            }}
          >
            신규
          </button>
          <button
            className={`message-search-tab ${sortBy === 'oldest' ? 'active' : ''}`}
            onClick={() => {
              setSortBy('oldest');
              if (searchQuery.trim()) {
                setTimeout(() => handleSearch(), 0);
              }
            }}
          >
            오래된 항목
          </button>
          <button
            className={`message-search-tab ${sortBy === 'relevance' ? 'active' : ''}`}
            onClick={() => {
              setSortBy('relevance');
              if (searchQuery.trim()) {
                setTimeout(() => handleSearch(), 0);
              }
            }}
          >
            연관성
          </button>
        </div>
      )}

      {/* Results */}
      <div className="message-search-results">
        {isSearching ? (
          <div className="message-search-loading">검색 중...</div>
        ) : hasSearched && results.length === 0 ? (
          <div className="message-search-empty">
            <div className="message-search-empty-icon">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <div className="message-search-empty-text">
              <div>아주 넓고 먼 범위를 검색했지만, 아무것</div>
              <div>도 찾을 수 없었어요.</div>
            </div>
          </div>
        ) : results.length > 0 ? (
          <div className="message-search-results-list">
            {results.map((message) => (
              <div
                key={message.id}
                className="message-search-result-item"
                onClick={() => {
                  if (onMessageClick) {
                    onMessageClick(message);
                  }
                  onClose();
                }}
              >
                <div className="message-search-result-avatar">
                  <img
                    src={getProfileImageUrl(message.user.profileImageUrl)}
                    alt={message.user.name || message.user.email}
                  />
                </div>
                <div className="message-search-result-content">
                  <div className="message-search-result-header">
                    <span className="message-search-result-name">
                      {message.user.name || message.user.email}
                      {message.user.teamRole && message.user.teamRole !== 'MEMBER' && (
                        <span className="message-search-result-role">
                          {message.user.teamRole === 'OWNER' ? '👑' : message.user.teamRole === 'ADMIN' ? '⭐' : ''}
                        </span>
                      )}
                    </span>
                    <span className="message-search-result-time">{formatTime(message.createdAt)}</span>
                  </div>
                  <div className="message-search-result-message">
                    {highlightText(message.content, searchQuery)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="message-search-placeholder">
            검색어를 입력하여 메시지를 찾아보세요.
          </div>
        )}
      </div>
    </aside>
  );
}

