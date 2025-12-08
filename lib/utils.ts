/**
 *
 *
 * 
 * 
 * @param profileImageUrl 
 * @param forceRefresh 
 * @returns 
 */
export function getProfileImageUrl(profileImageUrl: string | null | undefined, forceRefresh: boolean = false): string {
  if (profileImageUrl && profileImageUrl.trim()) {
    let url = profileImageUrl.trim();
    
    if (url.includes('?')) {
      const [baseUrl, queryString] = url.split('?');
      const params = new URLSearchParams(queryString);
      params.delete('t'); // 기존 타임스탬프 제거
      const newQueryString = params.toString();
      url = newQueryString ? `${baseUrl}?${newQueryString}` : baseUrl;
    }
    
  
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/')) {
      const separator = url.includes('?') ? '&' : '?';
      const timestamp = forceRefresh ? Date.now() : Math.floor(Date.now() / (1000 * 60 * 60 * 24));
      return `${url}${separator}t=${timestamp}`;
    }
    
    return url;
  }
  return '/default-avatar.svg';
}

