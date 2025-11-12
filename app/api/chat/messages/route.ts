import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTokenFromCookies, verifyToken } from '@/lib/auth';

// Get messages for a chat room
export async function GET(request: NextRequest) {
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

    // Get roomId from query params
    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get('roomId');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const cursor = searchParams.get('cursor');

    if (!roomId) {
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

    // Get messages
    // For personal space, only show messages from the user themselves
    const messages = await prisma.message.findMany({
      where: {
        chatRoomId: roomId,
        // 개인 공간인 경우, 자기 자신이 작성한 메시지만 표시
        ...(isPersonalSpace && {
          userId: decoded.userId,
        }),
        ...(cursor && {
          id: {
            lt: cursor,
          },
        }),
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
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });

    // Reverse to get chronological order
    messages.reverse();

    const nextCursor = messages.length > 0 ? messages[0].id : null;

    return NextResponse.json(
      {
        messages,
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

