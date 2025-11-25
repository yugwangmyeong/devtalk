import { NextRequest, NextResponse } from 'next/server';
import { getTokenFromCookies, addTokenToBlacklist } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // Get token from cookies before clearing
    const token = getTokenFromCookies(request.cookies);

    // Add token to blacklist if it exists
    if (token) {
      await addTokenToBlacklist(token);
    }

    const response = NextResponse.json(
      { message: 'Logout successful' },
      { status: 200 }
    );

    // Clear auth cookie
    response.cookies.set('auth-token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Logout error:', error);
    // 에러가 발생해도 쿠키는 삭제
    const response = NextResponse.json(
      { message: 'Logout successful' },
      { status: 200 }
    );
    response.cookies.set('auth-token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    });
    return response;
  }
}

