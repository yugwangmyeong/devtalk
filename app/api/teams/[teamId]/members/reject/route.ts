import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTokenFromCookies, verifyToken } from '@/lib/auth';

// Reject team invitation (remove member)
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

    if (!teamMember) {
      return NextResponse.json(
        { error: '팀 멤버가 아닙니다.' },
        { status: 404 }
      );
    }

    // OWNER cannot leave/reject
    if (teamMember.role === 'OWNER') {
      return NextResponse.json(
        { error: '소유자는 팀에서 나갈 수 없습니다.' },
        { status: 403 }
      );
    }

    // Remove member from team
    await prisma.teamMember.delete({
      where: {
        userId_teamId: {
          userId: decoded.userId,
          teamId: teamId,
        },
      },
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('[POST /api/teams/[teamId]/members/reject] Error:', error);
    return NextResponse.json(
      { error: '초대 거절에 실패했습니다.' },
      { status: 500 }
    );
  }
}

