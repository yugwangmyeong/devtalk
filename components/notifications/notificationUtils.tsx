import type { Notification } from '@/types/notification';

// 시간 포맷팅 헬퍼 함수
export const formatTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  // 10분 전까지는 상대 시간 표시
  if (diffMins < 1) return '방금 전';
  if (diffMins < 10) return `${diffMins}분 전`;
  
  // 시간 포맷팅
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? '오후' : '오전';
  const displayHours = hours % 12 || 12;
  const displayMinutes = minutes.toString().padStart(2, '0');
  const timeString = `${ampm} ${displayHours}:${displayMinutes}`;
  
  // 날짜 비교
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  // 오늘인 경우
  if (messageDate.getTime() === today.getTime()) {
    return timeString;
  }
  
  // 어제인 경우
  if (messageDate.getTime() === yesterday.getTime()) {
    return `어제 ${timeString}`;
  }
  
  // 그 이전인 경우 날짜와 시간 표시
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  
  return `${year}.${month}.${day} ${timeString}`;
};

// 알림 타입별 아이콘
export const getNotificationIcon = (type: Notification['type']) => {
  const iconProps = {
    className: 'notification-icon',
    fill: 'none',
    stroke: 'currentColor',
    viewBox: '0 0 24 24',
  };

  switch (type) {
    case 'chat_invite':
      return (
        <svg {...iconProps}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      );
    case 'message':
      return (
        <svg {...iconProps}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      );
    case 'room_created':
      return (
        <svg {...iconProps}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      );
    case 'user_joined':
      return (
        <svg {...iconProps}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      );
    case 'team_invite':
      return (
        <svg {...iconProps}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
        </svg>
      );
    case 'friend_request':
      return (
        <svg {...iconProps}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      );
    default:
      return null;
  }
};

// 알림이 팀 워크스페이스 관련인지 확인
export const isTeamWorkspaceNotification = (notification: Notification): boolean => {
  return (
    notification.type === 'team_invite' ||
    (notification.type === 'message' && !!notification.teamId && !!notification.channelId)
  );
};

// 알림이 개인 채팅 관련인지 확인
export const isPersonalChatNotification = (notification: Notification): boolean => {
  return (
    notification.type === 'friend_request' ||
    notification.type === 'chat_invite' ||
    notification.type === 'room_created' ||
    notification.type === 'user_joined' ||
    (notification.type === 'message' && !!notification.roomId && !notification.teamId)
  );
};

