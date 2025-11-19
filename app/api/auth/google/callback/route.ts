import { NextRequest, NextResponse } from 'next/server';
import { OAuth2Client } from 'google-auth-library';
import { prisma } from '@/lib/prisma';
import { generateToken } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Check for OAuth errors
    if (error) {
      return NextResponse.redirect(
        new URL(`/?error=${encodeURIComponent('구글 로그인이 취소되었습니다.')}`, request.url)
      );
    }

    // Verify state (CSRF protection)
    const storedState = request.cookies.get('oauth-state')?.value;
    if (!state || !storedState || state !== storedState) {
      return NextResponse.redirect(
        new URL(`/?error=${encodeURIComponent('인증 상태가 유효하지 않습니다.')}`, request.url)
      );
    }

    if (!code) {
      return NextResponse.redirect(
        new URL(`/?error=${encodeURIComponent('인증 코드를 받지 못했습니다.')}`, request.url)
      );
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/google/callback';

    if (!clientId || !clientSecret) {
      return NextResponse.redirect(
        new URL(`/?error=${encodeURIComponent('구글 OAuth 설정이 완료되지 않았습니다.')}`, request.url)
      );
    }

    // Exchange code for tokens
    const oauth2Client = new OAuth2Client(clientId, clientSecret, redirectUri);
    const { tokens } = await oauth2Client.getToken(code);
    
    if (!tokens.id_token) {
      return NextResponse.redirect(
        new URL(`/?error=${encodeURIComponent('구글 인증 토큰을 받지 못했습니다.')}`, request.url)
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
        new URL(`/?error=${encodeURIComponent('구글 사용자 정보를 가져올 수 없습니다.')}`, request.url)
      );
    }

    const googleId = payload.sub;
    const email = payload.email;
    const name = payload.name || payload.given_name || null;
    const profileImageUrl = payload.picture || null;

    if (!email) {
      return NextResponse.redirect(
        new URL(`/?error=${encodeURIComponent('이메일 정보를 가져올 수 없습니다.')}`, request.url)
      );
    }

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { email },
    });

    if (user) {
      // Update user if they don't have googleId yet
      if (!user.googleId) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            googleId,
            profileImageUrl: profileImageUrl || user.profileImageUrl,
            name: name || user.name,
          },
        });
      } else if (user.googleId !== googleId) {
        // Google ID mismatch - this shouldn't happen, but handle it
        return NextResponse.redirect(
          new URL(`/?error=${encodeURIComponent('이미 다른 구글 계정으로 가입된 이메일입니다.')}`, request.url)
        );
      }
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

      // Create default "일반채널" for the team
      try {
        const chatRoom = await prisma.chatRoom.create({
          data: {
            type: 'GROUP',
            name: '일반채널',
          },
        });

        await prisma.teamChannel.create({
          data: {
            name: '일반채널',
            teamId: defaultTeam.id,
            chatRoomId: chatRoom.id,
          },
        });

        await prisma.chatRoomMember.create({
          data: {
            userId: user.id,
            chatRoomId: chatRoom.id,
          },
        });
      } catch (error) {
        console.error('Error creating default channel:', error);
        // Continue even if channel creation fails
      }
    }

    // Generate JWT token
    const token = generateToken(user.id, user.email);

    // Clear OAuth state cookie and redirect to home
    const redirectUrl = new URL('/', request.url);
    redirectUrl.searchParams.set('google_auth', 'success');
    
    const response = NextResponse.redirect(redirectUrl);
    response.cookies.delete('oauth-state');

    // Set auth token cookie
    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Google OAuth callback error:', error);
    return NextResponse.redirect(
      new URL(`/?error=${encodeURIComponent('구글 로그인 중 오류가 발생했습니다.')}`, request.url)
    );
  }
}

