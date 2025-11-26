import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTokenFromCookies, verifyToken } from '@/lib/auth';
import { FriendshipStatus } from '@prisma/client';
import { getIO } from '@/lib/socket';

// Accept, decline, or delete friendship
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ friendshipId: string }> | { friendshipId: string } }
) {
  try {
    console.log('[API /api/friends/[friendshipId]] PATCH request received');
    
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
    const { friendshipId } = resolvedParams;
    const body = await request.json();
    const { action } = body; // 'ACCEPT', 'DECLINE', 'DELETE'

    console.log('[API /api/friends/[friendshipId]] Processing action:', {
      friendshipId,
      action,
      userId: decoded.userId,
    });

    if (!['ACCEPT', 'DECLINE', 'DELETE'].includes(action)) {
      return NextResponse.json(
        { error: '유효하지 않은 액션입니다.' },
        { status: 400 }
      );
    }

    // Find friendship
    const friendship = await prisma.friendship.findUnique({
      where: { id: friendshipId },
      include: {
        requester: {
          select: {
            id: true,
            email: true,
            name: true,
            profileImageUrl: true,
          },
        },
        addressee: {
          select: {
            id: true,
            email: true,
            name: true,
            profileImageUrl: true,
          },
        },
      },
    });

    if (!friendship) {
      return NextResponse.json(
        { error: '친구 관계를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // Check if user is part of this friendship
    if (
      friendship.requesterId !== decoded.userId &&
      friendship.addresseeId !== decoded.userId
    ) {
      return NextResponse.json(
        { error: '권한이 없습니다.' },
        { status: 403 }
      );
    }

    // Handle actions
    if (action === 'DELETE') {
      // Delete friendship (both users can delete)
      await prisma.friendship.delete({
        where: { id: friendshipId },
      });

      // 양쪽 사용자에게 친구 목록 업데이트 알림 전송
      const io = getIO();
      if (io) {
        io.to(friendship.requesterId).emit('friendsUpdated');
        io.to(friendship.addresseeId).emit('friendsUpdated');
      }

      return NextResponse.json(
        { message: '친구 관계가 삭제되었습니다.' },
        { status: 200 }
      );
    }

    if (action === 'ACCEPT') {
      // Only addressee can accept
      if (friendship.addresseeId !== decoded.userId) {
        return NextResponse.json(
          { error: '친구 요청을 수락할 권한이 없습니다.' },
          { status: 403 }
        );
      }

      if (friendship.status !== FriendshipStatus.PENDING) {
        return NextResponse.json(
          { error: '이미 처리된 친구 요청입니다.' },
          { status: 400 }
        );
      }

      const updated = await prisma.friendship.update({
        where: { id: friendshipId },
        data: { status: FriendshipStatus.ACCEPTED },
        include: {
          requester: {
            select: {
              id: true,
              email: true,
              name: true,
              profileImageUrl: true,
            },
          },
          addressee: {
            select: {
              id: true,
              email: true,
              name: true,
              profileImageUrl: true,
            },
          },
        },
      });

      const friend =
        updated.requesterId === decoded.userId
          ? updated.addressee
          : updated.requester;

      console.log('[API /api/friends/[friendshipId]] Friend request accepted:', {
        friendshipId: updated.id,
        requesterId: updated.requesterId,
        addresseeId: updated.addresseeId,
        friendId: friend.id,
      });

      // 양쪽 사용자에게 친구 목록 업데이트 알림 전송
      const io = getIO();
      if (io) {
        io.to(updated.requesterId).emit('friendsUpdated');
        io.to(updated.addresseeId).emit('friendsUpdated');
      }

      return NextResponse.json(
        {
          message: '친구 요청을 수락했습니다.',
          friendship: {
            id: updated.id,
            friend: {
              id: friend.id,
              email: friend.email,
              name: friend.name,
              profileImageUrl: friend.profileImageUrl,
            },
            status: updated.status,
          },
        },
        { status: 200 }
      );
    }

    if (action === 'DECLINE') {
      // Only addressee can decline
      if (friendship.addresseeId !== decoded.userId) {
        return NextResponse.json(
          { error: '친구 요청을 거절할 권한이 없습니다.' },
          { status: 403 }
        );
      }

      if (friendship.status !== FriendshipStatus.PENDING) {
        return NextResponse.json(
          { error: '이미 처리된 친구 요청입니다.' },
          { status: 400 }
        );
      }

      await prisma.friendship.update({
        where: { id: friendshipId },
        data: { status: FriendshipStatus.DECLINED },
      });

      console.log('[API /api/friends/[friendshipId]] Friend request declined:', {
        friendshipId,
        userId: decoded.userId,
      });

      // 양쪽 사용자에게 친구 목록 업데이트 알림 전송
      const io = getIO();
      if (io) {
        io.to(friendship.requesterId).emit('friendsUpdated');
        io.to(friendship.addresseeId).emit('friendsUpdated');
      }

      return NextResponse.json(
        { message: '친구 요청을 거절했습니다.' },
        { status: 200 }
      );
    }

    return NextResponse.json(
      { error: '알 수 없는 오류가 발생했습니다.' },
      { status: 500 }
    );
  } catch (error) {
    console.error('Update friendship error:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

