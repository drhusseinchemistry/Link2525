
export enum AppMode {
  IDLE = 'IDLE',
  HOST = 'HOST', // The device being controlled
  CONTROLLER = 'CONTROLLER' // The device controlling
}

export interface RemoteEvent {
  type: 'mouse' | 'touch' | 'keyboard' | 'chat';
  x?: number;
  y?: number;
  key?: string;
  data?: string;
}

export interface PeerState {
  isConnected: boolean;
  roomId: string;
  isSharing: boolean;
}
