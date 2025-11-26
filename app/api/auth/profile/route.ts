import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTokenFromCookies, verifyToken } from '@/lib/auth';
import { cache } from '@/lib/cache';

// Get user profile
export async function GET(request: NextRequest) {
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

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        name: true,
        profileImageUrl: true,
        createdAt: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ user }, { status: 200 });
  } catch (error) {
    console.error('Get profile error:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// Update user profile
export async function PATCH(request: NextRequest) {
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

    const body = await request.json();
    const { name, profileImageUrl } = body;

    // Update user
    const user = await prisma.user.update({
      where: { id: decoded.userId },
      data: {
        ...(name !== undefined && { name: name?.trim() || null }),
        ...(profileImageUrl !== undefined && { profileImageUrl: profileImageUrl?.trim() || null }),
      },
      select: {
        id: true,
        email: true,
        name: true,
        profileImageUrl: true,
        createdAt: true,
      },
    });

    // 캐시 무효화: 사용자 정보가 포함된 모든 캐시 삭제
    // 팀 목록 캐시 삭제 (사용자 정보 포함)
    await cache.deletePattern(`cache:teams:${decoded.userId}*`);
    // 채팅방 목록 캐시 삭제 (사용자 정보 포함)
    await cache.deletePattern(`cache:chat-rooms:${decoded.userId}*`);
    // 대시보드 캐시 삭제 (사용자 정보 포함)
    await cache.deletePattern(`cache:dashboard:${decoded.userId}*`);

    return NextResponse.json(
      { message: '회원정보가 수정되었습니다.', user },
      { status: 200 }
    );
  } catch (error) {
    console.error('Update profile error:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

