/**
 * 프로필 이미지 URL을 반환합니다.
 * profileImageUrl이 없거나 빈 문자열인 경우 기본 아바타 이미지를 반환합니다.
 * 
 * @param profileImageUrl - 사용자의 프로필 이미지 URL (null, undefined, 빈 문자열 가능)
 * @returns 프로필 이미지 URL 또는 기본 아바타 이미지 경로
 */
export function getProfileImageUrl(profileImageUrl: string | null | undefined): string {
  if (profileImageUrl && profileImageUrl.trim()) {
    return profileImageUrl.trim();
  }
  return '/default-avatar.svg';
}

