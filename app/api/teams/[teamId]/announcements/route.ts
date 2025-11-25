import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTokenFromCookies, verifyToken } from '@/lib/auth';
import { ensureAnnouncementChannel } from '@/lib/teamChannels';
import { getIO } from '@/lib/socket';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> | { teamId: string } }
) {
  try {
    const token = getTokenFromCookies(request.cookies);

    if (!token) {
      return NextResponse.json(
        { error: '인증되지 않았습니다.' },
        { status: 401 }
      );
    }

    const decoded = await verifyToken(token);

    if (!decoded) {
      return NextResponse.json(
        { error: '유효하지 않은 토큰입니다.' },
        { status: 401 }
      );
    }

    const resolvedParams = await Promise.resolve(params);
    const { teamId } = resolvedParams;
    const body = await request.json();
    const { sourceMessageId } = body;

    if (!sourceMessageId || typeof sourceMessageId !== 'string') {
      return NextResponse.json(
        { error: '원본 메시지 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    const teamMember = await prisma.teamMember.findUnique({
      where: {
        userId_teamId: {
          userId: decoded.userId,
          teamId,
        },
      },
    });

    if (!teamMember || teamMember.status !== 'ACCEPTED') {
      return NextResponse.json(
        { error: '팀 멤버가 아닙니다.' },
        { status: 403 }
      );
    }

    if (teamMember.role !== 'OWNER' && teamMember.role !== 'ADMIN') {
      return NextResponse.json(
        { error: '공지 채널에 게시할 권한이 없습니다.' },
        { status: 403 }
      );
    }

    const sourceMessage = await prisma.message.findUnique({
      where: { id: sourceMessageId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            profileImageUrl: true,
          },
        },
        chatRoom: {
          include: {
            teamChannel: true,
          },
        },
      },
    });

    if (!sourceMessage) {
      return NextResponse.json(
        { error: '원본 메시지를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    if (!sourceMessage.chatRoom.teamChannel || sourceMessage.chatRoom.teamChannel.teamId !== teamId) {
      return NextResponse.json(
        { error: '이 메시지는 해당 팀 채널에서 생성되지 않았습니다.' },
        { status: 400 }
      );
    }

    const announcementChannel = await ensureAnnouncementChannel(teamId);

    if (!announcementChannel || !announcementChannel.chatRoom) {
      return NextResponse.json(
        { error: '공지 채널을 준비하지 못했습니다.' },
        { status: 500 }
      );
    }

    if (announcementChannel.chatRoomId === sourceMessage.chatRoomId) {
      return NextResponse.json(
        { error: '이미 공지 채널에 있는 메시지입니다.' },
        { status: 400 }
      );
    }

    const authorName = sourceMessage.user.name || sourceMessage.user.email || '알 수 없음';
    const formattedDate = new Intl.DateTimeFormat('ko-KR', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(sourceMessage.createdAt);

    const formattedContent = `📣 ${authorName} • ${formattedDate}\n${sourceMessage.content}`;

    const announcementMessage = await prisma.message.create({
      data: {
        content: formattedContent,
        userId: decoded.userId,
        chatRoomId: announcementChannel.chatRoomId,
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

    await prisma.chatRoom.update({
      where: { id: announcementChannel.chatRoomId },
      data: { updatedAt: new Date() },
    });

    const messagePayload = {
      id: announcementMessage.id,
      content: announcementMessage.content,
      userId: announcementMessage.userId,
      chatRoomId: announcementMessage.chatRoomId,
      createdAt: announcementMessage.createdAt,
      user: {
        ...announcementMessage.user,
        teamRole: teamMember.role,
      },
    };

    const io = getIO();
    if (io) {
      io.to(announcementChannel.chatRoomId).emit('newMessage', messagePayload);
      io.to(announcementChannel.chatRoomId).emit('messageSent', messagePayload);

      const roomMembers = await prisma.chatRoomMember.findMany({
        where: { chatRoomId: announcementChannel.chatRoomId },
        select: { userId: true },
      });

      const roomMessageUpdate = {
        roomId: announcementChannel.chatRoomId,
        lastMessage: {
          id: announcementMessage.id,
          content: announcementMessage.content,
          createdAt: announcementMessage.createdAt.toISOString(),
          user: {
            id: announcementMessage.user.id,
            email: announcementMessage.user.email,
            name: announcementMessage.user.name,
            profileImageUrl: announcementMessage.user.profileImageUrl ?? null,
          },
        },
        updatedAt: new Date().toISOString(),
      };

      const memberUserIds = roomMembers.map((member) => member.userId);
      io.sockets.sockets.forEach((socket) => {
        const authenticatedSocket = socket as typeof socket & { userId?: string };
        if (authenticatedSocket.userId && memberUserIds.includes(authenticatedSocket.userId)) {
          socket.emit('roomMessageUpdate', roomMessageUpdate);
        }
      });
    }

    return NextResponse.json(
      {
        announcement: {
          message: {
            ...messagePayload,
            createdAt: announcementMessage.createdAt.toISOString(),
          },
          sourceMessageId: sourceMessage.id,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[POST /api/teams/[teamId]/announcements] Error:', error);
    return NextResponse.json(
      { error: '공지 채널에 추가하지 못했습니다.' },
      { status: 500 }
    );
  }
}

