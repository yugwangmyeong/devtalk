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
    
    // Optional filter by room type (DM, GROUP, etc.)
    const typeFilter = request.nextUrl.searchParams.get('type');
    // Optional: get specific room by roomId (for notifications)
    const roomIdParam = request.nextUrl.searchParams.get('roomId');
    
    // If roomId is provided, fetch only that room
    if (roomIdParam) {
      // Verify user is a member of the room
      const member = await prisma.chatRoomMember.findUnique({
        where: {
          userId_chatRoomId: {
            userId: decoded.userId,
            chatRoomId: roomIdParam,
          },
        },
      });

      if (!member) {
        return NextResponse.json(
          { error: '이 채팅방의 멤버가 아닙니다.' },
          { status: 403 }
        );
      }

      // Fetch the specific room
      const room = await prisma.chatRoom.findUnique({
        where: { id: roomIdParam },
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
          teamChannel: {
            select: {
              id: true,
              name: true,
              teamId: true,
            },
          },
        },
      });

      if (!room) {
        return NextResponse.json(
          { error: '채팅방을 찾을 수 없습니다.' },
          { status: 404 }
        );
      }

      // Format the response (same format as below)
      const otherMembers = room.members
        .filter((m) => m.userId !== decoded.userId)
        .map((m) => m.user);

      const isPersonalSpace = room.type === 'DM' && room.members.length === 1;

      const roomName = isPersonalSpace
        ? '나만의 공간'
        : room.type === 'DM' && otherMembers.length > 0
        ? otherMembers[0].name || otherMembers[0].email
        : room.name || '채팅방';

      const lastMessage = room.messages[0];
      const formattedRoom = {
        id: room.id,
        type: room.type,
        name: roomName,
        isPersonalSpace,
        teamChannel: room.teamChannel ? {
          id: room.teamChannel.id,
          name: room.teamChannel.name,
          teamId: room.teamChannel.teamId,
        } : null,
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

      return NextResponse.json({ rooms: [formattedRoom] }, { status: 200 });
    }
    
    // First, get all room IDs the user is a member of
    const userMemberships = await prisma.chatRoomMember.findMany({
      where: {
        userId: decoded.userId,
      },
      select: {
        chatRoomId: true,
      },
    });

    const roomIds = userMemberships.map(m => m.chatRoomId);

    // Build where clause
    const whereClause: any = {
      id: {
        in: roomIds,
      },
      // Exclude team channels (GROUP rooms that are linked to TeamChannel)
      // Team channels should be accessed via /api/teams/[teamId]/channels
      teamChannel: null, // Only include rooms that are NOT team channels
    };
    
    // Add type filter if provided
    if (typeFilter) {
      whereClause.type = typeFilter;
    }

    // Debug: Check all rooms before filtering
    const allRoomsBeforeFilter = await prisma.chatRoom.findMany({
      where: {
        id: {
          in: roomIds,
        },
      },
      include: {
        teamChannel: {
          select: {
            id: true,
            name: true,
            teamId: true,
          },
        },
      },
    });

    console.log('[GET /api/chat/rooms] All rooms before teamChannel filter:', {
      count: allRoomsBeforeFilter.length,
      rooms: allRoomsBeforeFilter.map(r => ({
        id: r.id,
        type: r.type,
        name: r.name,
        hasTeamChannel: !!r.teamChannel,
        teamChannelId: r.teamChannel?.id,
      })),
    });

    // Then, fetch all rooms with their members and messages
    const rooms = await prisma.chatRoom.findMany({
      where: whereClause,
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
        teamChannel: {
          select: {
            id: true,
            name: true,
            teamId: true,
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    console.log('[GET /api/chat/rooms] Found rooms after filter:', {
      count: rooms.length,
      roomIds: rooms.map(r => r.id),
      roomTypes: rooms.map(r => r.type),
      memberCounts: rooms.map(r => r.members.length),
      typeFilter: typeFilter || 'none',
      roomsWithTeamChannel: rooms.filter(r => r.teamChannel).length,
    });

    // Format the response
    const formattedRooms = rooms.map((room) => {
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
        teamChannel: room.teamChannel ? {
          id: room.teamChannel.id,
          name: room.teamChannel.name,
          teamId: room.teamChannel.teamId,
        } : null,
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

    // Check if DM room already exists between these two users
    // More efficient: find rooms where both users are members
    const existingRoomMemberships = await prisma.chatRoomMember.findMany({
      where: {
        userId: {
          in: [decoded.userId, finalOtherUserId],
        },
      },
      select: {
        chatRoomId: true,
        userId: true,
      },
    });

    // Group by roomId and find rooms with exactly 2 members (both users)
    const roomMemberMap = new Map<string, Set<string>>();
    existingRoomMemberships.forEach((membership) => {
      if (!roomMemberMap.has(membership.chatRoomId)) {
        roomMemberMap.set(membership.chatRoomId, new Set());
      }
      roomMemberMap.get(membership.chatRoomId)!.add(membership.userId);
    });

    // Find room IDs that have exactly these 2 users
    const candidateRoomIds = Array.from(roomMemberMap.entries())
      .filter(([_, userIds]) => userIds.size === 2 && userIds.has(decoded.userId) && userIds.has(finalOtherUserId))
      .map(([roomId]) => roomId);

    let existingRoom = null;
    if (candidateRoomIds.length > 0) {
      // Fetch the first matching room with full details
      const rooms = await prisma.chatRoom.findMany({
        where: {
          id: {
            in: candidateRoomIds,
          },
          type: 'DM',
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

      // Verify it has exactly 2 members
      existingRoom = rooms.find((room) => room.members.length === 2);
    }

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

