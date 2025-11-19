import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTokenFromCookies, verifyToken } from '@/lib/auth';

// Get dashboard data: upcoming events and team activities
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

    // Get all teams the user is a member of
    const teamMemberships = await prisma.teamMember.findMany({
      where: {
        userId: decoded.userId,
        status: 'ACCEPTED',
      },
      include: {
        team: {
          select: {
            id: true,
            name: true,
            iconUrl: true,
          },
        },
      },
    });

    const teamIds = teamMemberships.map((tm) => tm.team.id);

    if (teamIds.length === 0) {
      return NextResponse.json({
        upcomingEvents: [],
        teamActivities: [],
      });
    }

    // Get upcoming events (next 2 weeks) from all teams
    const now = new Date();
    const twoWeeksLater = new Date(now);
    twoWeeksLater.setDate(now.getDate() + 14);

    const upcomingEvents = await prisma.event.findMany({
      where: {
        teamId: { in: teamIds },
        startDate: {
          gte: now,
          lte: twoWeeksLater,
        },
      },
      include: {
        team: {
          select: {
            id: true,
            name: true,
            iconUrl: true,
          },
        },
        creator: {
          select: {
            id: true,
            email: true,
            name: true,
            profileImageUrl: true,
          },
        },
        attendees: {
          where: {
            userId: decoded.userId,
          },
          select: {
            status: true,
          },
        },
      },
      orderBy: {
        startDate: 'asc',
      },
      take: 10, // 최대 10개
    });

    // Format events
    const formattedEvents = upcomingEvents.map((event) => ({
      id: event.id,
      title: event.title,
      description: event.description,
      startDate: event.startDate.toISOString(),
      endDate: event.endDate.toISOString(),
      allDay: event.allDay,
      location: event.location,
      teamId: event.teamId,
      team: event.team,
      creator: event.creator,
      myStatus: event.attendees[0]?.status || null,
    }));

    // Get team activities (recent events, channel creations, member additions)
    // 최근 30일 이내 활동
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // 최근 이벤트 생성
    const recentEvents = await prisma.event.findMany({
      where: {
        teamId: { in: teamIds },
        createdAt: { gte: thirtyDaysAgo },
      },
      include: {
        team: {
          select: {
            id: true,
            name: true,
            iconUrl: true,
          },
        },
        creator: {
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
      take: 5,
    });

    // 최근 채널 생성
    const recentChannels = await prisma.teamChannel.findMany({
      where: {
        teamId: { in: teamIds },
        createdAt: { gte: thirtyDaysAgo },
      },
      include: {
        team: {
          select: {
            id: true,
            name: true,
            iconUrl: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 5,
    });

    // 최근 멤버 추가 (ACCEPTED 상태로 변경된 것)
    const recentMembers = await prisma.teamMember.findMany({
      where: {
        teamId: { in: teamIds },
        status: 'ACCEPTED',
        joinedAt: { gte: thirtyDaysAgo },
      },
      include: {
        team: {
          select: {
            id: true,
            name: true,
            iconUrl: true,
          },
        },
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            profileImageUrl: true,
          },
        },
      },
      orderBy: {
        joinedAt: 'desc',
      },
      take: 5,
    });

    // Combine and sort activities by date
    const activities: Array<{
      type: 'event' | 'channel' | 'member';
      id: string;
      team: { id: string; name: string; iconUrl: string | null };
      user?: { id: string; email: string; name: string | null; profileImageUrl: string | null };
      title: string;
      createdAt: string;
    }> = [];

    recentEvents.forEach((event) => {
      activities.push({
        type: 'event',
        id: event.id,
        team: event.team,
        user: event.creator,
        title: event.title,
        createdAt: event.createdAt.toISOString(),
      });
    });

    recentChannels.forEach((channel) => {
      activities.push({
        type: 'channel',
        id: channel.id,
        team: channel.team,
        title: channel.name,
        createdAt: channel.createdAt.toISOString(),
      });
    });

    recentMembers.forEach((member) => {
      activities.push({
        type: 'member',
        id: member.id,
        team: member.team,
        user: member.user,
        title: `${member.user.name || member.user.email}님이 팀에 합류했습니다`,
        createdAt: member.joinedAt.toISOString(),
      });
    });

    // Sort by date (most recent first)
    activities.sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    // Take top 10 most recent activities
    const teamActivities = activities.slice(0, 10);

    return NextResponse.json({
      upcomingEvents: formattedEvents,
      teamActivities,
    });
  } catch (error) {
    console.error('[GET /api/dashboard] Error:', error);
    return NextResponse.json(
      { error: '대시보드 데이터를 가져오는데 실패했습니다.' },
      { status: 500 }
    );
  }
}

