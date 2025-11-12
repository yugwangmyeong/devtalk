import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTokenFromCookies, verifyToken } from '@/lib/auth';

// Get all chat rooms for the current user
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

    // Get all chat rooms for the user
    console.log('[GET /api/chat/rooms] Fetching rooms for user:', decoded.userId);
    
    const chatRooms = await prisma.chatRoomMember.findMany({
      where: {
        userId: decoded.userId,
      },
      include: {
        chatRoom: {
          include: {
            members: {
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
            },
            messages: {
              take: 1,
              orderBy: {
                createdAt: 'desc',
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
            },
          },
        },
      },
      orderBy: {
        chatRoom: {
          updatedAt: 'desc',
        },
      },
    });

    console.log('[GET /api/chat/rooms] Found rooms:', {
      count: chatRooms.length,
      roomIds: chatRooms.map(m => m.chatRoom.id),
      roomTypes: chatRooms.map(m => m.chatRoom.type),
      memberCounts: chatRooms.map(m => m.chatRoom.members.length),
    });

    // Format the response
    const formattedRooms = chatRooms.map((member) => {
      const room = member.chatRoom;
      const otherMembers = room.members
        .filter((m) => m.userId !== decoded.userId)
        .map((m) => m.user);

      // Check if this is a personal space (only the user themselves)
      const isPersonalSpace = room.type === 'DM' && room.members.length === 1;

      // For DM rooms, get the other user's name
      // For personal space, use special name
      const roomName = isPersonalSpace
        ? '나만의 공간'
        : room.type === 'DM' && otherMembers.length > 0
        ? otherMembers[0].name || otherMembers[0].email
        : room.name || '채팅방';

      const lastMessage = room.messages[0];
      return {
        id: room.id,
        type: room.type,
        name: roomName,
        isPersonalSpace,
        members: room.members.map((m) => ({
          id: m.user.id,
          email: m.user.email,
          name: m.user.name,
          profileImageUrl: m.user.profileImageUrl,
        })),
        lastMessage: lastMessage
          ? {
              id: lastMessage.id,
              content: lastMessage.content,
              createdAt: lastMessage.createdAt.toISOString(),
              user: {
                id: lastMessage.user.id,
                email: lastMessage.user.email,
                name: lastMessage.user.name,
              },
            }
          : null,
        updatedAt: room.updatedAt.toISOString(),
        createdAt: room.createdAt.toISOString(),
      };
    });

    // Sort: personal space first, then by updatedAt
    formattedRooms.sort((a, b) => {
      if (a.isPersonalSpace && !b.isPersonalSpace) return -1;
      if (!a.isPersonalSpace && b.isPersonalSpace) return 1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

    return NextResponse.json({ rooms: formattedRooms }, { status: 200 });
  } catch (error) {
    console.error('Get chat rooms error:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// Create a new DM chat room
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
    const { userId: otherUserId, email: otherUserEmail } = body;

    if (!otherUserId && !otherUserEmail) {
      return NextResponse.json(
        { error: '사용자 ID 또는 이메일이 필요합니다.' },
        { status: 400 }
      );
    }

    // Find user by userId or email
    let otherUser;
    if (otherUserId) {
      otherUser = await prisma.user.findUnique({
        where: { id: otherUserId },
      });
    } else if (otherUserEmail) {
      otherUser = await prisma.user.findUnique({
        where: { email: otherUserEmail.trim() },
      });
    }

    if (!otherUser) {
      return NextResponse.json(
        { error: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const finalOtherUserId = otherUser.id;

    if (finalOtherUserId === decoded.userId) {
      return NextResponse.json(
        { error: '자기 자신과는 채팅할 수 없습니다.' },
        { status: 400 }
      );
    }

    // Check if DM room already exists
    const existingRooms = await prisma.chatRoom.findMany({
      where: {
        type: 'DM',
        members: {
          every: {
            userId: {
              in: [decoded.userId, finalOtherUserId],
            },
          },
        },
      },
      include: {
        members: true,
      },
    });

    // Check if there's a room with exactly these two users
    const existingRoom = existingRooms.find(
      (room) =>
        room.members.length === 2 &&
        room.members.some((m) => m.userId === decoded.userId) &&
        room.members.some((m) => m.userId === finalOtherUserId)
    );

    // Format room response (same format as GET)
    const formatRoom = (room: any) => {
      const otherMembers = room.members
        .filter((m: any) => m.userId !== decoded.userId)
        .map((m: any) => m.user);

      const isPersonalSpace = room.type === 'DM' && room.members.length === 1;

      const roomName = isPersonalSpace
        ? '나만의 공간'
        : room.type === 'DM' && otherMembers.length > 0
        ? otherMembers[0].name || otherMembers[0].email
        : room.name || '채팅방';

      return {
        id: room.id,
        type: room.type,
        name: roomName,
        isPersonalSpace,
        members: room.members.map((m: any) => ({
          id: m.user.id,
          email: m.user.email,
          name: m.user.name,
          profileImageUrl: m.user.profileImageUrl,
        })),
        lastMessage: null,
        updatedAt: room.updatedAt.toISOString(),
        createdAt: room.createdAt.toISOString(),
      };
    };

    if (existingRoom) {
      // Fetch the room with messages for formatting
      const roomWithMessages = await prisma.chatRoom.findUnique({
        where: { id: existingRoom.id },
        include: {
          members: {
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
          },
          messages: {
            take: 1,
            orderBy: {
              createdAt: 'desc',
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
          },
        },
      });

      if (roomWithMessages) {
        const formattedRoom = formatRoom(roomWithMessages);
        if (roomWithMessages.messages[0]) {
          const lastMessage = roomWithMessages.messages[0];
          formattedRoom.lastMessage = {
            id: lastMessage.id,
            content: lastMessage.content,
            createdAt: lastMessage.createdAt.toISOString(),
            user: {
              id: lastMessage.user.id,
              email: lastMessage.user.email,
              name: lastMessage.user.name,
            },
          };
        }
        return NextResponse.json(
          { room: formattedRoom, alreadyExists: true },
          { status: 200 }
        );
      }
    }

    // Create new DM room
    console.log('[POST /api/chat/rooms] Creating new DM room:', {
      userId: decoded.userId,
      otherUserId: finalOtherUserId,
    });

    const newRoom = await prisma.chatRoom.create({
      data: {
        type: 'DM',
        members: {
          create: [
            { userId: decoded.userId },
            { userId: finalOtherUserId },
          ],
        },
      },
      include: {
        members: {
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
        },
        messages: {
          take: 1,
          orderBy: {
            createdAt: 'desc',
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
        },
      },
    });

    console.log('[POST /api/chat/rooms] Room created successfully:', {
      roomId: newRoom.id,
      memberCount: newRoom.members.length,
      memberIds: newRoom.members.map(m => m.userId),
    });

    // Verify the room was saved by checking ChatRoomMember records
    const verifyMembers = await prisma.chatRoomMember.findMany({
      where: {
        chatRoomId: newRoom.id,
      },
    });
    console.log('[POST /api/chat/rooms] Verified members in DB:', {
      roomId: newRoom.id,
      memberCount: verifyMembers.length,
      memberIds: verifyMembers.map(m => m.userId),
    });

    const formattedNewRoom = formatRoom(newRoom);
    if (newRoom.messages[0]) {
      const lastMessage = newRoom.messages[0];
      formattedNewRoom.lastMessage = {
        id: lastMessage.id,
        content: lastMessage.content,
        createdAt: lastMessage.createdAt.toISOString(),
        user: {
          id: lastMessage.user.id,
          email: lastMessage.user.email,
          name: lastMessage.user.name,
        },
      };
    }

    return NextResponse.json({ room: formattedNewRoom }, { status: 201 });
  } catch (error) {
    console.error('Create chat room error:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

