import { NextRequest, NextResponse } from 'next/server';

// Get base URL with fallback to devtalk.site
function getBaseUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
  if (envUrl) {
    return envUrl.endsWith('/') ? envUrl.slice(0, -1) : envUrl;
  }
  // Fallback to devtalk.site
  return 'https://devtalk.site';
}

export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const baseUrl = getBaseUrl();
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${baseUrl}/api/auth/google/callback`;
  
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

