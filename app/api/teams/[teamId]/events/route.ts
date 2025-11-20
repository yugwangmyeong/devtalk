import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTokenFromCookies, verifyToken } from '@/lib/auth';
import { cache, getCacheKey } from '@/lib/cache';
import { measurePerformance } from '@/lib/performance';

// Get all events for a team
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> | { teamId: string } }
) {
  try {
    const { result, duration } = await measurePerformance('team-events-api', async () => {
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

    if (!teamMember || teamMember.status !== 'ACCEPTED') {
      return NextResponse.json(
        { error: '팀 멤버가 아닙니다.' },
        { status: 403 }
      );
    }

      // Get query parameters for filtering
      const startDate = request.nextUrl.searchParams.get('startDate');
      const endDate = request.nextUrl.searchParams.get('endDate');

      // 캐시 키에 날짜 필터 포함 (필터가 있으면 별도 캐시)
      const cacheKey = startDate || endDate
        ? getCacheKey('team-events', teamId, decoded.userId, startDate || '', endDate || '')
        : getCacheKey('team-events', teamId, decoded.userId);

      // 1. 캐시에서 조회 시도
      const cached = await cache.get(cacheKey);
      if (cached) {
        console.log(`[Team Events API] Cache hit for team ${teamId}`);
        return cached;
      }

      console.log(`[Team Events API] Cache miss for team ${teamId}`);

      // Build where clause
      const where: any = { teamId };

    if (startDate || endDate) {
      where.OR = [];
      if (startDate && endDate) {
        // Events that overlap with the date range
        where.OR.push(
          {
            startDate: { lte: new Date(endDate) },
            endDate: { gte: new Date(startDate) },
          }
        );
      } else if (startDate) {
        where.endDate = { gte: new Date(startDate) };
      } else if (endDate) {
        where.startDate = { lte: new Date(endDate) };
      }
    }

    // Get events with attendees
    const events = await prisma.event.findMany({
      where,
      include: {
        creator: {
          select: {
            id: true,
            email: true,
            name: true,
            profileImageUrl: true,
          },
        },
        attendees: {
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
        startDate: 'asc',
      },
    });

    // Format response with current user's attendance status
    const formattedEvents = events.map((event) => {
      const userAttendee = event.attendees.find(
        (a) => a.userId === decoded.userId
      );

      return {
        id: event.id,
        title: event.title,
        description: event.description,
        startDate: event.startDate.toISOString(),
        endDate: event.endDate.toISOString(),
        allDay: event.allDay,
        location: event.location,
        teamId: event.teamId,
        creator: event.creator,
        createdAt: event.createdAt.toISOString(),
        updatedAt: event.updatedAt.toISOString(),
        myStatus: userAttendee?.status || null,
        attendees: event.attendees.map((a) => ({
          id: a.id,
          userId: a.userId,
          status: a.status,
          user: a.user,
          createdAt: a.createdAt.toISOString(),
        })),
        attendeeCount: event.attendees.length,
        acceptedCount: event.attendees.filter((a) => a.status === 'ACCEPTED').length,
      };
    });

      const response = { events: formattedEvents };

      // 2. 결과를 캐시에 저장 (5분 TTL)
      await cache.set(cacheKey, response, 300);

      return response;
    });

    const response = NextResponse.json(result, { status: 200 });
    response.headers.set('X-Response-Time', `${duration.toFixed(2)}ms`);
    return response;
  } catch (error) {
    console.error('[GET /api/teams/[teamId]/events] Error:', error);
    return NextResponse.json(
      { error: '이벤트 목록을 가져오는데 실패했습니다.' },
      { status: 500 }
    );
  }
}

// Create a new event
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

    if (!teamMember || teamMember.status !== 'ACCEPTED') {
      return NextResponse.json(
        { error: '팀 멤버가 아닙니다.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { title, description, startDate, endDate, allDay, location, attendeeIds } = body;

    // Validation
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json(
        { error: '이벤트 제목을 입력해주세요.' },
        { status: 400 }
      );
    }

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: '시작일과 종료일을 입력해주세요.' },
        { status: 400 }
      );
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json(
        { error: '유효하지 않은 날짜 형식입니다.' },
        { status: 400 }
      );
    }

    if (start >= end) {
      return NextResponse.json(
        { error: '종료일은 시작일보다 늦어야 합니다.' },
        { status: 400 }
      );
    }

    // Create event with optional attendees
    const attendeeData = Array.isArray(attendeeIds) && attendeeIds.length > 0
      ? attendeeIds.map((userId: string) => ({
          userId,
          status: userId === decoded.userId ? 'ACCEPTED' : 'PENDING', // Creator auto-accepts
        }))
      : [
          // If no attendees specified, add creator as accepted
          {
            userId: decoded.userId,
            status: 'ACCEPTED' as const,
          },
        ];

    const event = await prisma.event.create({
      data: {
        title: title.trim(),
        description: description?.trim() || null,
        startDate: start,
        endDate: end,
        allDay: allDay || false,
        location: location?.trim() || null,
        teamId: teamId,
        createdById: decoded.userId,
        attendees: {
          create: attendeeData,
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
        attendees: {
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

    const formattedEvent = {
      id: event.id,
      title: event.title,
      description: event.description,
      startDate: event.startDate.toISOString(),
      endDate: event.endDate.toISOString(),
      allDay: event.allDay,
      location: event.location,
      teamId: event.teamId,
      creator: event.creator,
      createdAt: event.createdAt.toISOString(),
      updatedAt: event.updatedAt.toISOString(),
      myStatus: 'ACCEPTED' as const,
      attendees: event.attendees.map((a) => ({
        id: a.id,
        userId: a.userId,
        status: a.status,
        user: a.user,
        createdAt: a.createdAt.toISOString(),
      })),
      attendeeCount: event.attendees.length,
      acceptedCount: event.attendees.filter((a) => a.status === 'ACCEPTED').length,
    };

    // 캐시 무효화 (새 이벤트 생성 시)
    const cacheKey = getCacheKey('team-events', teamId, decoded.userId);
    await cache.deletePattern(`cache:team-events:${teamId}:*`); // 모든 필터 조합 캐시 삭제

    return NextResponse.json({ event: formattedEvent }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/teams/[teamId]/events] Error:', error);
    return NextResponse.json(
      { error: '이벤트 생성에 실패했습니다.' },
      { status: 500 }
    );
  }
}

