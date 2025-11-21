import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTokenFromCookies, verifyToken } from '@/lib/auth';

// Search messages in a chat room
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get('roomId');
    const query = searchParams.get('query');
    const sortBy = searchParams.get('sortBy') || 'newest'; // newest, oldest, relevance
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    if (!roomId) {
      return NextResponse.json(
        { error: '채팅방 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    if (!query || !query.trim()) {
      return NextResponse.json(
        { error: '검색어가 필요합니다.' },
        { status: 400 }
      );
    }

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

    // Verify user is a member of the room
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

    // Check if this is a personal space
    const isPersonalSpace = member.chatRoom.type === 'DM' && member.chatRoom.members.length === 1;

    // Build search query
    const searchQuery = query.trim();
    // For MySQL, we'll use a case-insensitive search with raw query
    // or use Prisma's contains which is case-sensitive by default in MySQL
    // For better results, we can use a raw query, but for simplicity, we'll use contains
    const whereClause: any = {
      chatRoomId: roomId,
      content: {
        contains: searchQuery,
      },
    };

    // Personal space: only show messages from the user themselves
    if (isPersonalSpace) {
      whereClause.userId = decoded.userId;
    }

    // Check if this is a team channel
    const teamChannel = await prisma.teamChannel.findUnique({
      where: { chatRoomId: roomId },
      select: { teamId: true },
    });

    // Determine sort order
    let orderBy: any = {};
    if (sortBy === 'oldest') {
      orderBy = { createdAt: 'asc' };
    } else if (sortBy === 'newest') {
      orderBy = { createdAt: 'desc' };
    } else {
      // For relevance, we'll use a simple approach: order by createdAt desc
      // In a real implementation, you might want to use full-text search
      orderBy = { createdAt: 'desc' };
    }

    // Get messages
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
      orderBy,
      take: limit,
    });

    // If this is a team channel, fetch team roles
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

      const roleMap = new Map(teamMembers.map(tm => [tm.userId, tm.role]));

      messagesWithRoles = messages.map(message => ({
        ...message,
        user: {
          ...message.user,
          teamRole: roleMap.get(message.userId) || null,
        },
      }));
    }

    // For relevance sorting, we could add a simple scoring mechanism
    // For now, we'll just return the results as-is

    return NextResponse.json(
      {
        messages: messagesWithRoles,
        total: messagesWithRoles.length,
        query: searchQuery,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Search Messages] Error:', error);
    return NextResponse.json(
      { error: '메시지 검색에 실패했습니다.' },
      { status: 500 }
    );
  }
}

