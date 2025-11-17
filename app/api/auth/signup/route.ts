import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword, generateToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, name } = body;

    // Validation
    if (!email || !password) {
      return NextResponse.json(
        { error: '이메일과 비밀번호를 입력해주세요.' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: '비밀번호는 최소 6자 이상이어야 합니다.' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.trim() },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: '이미 사용 중인 이메일입니다.' },
        { status: 409 }
      );
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: email.trim(),
        password: hashedPassword,
        name: name?.trim() || null,
      },
      select: {
        id: true,
        email: true,
        name: true,
        profileImageUrl: true,
        createdAt: true,
      },
    });

    // Create default workspace/team for the user
    const defaultTeamName = name?.trim() 
      ? `${name.trim()}의 워크스페이스`
      : `${email.trim().split('@')[0]}의 워크스페이스`;
    
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
    });

    // Create default "일반채널" for the team
    try {
      console.log('[Signup] Creating default channel for team:', defaultTeam.id);
      const chatRoom = await prisma.chatRoom.create({
        data: {
          type: 'GROUP',
          name: '일반채널',
        },
      });

      console.log('[Signup] ChatRoom created:', chatRoom.id);

      await prisma.teamChannel.create({
        data: {
          name: '일반채널',
          teamId: defaultTeam.id,
          chatRoomId: chatRoom.id,
        },
      });

      console.log('[Signup] TeamChannel created');

      await prisma.chatRoomMember.create({
        data: {
          userId: user.id,
          chatRoomId: chatRoom.id,
        },
      });

      console.log('[Signup] Channel member added');
    } catch (error) {
      console.error('[Signup] Failed to create default channel:', error);
      // Continue even if channel creation fails - user and team are already created
    }

    // Generate token
    const token = generateToken(user.id, user.email);

    // Set HTTP-only cookie
    const response = NextResponse.json(
      {
        message: 'User created successfully',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          profileImageUrl: user.profileImageUrl,
        },
      },
      { status: 201 }
    );

    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

