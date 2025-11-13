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
    const decoded = verifyToken(token);

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
    
    // Find DM rooms with exactly 1 member (personal space)
    const personalRoom = await prisma.chatRoom.findFirst({
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
    });

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

