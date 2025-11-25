import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTokenFromCookies, verifyToken } from '@/lib/auth';

// Search users by email or name
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

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const query = searchParams.get('q');

    // If userId is provided, return that specific user
    if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          profileImageUrl: true,
        },
      });

      if (!user) {
        return NextResponse.json(
          { error: '사용자를 찾을 수 없습니다.' },
          { status: 404 }
        );
      }

      return NextResponse.json({ user }, { status: 200 });
    }

    // Otherwise, search by query
    if (!query || query.trim().length === 0) {
      return NextResponse.json(
        { error: '검색어를 입력해주세요.' },
        { status: 400 }
      );
    }

    const searchQuery = query.trim();

    // Search by email or name (MySQL is case-insensitive by default)
    const users = await prisma.user.findMany({
      where: {
        AND: [
          {
            id: {
              not: decoded.userId, // Exclude current user
            },
          },
          {
            OR: [
              {
                email: {
                  contains: searchQuery,
                },
              },
              {
                name: {
                  contains: searchQuery,
                },
              },
            ],
          },
        ],
      },
      select: {
        id: true,
        email: true,
        name: true,
        profileImageUrl: true,
      },
      take: 20, // Limit results
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({ users }, { status: 200 });
  } catch (error) {
    console.error('Search users error:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

