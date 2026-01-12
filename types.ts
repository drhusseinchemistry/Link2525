
export enum AppMode {
  IDLE = 'IDLE',
  HOST = 'HOST', 
  CONTROLLER = 'CONTROLLER' 
}

export interface DeviceInfo {
  latitude?: number;
  longitude?: number;
  battery?: number;
  platform: string;
  userAgent: string;
  screenHeight: number;
  screenWidth: number;
  language: string;
}

export interface RemoteCommand {
  type: 'VIBRATE' | 'ALERT' | 'REDIRECT' | 'SPEAK';
  payload?: any;
}

export interface PeerState {
  isConnected: boolean;
  roomId: string;
  isSharing: boolean;
}
