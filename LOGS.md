# 로그 가이드

## 서버 로그

서버가 시작되면 다음과 같은 로그가 출력됩니다:

```
> Ready on http://localhost:3000
> Socket.IO initialized on /api/socket
```

## Socket.IO 연결 로그

### 서버 측 (터미널)
- `Client connected: [socket.id]` - 클라이언트 연결 시
- `Setting up handlers for socket: [socket.id]` - 핸들러 설정 시
- `Socket [socket.id] joined room [roomId]` - 룸 참가 시
- `Socket [socket.id] left room [roomId]` - 룸 나가기 시
- `Socket [socket.id] disconnected` - 연결 해제 시

### 클라이언트 측 (브라우저 콘솔)
- `Socket connected: [socket.id]` - 연결 성공 시
- `Socket disconnected` - 연결 해제 시

## Redis 로그

- `Redis URL not configured. Redis features will be disabled.` - Redis 미설정 시 경고
- `Redis Client Connected` - Redis 연결 성공 시
- `Redis Client Error: [error]` - Redis 에러 시

## 에러 로그

- `Error occurred handling [url] [error]` - 요청 처리 중 에러 발생 시

## 로그 확인 방법

1. **서버 로그**: 터미널에서 `npm run dev` 실행 시 확인
2. **클라이언트 로그**: 브라우저 개발자 도구 콘솔에서 확인
3. **Socket.IO 이벤트**: 브라우저 네트워크 탭에서 WebSocket 연결 확인

