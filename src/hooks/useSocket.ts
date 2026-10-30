import { useEffect, useRef, useState } from 'react';
import { getSocket } from '@/lib/socket';

/** Subscribes to a Socket.IO event for the lifetime of the component. */
export function useSocketEvent<T = unknown>(
  event: string,
  handler: (payload: T) => void,
  deps: unknown[] = []
): void {
  const saved = useRef(handler);
  saved.current = handler;

  useEffect(() => {
    const socket = getSocket();
    const listener = (payload: T) => saved.current(payload);
    socket.on(event, listener);
    return () => {
      socket.off(event, listener);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event, ...deps]);
}

/** Joins a server-side room while mounted. */
export function useSocketRoom(room: string | null): void {
  useEffect(() => {
    if (!room) return;
    const socket = getSocket();
    const join = () => socket.emit('subscribe', room);
    join();
    socket.on('connect', join);
    return () => {
      socket.emit('unsubscribe', room);
      socket.off('connect', join);
    };
  }, [room]);
}

export function useSocketStatus(): boolean {
  const [connected, setConnected] = useState(() => getSocket().connected);

  useEffect(() => {
    const socket = getSocket();
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, []);

  return connected;
}
