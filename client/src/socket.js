import { io } from 'socket.io-client';

// 개발: localhost:3001, 프로덕션: 같은 호스트
const SERVER_URL = import.meta.env.DEV ? 'http://localhost:3001' : '';

export const socket = io(SERVER_URL, {
  autoConnect: false,
});
