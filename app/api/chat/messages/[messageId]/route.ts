import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTokenFromCookies, verifyToken } from '@/lib/auth';
import { getIO } from '@/lib/socket';

// Update a message
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> | { messageId: string } }
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
    const { messageId } = resolvedParams;
    const body = await request.json();
    const { content } = body;

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json(
        { error: '메시지 내용을 입력해주세요.' },
        { status: 400 }
      );
    }

    // Find message
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            profileImageUrl: true,
          },
        },
        chatRoom: {
          include: {
            members: true,
          },
        },
      },
    });

    if (!message) {
      return NextResponse.json(
        { error: '메시지를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // Check if user is the message owner
    if (message.userId !== decoded.userId) {
      return NextResponse.json(
        { error: '본인의 메시지만 수정할 수 있습니다.' },
        { status: 403 }
      );
    }

    // Check if user is a member of the room
    const isMember = message.chatRoom.members.some(
      (m) => m.userId === decoded.userId
    );

    if (!isMember) {
      return NextResponse.json(
        { error: '이 채팅방의 멤버가 아닙니다.' },
        { status: 403 }
      );
    }

    // Update message
    const updatedMessage = await prisma.message.update({
      where: { id: messageId },
      data: { content: content.trim() },
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

    // Check if this is a team channel
    const teamChannel = await prisma.teamChannel.findUnique({
      where: { chatRoomId: message.chatRoomId },
      select: {
        teamId: true,
        type: true,
      },
    });

    let userWithRole: typeof updatedMessage.user & { teamRole?: string } = updatedMessage.user;
    if (teamChannel) {
      const teamMember = await prisma.teamMember.findUnique({
        where: {
          userId_teamId: {
            userId: decoded.userId,
            teamId: teamChannel.teamId,
          },
        },
        select: { role: true },
      });

      if (teamMember) {
        userWithRole = {
          ...updatedMessage.user,
          teamRole: teamMember.role,
        };
      }
    }

    // Broadcast message update to all room members
    const io = getIO();
    if (io) {
      const messagePayload = {
        id: updatedMessage.id,
        content: updatedMessage.content,
        userId: updatedMessage.userId,
        chatRoomId: updatedMessage.chatRoomId,
        createdAt: updatedMessage.createdAt,
        updatedAt: updatedMessage.updatedAt,
        user: userWithRole,
      };

      // Send to all members in the room
      io.to(message.chatRoomId).emit('messageUpdated', messagePayload);
    }

    return NextResponse.json(
      {
        message: {
          ...updatedMessage,
          user: userWithRole,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Update message error:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// Delete a message
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> | { messageId: string } }
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
    const { messageId } = resolvedParams;

    // Find message
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      include: {
        chatRoom: {
          include: {
            members: true,
          },
        },
      },
    });

    if (!message) {
      return NextResponse.json(
        { error: '메시지를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // Check if user is the message owner
    if (message.userId !== decoded.userId) {
      return NextResponse.json(
        { error: '본인의 메시지만 삭제할 수 있습니다.' },
        { status: 403 }
      );
    }

    // Check if user is a member of the room
    const isMember = message.chatRoom.members.some(
      (m) => m.userId === decoded.userId
    );

    if (!isMember) {
      return NextResponse.json(
        { error: '이 채팅방의 멤버가 아닙니다.' },
        { status: 403 }
      );
    }

    const roomId = message.chatRoomId;

    // Delete message
    await prisma.message.delete({
      where: { id: messageId },
    });

    // Broadcast message deletion to all room members
    const io = getIO();
    if (io) {
      io.to(roomId).emit('messageDeleted', { messageId, roomId });
    }

    return NextResponse.json(
      { message: '메시지가 삭제되었습니다.' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Delete message error:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

