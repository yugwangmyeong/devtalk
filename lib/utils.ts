/**
 * 프로필 이미지 URL을 반환합니다.
 * profileImageUrl이 없거나 빈 문자열인 경우 기본 아바타 이미지를 반환합니다.
 * 캐시 버스팅을 위해 타임스탬프 쿼리 파라미터를 추가합니다.
 * 
 * @param profileImageUrl - 사용자의 프로필 이미지 URL (null, undefined, 빈 문자열 가능)
 * @param forceRefresh - 강제 새로고침 여부 (기본값: false)
 * @returns 프로필 이미지 URL 또는 기본 아바타 이미지 경로
 */
export function getProfileImageUrl(profileImageUrl: string | null | undefined, forceRefresh: boolean = false): string {
  if (profileImageUrl && profileImageUrl.trim()) {
    let url = profileImageUrl.trim();
    
    // 기존 타임스탬프 쿼리 파라미터 제거 (t=로 시작하는 파라미터)
    if (url.includes('?')) {
      const [baseUrl, queryString] = url.split('?');
      const params = new URLSearchParams(queryString);
      params.delete('t'); // 기존 타임스탬프 제거
      const newQueryString = params.toString();
      url = newQueryString ? `${baseUrl}?${newQueryString}` : baseUrl;
    }
    
    // 외부 URL (http://, https://) 또는 내부 URL (/uploads/...)인 경우 타임스탬프 추가
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/')) {
      const separator = url.includes('?') ? '&' : '?';
      // 캐시 버스팅을 위한 타임스탬프 추가 (강제 새로고침이면 현재 시간, 아니면 하루 단위)
      const timestamp = forceRefresh ? Date.now() : Math.floor(Date.now() / (1000 * 60 * 60 * 24));
      return `${url}${separator}t=${timestamp}`;
    }
    
    return url;
  }
  return '/default-avatar.svg';
}

