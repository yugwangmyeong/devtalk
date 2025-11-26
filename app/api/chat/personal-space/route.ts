import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTokenFromCookies, verifyToken } from '@/lib/auth';

// Get or create personal space (self DM) for the current user
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
    const decoded = await verifyToken(token);

    if (!decoded) {
      return NextResponse.json(
        { error: '유효하지 않은 토큰입니다.' },
        { status: 401 }
      );
    }

    // Find existing personal space (DM room with only the user as member)
    // More efficient: find rooms where user is a member, then filter by member count
    const userMemberships = await prisma.chatRoomMember.findMany({
      where: {
        userId: decoded.userId,
      },
      select: {
        chatRoomId: true,
      },
    });

    const roomIds = userMemberships.map(m => m.chatRoomId);
    
    // Find all DM rooms with exactly 1 member (personal space)
    // Get the most recent one (by updatedAt) to ensure we use the same room
    const personalRooms = await prisma.chatRoom.findMany({
      where: {
        id: {
          in: roomIds,
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
      orderBy: {
        updatedAt: 'desc', // 가장 최근에 업데이트된 것을 먼저
      },
    });

    // Filter to only personal spaces (exactly 1 member) and get the most recent one
    const personalRoom = personalRooms.find(room => room.members.length === 1);

    // console.log('[API] Personal space lookup:', {
    //   totalRooms: personalRooms.length,
    //   personalSpaces: personalRooms.filter(r => r.members.length === 1).length,
    //   selectedRoomId: personalRoom?.id,
    //   selectedRoomUpdatedAt: personalRoom?.updatedAt,
    // });

    // Check if it's truly a personal space (only one member - the user themselves)
    if (personalRoom && personalRoom.members.length === 1) {
      // Format the response
      const lastMessage = personalRoom.messages[0];
      const formattedRoom = {
        id: personalRoom.id,
        type: personalRoom.type,
        name: '나만의 공간',
        isPersonalSpace: true,
        members: personalRoom.members.map((m: typeof personalRoom.members[0]) => ({
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
        updatedAt: personalRoom.updatedAt.toISOString(),
        createdAt: personalRoom.createdAt.toISOString(),
      };

      return NextResponse.json({ room: formattedRoom }, { status: 200 });
    }

    // Create new personal space if it doesn't exist
    // Double-check that no personal space exists before creating
    const existingPersonalSpace = personalRooms.find(room => room.members.length === 1);
    if (existingPersonalSpace) {
      // console.log('[API] Personal space already exists, returning existing one:', existingPersonalSpace.id);
      // Return the existing one instead of creating a new one
      const lastMessage = existingPersonalSpace.messages[0];
      const formattedRoom = {
        id: existingPersonalSpace.id,
        type: existingPersonalSpace.type,
        name: '나만의 공간',
        isPersonalSpace: true,
        members: existingPersonalSpace.members.map((m: typeof existingPersonalSpace.members[0]) => ({
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
        updatedAt: existingPersonalSpace.updatedAt.toISOString(),
        createdAt: existingPersonalSpace.createdAt.toISOString(),
      };
      return NextResponse.json({ room: formattedRoom }, { status: 200 });
    }

    // console.log('[API] No personal space found, creating new one');
    const newPersonalRoom = await prisma.chatRoom.create({
      data: {
        type: 'DM',
        members: {
          create: [
            { userId: decoded.userId },
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

    const lastMessage = newPersonalRoom.messages[0];
    const formattedRoom = {
      id: newPersonalRoom.id,
      type: newPersonalRoom.type,
      name: '나만의 공간',
      isPersonalSpace: true,
      members: newPersonalRoom.members.map((m: typeof newPersonalRoom.members[0]) => ({
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
      updatedAt: newPersonalRoom.updatedAt.toISOString(),
      createdAt: newPersonalRoom.createdAt.toISOString(),
    };

    return NextResponse.json({ room: formattedRoom }, { status: 200 });
  } catch (error) {
    console.error('Get personal space error:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

