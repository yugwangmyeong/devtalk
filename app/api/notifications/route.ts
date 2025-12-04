import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTokenFromCookies, verifyToken } from '@/lib/auth';

// Get user notifications
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get('unreadOnly') === 'true';
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    // Get notifications from database
    let notifications;
    try {
      // 친구 요청 알림의 경우, 이미 처리된(PENDING이 아닌) 친구 요청에 대한 알림은 제외
      const allNotifications = await prisma.notification.findMany({
        where: {
          userId: decoded.userId,
          ...(unreadOnly && { read: false }),
        },
        include: {
          sender: {
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
        take: limit * 2, // 필터링 후에도 충분한 개수를 위해 더 많이 가져옴
      });

      // 친구 요청 알림 중 이미 처리된 것은 제외
      const friendRequestNotifications = allNotifications.filter(
        (n) => n.type === 'FRIEND_REQUEST' && n.friendshipId
      );

      if (friendRequestNotifications.length > 0) {
        const friendshipIds = friendRequestNotifications
          .map((n) => n.friendshipId)
          .filter((id): id is string => id !== null);

        // 해당 친구 요청들의 현재 상태 확인
        const friendships = await prisma.friendship.findMany({
          where: {
            id: { in: friendshipIds },
          },
          select: {
            id: true,
            status: true,
          },
        });

        const processedFriendshipIds = new Set(
          friendships
            .filter((f) => f.status !== 'PENDING')
            .map((f) => f.id)
        );

        // 처리된 친구 요청 알림 제외
        notifications = allNotifications.filter((n) => {
          if (n.type === 'FRIEND_REQUEST' && n.friendshipId) {
            return !processedFriendshipIds.has(n.friendshipId);
          }
          return true;
        }).slice(0, limit); // 최종적으로 limit만큼만 반환
      } else {
        notifications = allNotifications.slice(0, limit);
      }
    } catch (error: any) {
      // 테이블이 없는 경우 빈 배열 반환
      if (error?.code === 'P2021') {
        console.warn('[API /api/notifications] Notifications table does not exist. Please run: npx prisma db push');
        return NextResponse.json(
          { notifications: [] },
          { status: 200 }
        );
      }
      throw error; // 다른 에러는 다시 throw
    }

    // Format notifications
    const formattedNotifications = notifications.map((notification) => ({
      id: notification.id,
      type: notification.type.toLowerCase() === 'friend_request' ? 'friend_request' : 
            notification.type.toLowerCase() === 'team_invite' ? 'team_invite' : 
            notification.type.toLowerCase() === 'message' ? 'message' : 
            notification.type.toLowerCase() === 'team_message' ? 'message' : 'message',
      title: notification.title,
      message: notification.message,
      read: notification.read,
      friendshipId: notification.friendshipId,
      teamId: notification.teamId,
      teamName: notification.teamName,
      roomId: notification.roomId,
      roomName: notification.roomName,
      channelId: notification.channelId,
      createdAt: notification.createdAt.toISOString(),
      user: notification.sender ? {
        id: notification.sender.id,
        email: notification.sender.email,
        name: notification.sender.name,
        profileImageUrl: notification.sender.profileImageUrl,
      } : undefined,
    }));

    return NextResponse.json(
      { notifications: formattedNotifications },
      { status: 200 }
    );
  } catch (error) {
    console.error('Get notifications error:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// Mark notification as read
export async function PATCH(request: NextRequest) {
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

    const body = await request.json();
    const { notificationId, read } = body;

    if (!notificationId) {
      return NextResponse.json(
        { error: '알림 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    // Verify notification belongs to user
    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification || notification.userId !== decoded.userId) {
      return NextResponse.json(
        { error: '알림을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // Update notification
    const updated = await prisma.notification.update({
      where: { id: notificationId },
      data: { read: read !== undefined ? read : true },
    });

    return NextResponse.json(
      { notification: updated },
      { status: 200 }
    );
  } catch (error) {
    console.error('Update notification error:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}


