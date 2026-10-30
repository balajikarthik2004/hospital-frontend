import { io, type Socket } from 'socket.io-client';
import { tokenStore } from './api';

const WS_URL = import.meta.env.VITE_WS_URL || window.location.origin;

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(WS_URL, {
      transports: ['websocket', 'polling'],
      auth: { token: tokenStore.get() ?? '' },
      autoConnect: true,
    });
  }
  return socket;
}

/** Reconnects with the new identity after sign-in or sign-out. */
export function reauthSocket(): void {
  if (!socket) return;
  socket.auth = { token: tokenStore.get() ?? '' };
  socket.disconnect().connect();
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}

export const rooms = {
  patient: (id: string) => `patient:${id}`,
  discharge: (id: string) => `discharge:${id}`,
};
