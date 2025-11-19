import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTokenFromCookies, verifyToken } from '@/lib/auth';

// Accept team invitation
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

    const decoded = verifyToken(token);

    if (!decoded) {
      return NextResponse.json(
        { error: '유효하지 않은 토큰입니다.' },
        { status: 401 }
      );
    }

    const resolvedParams = await Promise.resolve(params);
    const { teamId } = resolvedParams;

    // Check if user has a pending invitation
    const teamMember = await prisma.teamMember.findUnique({
      where: {
        userId_teamId: {
          userId: decoded.userId,
          teamId: teamId,
        },
      },
    });

    if (!teamMember) {
      return NextResponse.json(
        { error: '초대를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    if (teamMember.status !== 'PENDING') {
      return NextResponse.json(
        { error: teamMember.status === 'ACCEPTED' ? '이미 수락된 초대입니다.' : '유효하지 않은 초대 상태입니다.' },
        { status: 400 }
      );
    }

    // Update status to ACCEPTED
    await prisma.teamMember.update({
      where: {
        userId_teamId: {
          userId: decoded.userId,
          teamId: teamId,
        },
      },
      data: {
        status: 'ACCEPTED',
      },
    });

    // Add user to all team channels (ChatRoomMember)
    const teamChannels = await prisma.teamChannel.findMany({
      where: { teamId: teamId },
      select: { chatRoomId: true },
    });

    // Add user to all channel chat rooms
    if (teamChannels.length > 0) {
      const chatRoomIds = teamChannels.map(tc => tc.chatRoomId);
      
      // Check existing memberships to avoid duplicates
      const existingMemberships = await prisma.chatRoomMember.findMany({
        where: {
          userId: decoded.userId,
          chatRoomId: { in: chatRoomIds },
        },
        select: { chatRoomId: true },
      });

      const existingChatRoomIds = new Set(existingMemberships.map(m => m.chatRoomId));
      const chatRoomIdsToAdd = chatRoomIds.filter(id => !existingChatRoomIds.has(id));

      // Add user to all channel chat rooms
      if (chatRoomIdsToAdd.length > 0) {
        await prisma.chatRoomMember.createMany({
          data: chatRoomIdsToAdd.map(chatRoomId => ({
            userId: decoded.userId,
            chatRoomId: chatRoomId,
          })),
        });
        console.log(`[Team Accept] Added user ${decoded.userId} to ${chatRoomIdsToAdd.length} team channels`);
      }
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('[POST /api/teams/[teamId]/members/accept] Error:', error);
    return NextResponse.json(
      { error: '초대 수락에 실패했습니다.' },
      { status: 500 }
    );
  }
}

