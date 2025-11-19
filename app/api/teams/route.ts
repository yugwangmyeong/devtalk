import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTokenFromCookies, verifyToken } from '@/lib/auth';

// Helper function to create default "일반채널" for a team
async function createDefaultChannel(teamId: string, userId: string) {
  try {
    console.log('[createDefaultChannel] Creating default channel for team:', teamId);
    
    // Create ChatRoom for the channel
    const chatRoom = await prisma.chatRoom.create({
      data: {
        type: 'GROUP',
        name: '일반채널',
      },
    });

    console.log('[createDefaultChannel] ChatRoom created:', chatRoom.id);

    // Create TeamChannel linked to the ChatRoom
    const teamChannel = await prisma.teamChannel.create({
      data: {
        name: '일반채널',
        teamId: teamId,
        chatRoomId: chatRoom.id,
      },
    });

    console.log('[createDefaultChannel] TeamChannel created:', teamChannel.id);

    // Add team creator as member of the channel
    await prisma.chatRoomMember.create({
      data: {
        userId: userId,
        chatRoomId: chatRoom.id,
      },
    });

    console.log('[createDefaultChannel] Channel member added');
    return teamChannel;
  } catch (error) {
    console.error('[createDefaultChannel] Error creating default channel:', error);
    throw error;
  }
}

// Get all teams for the current user
export async function GET(request: NextRequest) {
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

    // Get user info for default team creation
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // Get all teams where user is a member (only ACCEPTED members)
    let teamMembers = await prisma.teamMember.findMany({
      where: {
        userId: decoded.userId,
        status: 'ACCEPTED', // 수락된 멤버만 조회
      },
      include: {
        team: {
          include: {
            creator: {
              select: {
                id: true,
                email: true,
                name: true,
                profileImageUrl: true,
              },
            },
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
            _count: {
              select: {
                members: true,
                chatRooms: true,
              },
            },
          },
        },
      },
      orderBy: {
        team: {
          updatedAt: 'desc',
        },
      },
    });

    // If user has no teams, create a default workspace
    if (teamMembers.length === 0) {
      const defaultTeamName = user.name?.trim() 
        ? `${user.name.trim()}의 워크스페이스`
        : `${user.email.trim().split('@')[0]}의 워크스페이스`;
      
      const defaultTeam = await prisma.team.create({
        data: {
          name: defaultTeamName,
          description: '기본 워크스페이스',
          creatorId: user.id,
          members: {
            create: {
              userId: user.id,
              role: 'OWNER',
              status: 'ACCEPTED', // OWNER는 자동으로 수락됨
            },
          },
        },
        include: {
          creator: {
            select: {
              id: true,
              email: true,
              name: true,
              profileImageUrl: true,
            },
          },
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
          _count: {
            select: {
              members: true,
              chatRooms: true,
            },
          },
        },
      });

      // Create default "일반채널" for the team
      try {
        await createDefaultChannel(defaultTeam.id, user.id);
      } catch (error) {
        console.error('[GET /api/teams] Failed to create default channel:', error);
        // Continue even if channel creation fails
      }

      // Add the default team to teamMembers array
      teamMembers = [{
        role: 'OWNER' as const,
        team: defaultTeam,
      }];
    }

    const teams = teamMembers.map((tm) => ({
      id: tm.team.id,
      name: tm.team.name,
      description: tm.team.description,
      iconUrl: tm.team.iconUrl,
      role: tm.role,
      createdAt: tm.team.createdAt.toISOString(),
      updatedAt: tm.team.updatedAt.toISOString(),
      creator: tm.team.creator,
      members: tm.team.members.map((m) => ({
        id: m.user.id,
        email: m.user.email,
        name: m.user.name,
        profileImageUrl: m.user.profileImageUrl,
        role: m.role,
        joinedAt: m.joinedAt.toISOString(),
      })),
      memberCount: tm.team._count.members,
      roomCount: tm.team._count.chatRooms,
    }));

    return NextResponse.json({ teams });
  } catch (error) {
    console.error('[GET /api/teams] Error:', error);
    return NextResponse.json(
      { error: '팀 목록을 가져오는데 실패했습니다.' },
      { status: 500 }
    );
  }
}

// Create a new team
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { name, description } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: '팀 이름을 입력해주세요.' },
        { status: 400 }
      );
    }

    if (name.length > 100) {
      return NextResponse.json(
        { error: '팀 이름은 100자 이하여야 합니다.' },
        { status: 400 }
      );
    }

    // Create team and add creator as owner
    const team = await prisma.team.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        creatorId: decoded.userId,
        members: {
          create: {
            userId: decoded.userId,
            role: 'OWNER',
            status: 'ACCEPTED', // OWNER는 자동으로 수락됨
          },
        },
      },
      include: {
        creator: {
          select: {
            id: true,
            email: true,
            name: true,
            profileImageUrl: true,
          },
        },
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
        _count: {
          select: {
            members: true,
            chatRooms: true,
          },
        },
      },
    });

    // Create default "일반채널" for the team
    try {
      await createDefaultChannel(team.id, decoded.userId);
    } catch (error) {
      console.error('[POST /api/teams] Failed to create default channel:', error);
      // Continue even if channel creation fails - team is already created
    }

    const teamResponse = {
      id: team.id,
      name: team.name,
      description: team.description,
      iconUrl: team.iconUrl,
      role: 'OWNER' as const,
      createdAt: team.createdAt.toISOString(),
      updatedAt: team.updatedAt.toISOString(),
      creator: team.creator,
      members: team.members.map((m) => ({
        id: m.user.id,
        email: m.user.email,
        name: m.user.name,
        profileImageUrl: m.user.profileImageUrl,
        role: m.role,
        joinedAt: m.joinedAt.toISOString(),
      })),
      memberCount: team._count.members,
      roomCount: team._count.chatRooms,
    };

    return NextResponse.json({ team: teamResponse }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/teams] Error:', error);
    return NextResponse.json(
      { error: '팀 생성에 실패했습니다.' },
      { status: 500 }
    );
  }
}

