import { NextRequest, NextResponse } from 'next/server';
import { OAuth2Client } from 'google-auth-library';
import { prisma } from '@/lib/prisma';
import { generateToken } from '@/lib/auth';
import { ensureDefaultTeamChannels } from '@/lib/teamChannels';

// Get base URL with fallback to devtalk.site
function getBaseUrl(request: NextRequest): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
  if (envUrl) {
    return envUrl.endsWith('/') ? envUrl.slice(0, -1) : envUrl;
  }
  // Fallback to devtalk.site
  return 'https://devtalk.site';
}

export async function GET(request: NextRequest) {
  try {
    const baseUrl = getBaseUrl(request);
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Check for OAuth errors
    if (error) {
      return NextResponse.redirect(
        `${baseUrl}/?error=${encodeURIComponent('구글 로그인이 취소되었습니다.')}`
      );
    }

    // Verify state (CSRF protection)
    const storedState = request.cookies.get('oauth-state')?.value;
    if (!state || !storedState || state !== storedState) {
      return NextResponse.redirect(
        `${baseUrl}/?error=${encodeURIComponent('인증 상태가 유효하지 않습니다.')}`
      );
    }

    if (!code) {
      return NextResponse.redirect(
        `${baseUrl}/?error=${encodeURIComponent('인증 코드를 받지 못했습니다.')}`
      );
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/google/callback';

    if (!clientId || !clientSecret) {
      return NextResponse.redirect(
        `${baseUrl}/?error=${encodeURIComponent('구글 OAuth 설정이 완료되지 않았습니다.')}`
      );
    }

    // Exchange code for tokens
    const oauth2Client = new OAuth2Client(clientId, clientSecret, redirectUri);
    const { tokens } = await oauth2Client.getToken(code);
    
    if (!tokens.id_token) {
      return NextResponse.redirect(
        `${baseUrl}/?error=${encodeURIComponent('구글 인증 토큰을 받지 못했습니다.')}`
      );
    }

    // Verify and decode the ID token
    const ticket = await oauth2Client.verifyIdToken({
      idToken: tokens.id_token,
      audience: clientId,
    });

    const payload = ticket.getPayload();
    if (!payload) {
      return NextResponse.redirect(
        `${baseUrl}/?error=${encodeURIComponent('구글 사용자 정보를 가져올 수 없습니다.')}`
      );
    }

    const googleId = payload.sub;
    const email = payload.email;
    const name = payload.name || payload.given_name || null;
    const profileImageUrl = payload.picture || null;

    if (!email) {
      return NextResponse.redirect(
        `${baseUrl}/?error=${encodeURIComponent('이메일 정보를 가져올 수 없습니다.')}`
      );
    }

    // Find or create user
    // 1. 먼저 Google ID로 사용자 찾기 (같은 Google 계정은 항상 같은 사용자)
    let user = await prisma.user.findUnique({
      where: { googleId },
    });

    if (user) {
      // Google ID로 찾은 사용자가 있으면, 이메일이 변경되었을 수 있으므로 업데이트
      if (user.email !== email) {
        // 이메일이 다른 사용자가 이미 존재하는지 확인
        const emailUser = await prisma.user.findUnique({
          where: { email },
        });
        
        if (emailUser && emailUser.id !== user.id) {
          // 다른 사용자가 이 이메일을 사용 중이면 에러
          return NextResponse.redirect(
            `${baseUrl}/?error=${encodeURIComponent('이 이메일은 이미 다른 계정에서 사용 중입니다.')}`
          );
        }
        
        // 이메일 업데이트
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            email,
            profileImageUrl: profileImageUrl || user.profileImageUrl,
            name: name || user.name,
          },
        });
      } else {
        // 이메일이 같으면 프로필 정보만 업데이트
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            profileImageUrl: profileImageUrl || user.profileImageUrl,
            name: name || user.name,
          },
        });
      }
    } else {
      // 2. Google ID로 찾지 못했으면 이메일로 찾기
      user = await prisma.user.findUnique({
        where: { email },
      });

      if (user) {
        // 이메일로 찾은 사용자가 있으면, Google ID 연결
        if (user.googleId && user.googleId !== googleId) {
          // 이미 다른 Google ID가 연결되어 있으면 에러
          return NextResponse.redirect(
            `${baseUrl}/?error=${encodeURIComponent('이미 다른 구글 계정으로 가입된 이메일입니다.')}`
          );
        }
        
        // Google ID 업데이트 (일반 가입 → Google 연결)
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            googleId,
            profileImageUrl: profileImageUrl || user.profileImageUrl,
            name: name || user.name,
          },
        });
      } else {
      // Create new user
      user = await prisma.user.create({
        data: {
          email,
          googleId,
          name,
          profileImageUrl,
          password: null, // OAuth users don't have passwords
        },
      });

      // Create default workspace/team for the new user
      const defaultTeamName = name 
        ? `${name}의 워크스페이스`
        : `${email.split('@')[0]}의 워크스페이스`;
      
      const defaultTeam = await prisma.team.create({
        data: {
          name: defaultTeamName,
          description: '기본 워크스페이스',
          creatorId: user.id,
          members: {
            create: {
              userId: user.id,
              role: 'OWNER',
              status: 'ACCEPTED',
            },
          },
        },
      });

      // Create default channels for the team
      try {
        await ensureDefaultTeamChannels(defaultTeam.id);
      } catch (error) {
        console.error('Error creating default channels:', error);
        // Continue even if channel creation fails
      }
    }

    // Generate JWT token
    const token = generateToken(user.id, user.email);

    // Clear OAuth state cookie and redirect to home
    const redirectUrl = `${baseUrl}/?google_auth=success`;
    
    const response = NextResponse.redirect(redirectUrl);
    response.cookies.delete('oauth-state');

    // Set auth token cookie
    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: false, // HTTP 환경에서는 false로 설정
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Google OAuth callback error:', error);
    const baseUrl = getBaseUrl(request);
    return NextResponse.redirect(
      `${baseUrl}/?error=${encodeURIComponent('구글 로그인 중 오류가 발생했습니다.')}`
    );
  }
}

