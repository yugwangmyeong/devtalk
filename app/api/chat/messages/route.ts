import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTokenFromCookies, verifyToken } from '@/lib/auth';

// Get messages for a chat room
export async function GET(request: NextRequest) {
  try {
    // Get roomId from query params first for logging
    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get('roomId');
    
    console.log('[API] GET /api/chat/messages called:', {
      roomId,
      url: request.url,
    });

    // Get token from cookies
    const token = getTokenFromCookies(request.cookies);

    if (!token) {
      console.log('[API] No token found');
      return NextResponse.json(
        { error: '인증되지 않았습니다.' },
        { status: 401 }
      );
    }

    // Verify token
    const decoded = verifyToken(token);

    if (!decoded) {
      console.log('[API] Invalid token');
      return NextResponse.json(
        { error: '유효하지 않은 토큰입니다.' },
        { status: 401 }
      );
    }

    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const cursor = searchParams.get('cursor');

    if (!roomId) {
      console.log('[API] No roomId provided');
      return NextResponse.json(
        { error: '채팅방 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    // Verify user is a member of the room and check if it's a personal space
    const member = await prisma.chatRoomMember.findUnique({
      where: {
        userId_chatRoomId: {
          userId: decoded.userId,
          chatRoomId: roomId,
        },
      },
      include: {
        chatRoom: {
          include: {
            members: true,
          },
        },
      },
    });

    if (!member) {
      return NextResponse.json(
        { error: '이 채팅방의 멤버가 아닙니다.' },
        { status: 403 }
      );
    }

    // Check if this is a personal space (only one member - the user themselves)
    const isPersonalSpace = member.chatRoom.type === 'DM' && member.chatRoom.members.length === 1;

    console.log('[API] Fetching messages:', {
      roomId,
      userId: decoded.userId,
      isPersonalSpace,
      memberCount: member.chatRoom.members.length,
    });

    // Check if this is a team channel (GROUP room linked to TeamChannel)
    const teamChannel = await prisma.teamChannel.findUnique({
      where: { chatRoomId: roomId },
      select: { teamId: true },
    });

    // Get messages
    // For personal space, only show messages from the user themselves
    const whereClause: any = {
      chatRoomId: roomId,
    };

    // 개인 공간인 경우, 자기 자신이 작성한 메시지만 표시
    if (isPersonalSpace) {
      whereClause.userId = decoded.userId;
      console.log('[API] Personal space filter applied:', { userId: decoded.userId });
    }

    if (cursor) {
      whereClause.id = { lt: cursor };
    }

    console.log('[API] Message query where clause:', whereClause);

    const messages = await prisma.message.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            profileImageUrl: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });

    console.log('[API] Messages found:', {
      count: messages.length,
      messageIds: messages.map(m => m.id),
      userIds: messages.map(m => m.userId),
    });

    // Reverse to get chronological order
    messages.reverse();

    // If this is a team channel, fetch team roles for each message sender
    let messagesWithRoles = messages;
    if (teamChannel) {
      const userIds = [...new Set(messages.map(m => m.userId))];
      const teamMembers = await prisma.teamMember.findMany({
        where: {
          teamId: teamChannel.teamId,
          userId: { in: userIds },
        },
        select: {
          userId: true,
          role: true,
        },
      });

      // Create a map of userId -> role
      const roleMap = new Map(teamMembers.map(tm => [tm.userId, tm.role]));

      // Add role to each message
      messagesWithRoles = messages.map(message => ({
        ...message,
        user: {
          ...message.user,
          teamRole: roleMap.get(message.userId) || null,
        },
      }));
    }

    const nextCursor = messages.length > 0 ? messages[0].id : null;

    return NextResponse.json(
      {
        messages: messagesWithRoles,
        nextCursor,
        hasMore: messages.length === limit,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Get messages error:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// Create a new message
export async function POST(request: NextRequest) {
  try {
    // Get token from cookies
    const token = getTokenFromCookies(request.cookies);

    if (!token) {
      return NextResponse.json(
        { error: '인증되지 않았습니다.' },
        { status: 401 }
      );
    }

    // Verify token
    const decoded = verifyToken(token);

    if (!decoded) {
      return NextResponse.json(
        { error: '유효하지 않은 토큰입니다.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { roomId, content } = body;

    if (!roomId || !content) {
      return NextResponse.json(
        { error: '채팅방 ID와 메시지 내용이 필요합니다.' },
        { status: 400 }
      );
    }

    if (!content.trim()) {
      return NextResponse.json(
        { error: '메시지 내용이 비어있습니다.' },
        { status: 400 }
      );
    }

    // Verify user is a member of the room
    const member = await prisma.chatRoomMember.findUnique({
      where: {
        userId_chatRoomId: {
          userId: decoded.userId,
          chatRoomId: roomId,
        },
      },
    });

    if (!member) {
      return NextResponse.json(
        { error: '이 채팅방의 멤버가 아닙니다.' },
        { status: 403 }
      );
    }

    // Check if this is a personal space
    const chatRoom = await prisma.chatRoom.findUnique({
      where: { id: roomId },
      include: { members: true },
    });
    
    const isPersonalSpace = chatRoom?.type === 'DM' && chatRoom?.members.length === 1;
    
    console.log('[API] Creating message:', {
      roomId,
      userId: decoded.userId,
      content: content.trim().substring(0, 50),
      isPersonalSpace,
    });

    // Create message
    const message = await prisma.message.create({
      data: {
        content: content.trim(),
        userId: decoded.userId,
        chatRoomId: roomId,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            profileImageUrl: true,
          },
        },
      },
    });

    console.log('[API] Message created successfully:', {
      messageId: message.id,
      roomId: message.chatRoomId,
      userId: message.userId,
      isPersonalSpace,
    });

    // Update chat room's updatedAt
    await prisma.chatRoom.update({
      where: { id: roomId },
      data: { updatedAt: new Date() },
    });

    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    console.error('Create message error:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

