import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/google/callback';
  
  if (!clientId) {
    return NextResponse.json(
      { error: 'Google OAuth가 설정되지 않았습니다.' },
      { status: 500 }
    );
  }

  // Generate state for CSRF protection
  const state = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  
  // Store state in cookie (expires in 10 minutes)
  const response = NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${encodeURIComponent(clientId)}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `response_type=code&` +
    `scope=${encodeURIComponent('openid email profile')}&` +
    `state=${state}&` +
    `access_type=offline&` +
    `prompt=consent`
  );

  response.cookies.set('oauth-state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 10, // 10 minutes
    path: '/',
  });

  return response;
}

