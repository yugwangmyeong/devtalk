import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTokenFromCookies, verifyToken } from '@/lib/auth';

// Update user's attendance status for an event
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; eventId: string }> | { teamId: string; eventId: string } }
) {
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

    const resolvedParams = await Promise.resolve(params);
    const { teamId, eventId } = resolvedParams;

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

    // Verify event exists and belongs to the team
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { teamId: true },
    });

    if (!event) {
      return NextResponse.json(
        { error: '이벤트를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    if (event.teamId !== teamId) {
      return NextResponse.json(
        { error: '이벤트가 해당 팀에 속하지 않습니다.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { status } = body;

    // Validate status
    const validStatuses = ['PENDING', 'ACCEPTED', 'DECLINED', 'TENTATIVE'];
    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: '유효하지 않은 참석 상태입니다.' },
        { status: 400 }
      );
    }

    // Upsert attendee (create if doesn't exist, update if exists)
    const attendee = await prisma.eventAttendee.upsert({
      where: {
        userId_eventId: {
          userId: decoded.userId,
          eventId: eventId,
        },
      },
      update: {
        status: status,
        updatedAt: new Date(),
      },
      create: {
        userId: decoded.userId,
        eventId: eventId,
        status: status,
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
    });

    return NextResponse.json({
      attendee: {
        id: attendee.id,
        userId: attendee.userId,
        eventId: attendee.eventId,
        status: attendee.status,
        user: attendee.user,
        createdAt: attendee.createdAt.toISOString(),
        updatedAt: attendee.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('[PATCH /api/teams/[teamId]/events/[eventId]/attend] Error:', error);
    return NextResponse.json(
      { error: '참석 상태 업데이트에 실패했습니다.' },
      { status: 500 }
    );
  }
}

// Get user's attendance status for an event
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; eventId: string }> | { teamId: string; eventId: string } }
) {
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

    const resolvedParams = await Promise.resolve(params);
    const { teamId, eventId } = resolvedParams;

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

    // Get attendee status
    const attendee = await prisma.eventAttendee.findUnique({
      where: {
        userId_eventId: {
          userId: decoded.userId,
          eventId: eventId,
        },
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
    });

    return NextResponse.json({
      status: attendee?.status || null,
      attendee: attendee ? {
        id: attendee.id,
        userId: attendee.userId,
        eventId: attendee.eventId,
        status: attendee.status,
        user: attendee.user,
        createdAt: attendee.createdAt.toISOString(),
        updatedAt: attendee.updatedAt.toISOString(),
      } : null,
    });
  } catch (error) {
    console.error('[GET /api/teams/[teamId]/events/[eventId]/attend] Error:', error);
    return NextResponse.json(
      { error: '참석 상태를 가져오는데 실패했습니다.' },
      { status: 500 }
    );
  }
}

