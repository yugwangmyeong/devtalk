import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTokenFromCookies, verifyToken } from '@/lib/auth';
import { getIO } from '@/lib/socket';

// Get all team members
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

    const resolvedParams = await Promise.resolve(params);
    const { teamId } = resolvedParams;

    // Check if user is an ACCEPTED member of the team
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
        { error: '팀 멤버가 아닙니다. 초대를 수락해야 팀 멤버 목록을 볼 수 있습니다.' },
        { status: 403 }
      );
    }

    // Get all team members (only ACCEPTED members, exclude PENDING invitations)
    const members = await prisma.teamMember.findMany({
      where: { 
        teamId: teamId,
        status: 'ACCEPTED', // 수락된 멤버만 조회
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
      orderBy: [
        { role: 'asc' }, // OWNER, ADMIN, MEMBER 순서
        { joinedAt: 'asc' },
      ],
    });

    const membersResponse = members.map((member) => ({
      id: member.user.id,
      email: member.user.email,
      name: member.user.name,
      profileImageUrl: member.user.profileImageUrl,
      role: member.role,
      joinedAt: member.joinedAt.toISOString(),
    }));

    return NextResponse.json({ members: membersResponse }, { status: 200 });
  } catch (error) {
    console.error('[GET /api/teams/[teamId]/members] Error:', error);
    return NextResponse.json(
      { error: '멤버 목록을 가져오는데 실패했습니다.' },
      { status: 500 }
    );
  }
}

