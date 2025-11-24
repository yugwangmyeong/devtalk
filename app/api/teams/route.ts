import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTokenFromCookies, verifyToken } from '@/lib/auth';
import { cache, getCacheKey } from '@/lib/cache';
import { measurePerformance } from '@/lib/performance';
import { ensureDefaultTeamChannels } from '@/lib/teamChannels';

// Get all teams for the current user
export async function GET(request: NextRequest) {
  try {
    const { result, duration } = await measurePerformance('teams-api', async () => {
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

      const userId = decoded.userId;
      const cacheKey = getCacheKey('teams', userId);

      // 1. 캐시에서 조회 시도
      const cacheStart = Date.now();
      const cached = await cache.get(cacheKey);
      const cacheTime = Date.now() - cacheStart;
      
      if (cached) {
        console.log(`[Teams API] ✅ Cache HIT (${cacheTime}ms) for user ${userId}`);
        return cached;
      }

      console.log(`[Teams API] ❌ Cache MISS (${cacheTime}ms) for user ${userId} - DB 쿼리 실행`);

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

      // Create default channels for the team
      try {
        await ensureDefaultTeamChannels(defaultTeam.id);
      } catch (error) {
        console.error('[GET /api/teams] Failed to create default channels:', error);
        // Continue even if channel creation fails
      }

      // Fetch the TeamMember record with the same structure as the query above
      const defaultTeamMember = await prisma.teamMember.findUnique({
        where: {
          userId_teamId: {
            userId: user.id,
            teamId: defaultTeam.id,
          },
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
      });

      // Add the default team to teamMembers array
      if (!defaultTeamMember) {
        throw new Error('Failed to create default team member');
      }
      teamMembers = [defaultTeamMember];
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

      const response = { teams };

      // 2. 결과를 캐시에 저장 (5분 TTL)
      await cache.set(cacheKey, response, 300);

      return response;
    });

    const response = NextResponse.json(result, { status: 200 });
    response.headers.set('X-Response-Time', `${duration.toFixed(2)}ms`);
    return response;
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

    // Create default channels for the team
    try {
      await ensureDefaultTeamChannels(team.id);
    } catch (error) {
      console.error('[POST /api/teams] Failed to create default channels:', error);
      // Continue even if channel creation fails - team is already created
    }

    // 캐시 무효화 (새 팀 생성 시)
    const cacheKey = getCacheKey('teams', decoded.userId);
    await cache.delete(cacheKey);

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

