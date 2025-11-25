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

    // Send notification to the addressee via socket
    const io = getIO();
    console.log('[API /api/friends] Sending friend request notification:', {
      io: !!io,
      userId,
      friendshipId: friendship.id,
      requesterName: friendship.requester.name || friendship.requester.email,
    });
    
    if (io) {
      // friendshipId를 명시적으로 포함한 알림 데이터 생성
      const notificationPayload = {
        id: `friend-request-${friendship.id}`,
        type: 'friend_request',
        title: '친구 요청',
        message: `${friendship.requester.name || friendship.requester.email}님이 친구 요청을 보냈습니다.`,
        friendshipId: friendship.id, // 명시적으로 friendshipId 포함 (가장 중요!)
        createdAt: friendship.createdAt.toISOString(),
        read: false,
        user: {
          id: friendship.requester.id,
          email: friendship.requester.email,
          name: friendship.requester.name,
          profileImageUrl: friendship.requester.profileImageUrl,
        },
      };
      
      console.log('[API /api/friends] Emitting notification to user:', userId);
      console.log('[API /api/friends] Notification payload:', JSON.stringify(notificationPayload, null, 2));
      console.log('[API /api/friends] friendshipId:', notificationPayload.friendshipId);
      console.log('[API /api/friends] friendshipId type:', typeof notificationPayload.friendshipId);
      console.log('[API /api/friends] hasFriendshipId:', !!notificationPayload.friendshipId);
      
      // Check if user is in the room before sending
      const userRoom = io.sockets.adapter.rooms.get(userId);
      const isUserOnline = !!userRoom && userRoom.size > 0;
      
      console.log('[API /api/friends] User room check before sending:', {
        userId,
        roomExists: !!userRoom,
        socketsInRoom: userRoom ? Array.from(userRoom) : [],
        isUserOnline,
      });
      
      if (isUserOnline) {
        // Socket.IO로 알림 전송
        io.to(userId).emit('notification', notificationPayload);
        console.log('[API /api/friends] Notification sent via Socket.IO to user:', userId);
      } else {
        console.warn('[API /api/friends] User is not online, notification will not be delivered via Socket.IO');
        console.warn('[API /api/friends] User should reconnect Socket or refresh page to receive notifications');
        // TODO: 나중에 DB에 알림을 저장하고 사용자가 접속하면 조회하도록 구현할 수 있음
      }
    } else {
      console.error('[API /api/friends] Socket.IO instance not available');
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
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

