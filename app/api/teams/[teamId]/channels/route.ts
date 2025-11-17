import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTokenFromCookies, verifyToken } from '@/lib/auth';

// Get all channels for a team
export async function GET(
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

    // Handle params as Promise or object
    const resolvedParams = await Promise.resolve(params);
    const { teamId } = resolvedParams;

    // Check if user is a member of the team
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
        { error: '팀 멤버가 아닙니다.' },
        { status: 403 }
      );
    }

    // Get all TeamChannels for this team
    // Only include chatRoom if it's type GROUP (channels only, exclude DM rooms)
    const teamChannels = await prisma.teamChannel.findMany({
      where: {
        teamId: teamId,
        chatRoom: {
          type: 'GROUP', // Only GROUP type rooms (channels)
        },
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
            _count: {
              select: {
                members: true,
                messages: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    const formattedChannels = teamChannels.map((teamChannel) => {
      const chatRoom = teamChannel.chatRoom;
      return {
        id: teamChannel.id,
        name: teamChannel.name,
        description: teamChannel.description,
        teamId: teamChannel.teamId,
        chatRoomId: teamChannel.chatRoomId,
        memberCount: chatRoom._count.members,
        messageCount: chatRoom._count.messages,
        members: chatRoom.members.map((m) => ({
          id: m.user.id,
          email: m.user.email,
          name: m.user.name,
          profileImageUrl: m.user.profileImageUrl,
        })),
        lastMessage: chatRoom.messages[0]
          ? {
              id: chatRoom.messages[0].id,
              content: chatRoom.messages[0].content,
              createdAt: chatRoom.messages[0].createdAt.toISOString(),
              user: {
                id: chatRoom.messages[0].user.id,
                email: chatRoom.messages[0].user.email,
                name: chatRoom.messages[0].user.name,
              },
            }
          : null,
        createdAt: teamChannel.createdAt.toISOString(),
        updatedAt: teamChannel.updatedAt.toISOString(),
      };
    });

    return NextResponse.json({ channels: formattedChannels });
  } catch (error) {
    console.error('[GET /api/teams/[teamId]/channels] Error:', error);
    return NextResponse.json(
      { error: '채널 목록을 가져오는데 실패했습니다.' },
      { status: 500 }
    );
  }
}

// Create a new channel for a team
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

    // Handle params as Promise or object
    const resolvedParams = await Promise.resolve(params);
    const { teamId } = resolvedParams;
    const body = await request.json();
    const { name } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: '채널 이름을 입력해주세요.' },
        { status: 400 }
      );
    }

    if (name.length > 100) {
      return NextResponse.json(
        { error: '채널 이름은 100자 이하여야 합니다.' },
        { status: 400 }
      );
    }

    // Check if user is a member of the team
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
        { error: '팀 멤버가 아닙니다.' },
        { status: 403 }
      );
    }

    // Check if channel name already exists in this team
    const existingChannel = await prisma.teamChannel.findFirst({
      where: {
        teamId: teamId,
        name: name.trim(),
      },
    });

    if (existingChannel) {
      return NextResponse.json(
        { error: '이미 같은 이름의 채널이 있습니다.' },
        { status: 409 }
      );
    }

    // Get all team members to add them to the new channel
    const teamMembers = await prisma.teamMember.findMany({
      where: { teamId: teamId },
      select: { userId: true },
    });

    const teamMemberIds = teamMembers.map(tm => tm.userId);

    // Create new channel (TeamChannel with ChatRoom) for the team
    // Add all team members to the channel automatically
    const chatRoom = await prisma.chatRoom.create({
      data: {
        type: 'GROUP',
        name: name.trim(),
        members: {
          create: teamMemberIds.map(userId => ({
            userId: userId,
          })),
        },
      },
    });

    const teamChannel = await prisma.teamChannel.create({
      data: {
        name: name.trim(),
        teamId: teamId,
        chatRoomId: chatRoom.id,
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
            _count: {
              select: {
                members: true,
                messages: true,
              },
            },
          },
        },
      },
    });

    const channel = teamChannel.chatRoom;

    const formattedChannel = {
      id: teamChannel.id,
      name: teamChannel.name,
      description: teamChannel.description,
      teamId: teamChannel.teamId,
      chatRoomId: teamChannel.chatRoomId,
      memberCount: channel._count.members,
      messageCount: channel._count.messages,
      members: channel.members.map((m) => ({
        id: m.user.id,
        email: m.user.email,
        name: m.user.name,
        profileImageUrl: m.user.profileImageUrl,
      })),
      lastMessage: channel.messages[0]
        ? {
            id: channel.messages[0].id,
            content: channel.messages[0].content,
            createdAt: channel.messages[0].createdAt.toISOString(),
            user: {
              id: channel.messages[0].user.id,
              email: channel.messages[0].user.email,
              name: channel.messages[0].user.name,
            },
          }
        : null,
      createdAt: teamChannel.createdAt.toISOString(),
      updatedAt: teamChannel.updatedAt.toISOString(),
    };

    return NextResponse.json({ channel: formattedChannel }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/teams/[teamId]/channels] Error:', error);
    return NextResponse.json(
      { error: '채널 생성에 실패했습니다.' },
      { status: 500 }
    );
  }
}

