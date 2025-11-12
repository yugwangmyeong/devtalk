'use client';

import { ChatRoomHeader } from './ChatRoomHeader';
import { MessagesList } from './MessagesList';
import { MessageInput } from './MessageInput';
import type { ChatRoom, Message } from './types';
import type { User } from '@/stores/useAuthStore';

interface ChatAreaProps {
  room: ChatRoom;
  messages: Message[];
  messageInput: string;
  user: User | null;
  isLoadingMessages: boolean;
  onMessageInputChange: (value: string) => void;
  onSendMessage: () => void;
}

export function ChatArea({
  room,
  messages,
  messageInput,
  user,
  isLoadingMessages,
  onMessageInputChange,
  onSendMessage,
}: ChatAreaProps) {
  return (
    <>
      <ChatRoomHeader room={room} user={user} />

      <div className="chat-messages-area">
        <MessagesList
          messages={messages}
          currentUserId={user?.id}
          isLoading={isLoadingMessages}
          isPersonalSpace={room.isPersonalSpace}
        />
      </div>

      <MessageInput
        value={messageInput}
        onChange={onMessageInputChange}
        onSend={onSendMessage}
        disabled={false}
      />
    </>
  );
}

