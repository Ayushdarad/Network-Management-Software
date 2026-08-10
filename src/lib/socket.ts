import { io, Socket } from 'socket.io-client';

const BACKEND_URL = window.location.origin;

let sharedSocket: Socket | null = null;

export function getSharedSocket(): Socket | null {
  const token = localStorage.getItem('nms_token');
  if (!token) return null;

  if (!sharedSocket) {
    sharedSocket = io(BACKEND_URL, {
      transports: ['websocket', 'polling'],
      auth: { token },
    });
  } else if (!sharedSocket.connected) {
    sharedSocket.auth = { token };
    sharedSocket.connect();
  }

  return sharedSocket;
}

export function disconnectSharedSocket() {
  if (sharedSocket) {
    sharedSocket.disconnect();
    sharedSocket = null;
  }
}
