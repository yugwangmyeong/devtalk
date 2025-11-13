import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTokenFromCookies, verifyToken } from '@/lib/auth';

// Update team (name, description)
export async function PATCH(
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
    const { name, description } = body;

    // Check if user is OWNER or ADMIN of the team
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

    if (teamMember.role !== 'OWNER' && teamMember.role !== 'ADMIN') {
      return NextResponse.json(
        { error: '팀 이름을 변경할 권한이 없습니다. OWNER 또는 ADMIN만 변경할 수 있습니다.' },
        { status: 403 }
      );
    }

    // Validate name if provided
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
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
    }

    // Update team
    const updateData: { name?: string; description?: string | null } = {};
    if (name !== undefined) {
      updateData.name = name.trim();
    }
    if (description !== undefined) {
      updateData.description = description?.trim() || null;
    }

    const updatedTeam = await prisma.team.update({
      where: { id: teamId },
      data: updateData,
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

    const teamResponse = {
      id: updatedTeam.id,
      name: updatedTeam.name,
      description: updatedTeam.description,
      role: teamMember.role,
      createdAt: updatedTeam.createdAt.toISOString(),
      updatedAt: updatedTeam.updatedAt.toISOString(),
      creator: updatedTeam.creator,
      members: updatedTeam.members.map((m) => ({
        id: m.user.id,
        email: m.user.email,
        name: m.user.name,
        profileImageUrl: m.user.profileImageUrl,
        role: m.role,
        joinedAt: m.joinedAt.toISOString(),
      })),
      memberCount: updatedTeam._count.members,
      roomCount: updatedTeam._count.chatRooms,
    };

    return NextResponse.json({ team: teamResponse }, { status: 200 });
  } catch (error) {
    console.error('[PATCH /api/teams/[teamId]] Error:', error);
    return NextResponse.json(
      { error: '팀 정보 업데이트에 실패했습니다.' },
      { status: 500 }
    );
  }
}

// Delete team
export async function DELETE(
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

    // Check if user is OWNER or ADMIN of the team
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

    if (teamMember.role !== 'OWNER' && teamMember.role !== 'ADMIN') {
      return NextResponse.json(
        { error: '팀을 삭제할 권한이 없습니다. OWNER 또는 ADMIN만 삭제할 수 있습니다.' },
        { status: 403 }
      );
    }

    // Delete team and related data
    // First, get all team channels to delete their chat rooms
    const teamChannels = await prisma.teamChannel.findMany({
      where: { teamId: teamId },
      select: { chatRoomId: true },
    });

    // Delete team (cascade will delete TeamMember and TeamChannel)
    await prisma.team.delete({
      where: { id: teamId },
    });

    // Delete associated chat rooms (TeamChannel cascade will handle this, but we'll do it explicitly to be safe)
    if (teamChannels.length > 0) {
      const chatRoomIds = teamChannels.map(tc => tc.chatRoomId);
      // Delete messages first
      await prisma.message.deleteMany({
        where: { chatRoomId: { in: chatRoomIds } },
      });
      // Delete chat room members
      await prisma.chatRoomMember.deleteMany({
        where: { chatRoomId: { in: chatRoomIds } },
      });
      // Delete chat rooms
      await prisma.chatRoom.deleteMany({
        where: { id: { in: chatRoomIds } },
      });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('[DELETE /api/teams/[teamId]] Error:', error);
    return NextResponse.json(
      { error: '팀 삭제에 실패했습니다.' },
      { status: 500 }
    );
  }
}