// Add member to team (invite)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> | { teamId: string } }
) {
  try {
    console.log('[POST /api/teams/[teamId]/members] Request received');
    const token = getTokenFromCookies(request.cookies);

    if (!token) {
      console.error('[POST /api/teams/[teamId]/members] No token found in cookies');
      return NextResponse.json(
        { error: '인증되지 않았습니다.' },
        { status: 401 }
      );
    }

    const decoded = verifyToken(token);

    if (!decoded) {
      console.error('[POST /api/teams/[teamId]/members] Invalid token');
      return NextResponse.json(
        { error: '유효하지 않은 토큰입니다.' },
        { status: 401 }
      );
    }

    const resolvedParams = await Promise.resolve(params);
    const { teamId } = resolvedParams;
    const body = await request.json();
    const { userId, email, name } = body;
    
    console.log('[POST /api/teams/[teamId]/members] Request data:', {
      teamId,
      userId,
      email,
      name,
      inviterId: decoded.userId,
    });

    // Check if user is OWNER or ADMIN of the team (must be ACCEPTED)
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
        { error: '팀 멤버가 아닙니다. 초대를 수락해야 멤버를 초대할 수 있습니다.' },
        { status: 403 }
      );
    }

    if (teamMember.role !== 'OWNER' && teamMember.role !== 'ADMIN') {
      return NextResponse.json(
        { error: '멤버를 초대할 권한이 없습니다. OWNER 또는 ADMIN만 초대할 수 있습니다.' },
        { status: 403 }
      );
    }

    // Find user by userId, email, or name
    let userToInvite;
    if (userId) {
      userToInvite = await prisma.user.findUnique({
        where: { id: userId },
      });
    } else if (email) {
      userToInvite = await prisma.user.findUnique({
        where: { email: email.trim() },
      });
    } else if (name) {
      userToInvite = await prisma.user.findUnique({
        where: { name: name.trim() },
      });
    } else {
      return NextResponse.json(
        { error: '사용자 ID, 이메일 또는 이름이 필요합니다.' },
        { status: 400 }
      );
    }

    if (!userToInvite) {
      return NextResponse.json(
        { error: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // Check if user is already a member or has pending invitation
    const existingMember = await prisma.teamMember.findUnique({
      where: {
        userId_teamId: {
          userId: userToInvite.id,
          teamId: teamId,
        },
      },
    });

    if (existingMember) {
      if (existingMember.status === 'ACCEPTED') {
        return NextResponse.json(
          { error: '이미 팀 멤버입니다.' },
          { status: 409 }
        );
      } else if (existingMember.status === 'PENDING') {
        return NextResponse.json(
          { error: '이미 초대가 전송되었습니다. 사용자가 초대를 수락할 때까지 기다려주세요.' },
          { status: 409 }
        );
      }
    }

    // Get team info for notification
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: {
        creator: {
          select: {
            id: true,
            email: true,
            name: true,
            profileImageUrl: true,
          },
        },
      },
    });

    if (!team) {
      return NextResponse.json(
        { error: '팀을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // Add user as team member with PENDING status (초대 대기 상태)
    // 채널에는 초대 수락 후에만 추가됩니다
    const newMember = await prisma.teamMember.create({
      data: {
        userId: userToInvite.id,
        teamId: teamId,
        role: 'MEMBER',
        status: 'PENDING', // 초대 대기 상태
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

    // 초대 시에는 채널에 추가하지 않음 - 수락 후에만 추가됨
    console.log(`[Team Invite] Created pending invitation for user ${userToInvite.id} to team ${teamId}`);

    // Get inviter info
    const inviter = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        name: true,
        profileImageUrl: true,
      },
    });

    // Return member info
    const memberResponse = {
      id: newMember.user.id,
      email: newMember.user.email,
      name: newMember.user.name,
      profileImageUrl: newMember.user.profileImageUrl,
      role: newMember.role,
      joinedAt: newMember.joinedAt.toISOString(),
    };

    // Send notification via Socket.IO
    console.log('[Team Invite] Getting Socket.IO instance...');
    const io = getIO();
    console.log('[Team Invite] Socket.IO instance:', {
      hasIO: !!io,
      hasInviter: !!inviter,
      ioType: io ? typeof io : 'null',
    });
    
    if (io && inviter) {
      const notification = {
        id: `team_invite_${team.id}_${userToInvite.id}_${Date.now()}`,
        type: 'team_invite',
        title: '팀 초대',
        message: `${inviter.name || inviter.email}님이 "${team.name}" 워크스페이스에 초대했습니다.`,
        teamId: team.id,
        teamName: team.name,
        createdAt: new Date().toISOString(),
        read: false,
        user: inviter,
      };

      console.log(`[Team Invite] Attempting to send notification to user ${userToInvite.id}`);
      console.log(`[Team Invite] Notification data:`, notification);

      // Check if user is connected to Socket.IO
      const userRoom = io.sockets.adapter.rooms.get(userToInvite.id);
      const isUserConnected = userRoom && userRoom.size > 0;
      
      console.log(`[Team Invite] User ${userToInvite.id} connection status:`, {
        isConnected: isUserConnected,
        roomSize: userRoom?.size || 0,
        socketIds: userRoom ? Array.from(userRoom) : [],
      });

      // Emit notification to the invited user's room
      // Users join their userId room when authenticated (see socket-handlers.ts)
      io.to(userToInvite.id).emit('notification', notification);
      console.log(`[Team Invite] Notification emitted to user room: ${userToInvite.id}`);
      
      // Also log total connected sockets for debugging
      const totalSockets = io.sockets.sockets.size;
      console.log(`[Team Invite] Total connected sockets: ${totalSockets}`);
    } else {
      console.log(`[Team Invite] Socket.IO not available or inviter missing`, {
        hasIO: !!io,
        hasInviter: !!inviter,
      });
    }

    return NextResponse.json(
      {
        member: memberResponse,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[POST /api/teams/[teamId]/members] Error:', error);
    return NextResponse.json(
      { error: '멤버 초대에 실패했습니다.' },
      { status: 500 }
    );
  }
}

// Remove member from team
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

    const resolvedParams = await Promise.resolve(params);
    const { teamId } = resolvedParams;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: '사용자 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    // Check if user is OWNER or ADMIN of the team (must be ACCEPTED)
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
        { error: '팀 멤버가 아닙니다. 초대를 수락해야 멤버를 제거할 수 있습니다.' },
        { status: 403 }
      );
    }

    // OWNER cannot be removed
    const memberToRemove = await prisma.teamMember.findUnique({
      where: {
        userId_teamId: {
          userId: userId,
          teamId: teamId,
        },
      },
    });

    if (!memberToRemove) {
      return NextResponse.json(
        { error: '팀 멤버를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    if (memberToRemove.role === 'OWNER') {
      return NextResponse.json(
        { error: '소유자는 팀에서 제거할 수 없습니다.' },
        { status: 403 }
      );
    }

    // Only OWNER can remove ADMIN, ADMIN can remove MEMBER
    if (teamMember.role !== 'OWNER' && memberToRemove.role === 'ADMIN') {
      return NextResponse.json(
        { error: 'ADMIN은 OWNER만 제거할 수 있습니다.' },
        { status: 403 }
      );
    }

    // Remove member
    await prisma.teamMember.delete({
      where: {
        userId_teamId: {
          userId: userId,
          teamId: teamId,
        },
      },
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('[DELETE /api/teams/[teamId]/members] Error:', error);
    return NextResponse.json(
      { error: '멤버 제거에 실패했습니다.' },
      { status: 500 }
    );
  }
}

