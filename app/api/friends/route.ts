import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTokenFromCookies, verifyToken } from '@/lib/auth';
import { getIO } from '@/lib/socket';
import { FriendshipStatus } from '@prisma/client';

// Get friends list
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
    const statusParam = searchParams.get('status') || 'ACCEPTED'; // 기본값: 수락된 친구만
    
    // Validate status parameter
    const validStatuses = Object.values(FriendshipStatus);
    const status = validStatuses.includes(statusParam as FriendshipStatus) 
      ? (statusParam as FriendshipStatus) 
      : FriendshipStatus.ACCEPTED;

    // Get all friendships where user is requester or addressee and status matches
    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [
          { requesterId: decoded.userId },
          { addresseeId: decoded.userId },
        ],
        status: status,
      },
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
      orderBy: {
        updatedAt: 'desc',
      },
    });

    // Format response: return friend info (not the current user)
    const friends = friendships.map((friendship) => {
      const friend =
        friendship.requesterId === decoded.userId
          ? friendship.addressee
          : friendship.requester;
      return {
        id: friend.id,
        email: friend.email,
        name: friend.name,
        profileImageUrl: friend.profileImageUrl,
        friendshipId: friendship.id,
        status: friendship.status,
        createdAt: friendship.createdAt.toISOString(),
        updatedAt: friendship.updatedAt.toISOString(),
        isRequester: friendship.requesterId === decoded.userId,
      };
    });

    return NextResponse.json({ friends }, { status: 200 });
  } catch (error) {
    console.error('Get friends error:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// Send friend request
export async function POST(request: NextRequest) {
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
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { error: '사용자 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    if (userId === decoded.userId) {
      return NextResponse.json(
        { error: '자기 자신에게 친구 요청을 보낼 수 없습니다.' },
        { status: 400 }
      );
    }

    // Check if user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // Check if friendship already exists
    const existingFriendship = await prisma.friendship.findFirst({
      where: {
        OR: [
          {
            requesterId: decoded.userId,
            addresseeId: userId,
          },
          {
            requesterId: userId,
            addresseeId: decoded.userId,
          },
        ],
      },
    });

    if (existingFriendship) {
      if (existingFriendship.status === FriendshipStatus.ACCEPTED) {
        return NextResponse.json(
          { error: '이미 친구입니다.' },
          { status: 400 }
        );
      }
      if (existingFriendship.status === FriendshipStatus.PENDING) {
        if (existingFriendship.requesterId === decoded.userId) {
          return NextResponse.json(
            { error: '이미 친구 요청을 보냈습니다.' },
            { status: 400 }
          );
        } else {
          // If the other user sent a request, accept it
          const accepted = await prisma.friendship.update({
            where: { id: existingFriendship.id },
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
            accepted.requesterId === decoded.userId
              ? accepted.addressee
              : accepted.requester;

          // 양쪽 사용자에게 친구 목록 업데이트 알림 전송
          const io = getIO();
          if (io) {
            io.to(accepted.requesterId).emit('friendsUpdated');
            io.to(accepted.addresseeId).emit('friendsUpdated');
          }

          return NextResponse.json(
            {
              message: '친구 요청이 자동으로 수락되었습니다.',
              friendship: {
                id: accepted.id,
                friend: {
                  id: friend.id,
                  email: friend.email,
                  name: friend.name,
                  profileImageUrl: friend.profileImageUrl,
                },
                status: accepted.status,
              },
            },
            { status: 200 }
          );
        }
      }
      if (existingFriendship.status === FriendshipStatus.BLOCKED) {
        return NextResponse.json(
          { error: '차단된 사용자입니다.' },
          { status: 403 }
        );
      }
    }

    // Create new friendship request
    const friendship = await prisma.friendship.create({
      data: {
        requesterId: decoded.userId,
        addresseeId: userId,
        status: FriendshipStatus.PENDING,
      },
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

    // Save notification to database (항상 저장)
    const requesterName = friendship.requester.name || friendship.requester.email || '알 수 없는 사용자';
    let notification;
    try {
      notification = await prisma.notification.create({
        data: {
          userId: userId,
          type: 'FRIEND_REQUEST',
          title: '친구 요청',
          message: `${requesterName}님이 친구 요청을 보냈습니다.`,
          friendshipId: friendship.id,
          senderId: friendship.requester.id,
          read: false,
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
      });
    } catch (notificationError: any) {
      // 테이블이 없는 경우 등 알림 저장 실패 시에도 친구 요청은 성공 처리
      console.error('[API /api/friends] Failed to create notification:', notificationError);
      if (notificationError?.code === 'P2021') {
        console.warn('[API /api/friends] Notifications table does not exist. Please run: npx prisma db push');
      }
      // 알림 없이 계속 진행 (친구 요청은 성공)
      notification = null;
    }

    // console.log('[API /api/friends] Notification saved to database:', notification.id);

    // Send notification to the addressee via socket (if online)
    const io = getIO();
    if (io && notification) {
      // Check if user is in the room before sending
      const userRoom = io.sockets.adapter.rooms.get(userId);
      const isUserOnline = !!userRoom && userRoom.size > 0;
      
      // console.log('[API /api/friends] User room check:', {
      //   userId,
      //   roomExists: !!userRoom,
      //   socketsInRoom: userRoom ? Array.from(userRoom) : [],
      //   isUserOnline,
      // });
      
      if (isUserOnline && notification.sender) {
        // Socket.IO로 실시간 알림 전송
        const notificationPayload = {
          id: notification.id,
          type: 'friend_request',
          title: notification.title,
          message: notification.message,
          friendshipId: notification.friendshipId,
          createdAt: notification.createdAt.toISOString(),
          read: notification.read,
          user: {
            id: notification.sender.id,
            email: notification.sender.email,
            name: notification.sender.name,
            profileImageUrl: notification.sender.profileImageUrl,
          },
        };
        
        io.to(userId).emit('notification', notificationPayload);
        // console.log('[API /api/friends] Real-time notification sent via Socket.IO to user:', userId);
      } else {
        // console.log('[API /api/friends] User is not online, notification saved to DB (will be retrieved on next login)');
      }
    } else {
      // console.warn('[API /api/friends] Socket.IO instance not available, notification saved to DB only');
    }

    return NextResponse.json(
      {
        message: '친구 요청을 보냈습니다.',
        friendship: {
          id: friendship.id,
          friend: friendship.addressee,
          status: friendship.status,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Send friend request error:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined,
    });
    return NextResponse.json(
      { 
        error: '서버 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

