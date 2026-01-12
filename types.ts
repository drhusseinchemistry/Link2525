
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
  deviceName: string;
  screenHeight: number;
  screenWidth: number;
  language: string;
}

export interface Contact {
  name: string[];
  tel: string[];
}

export interface RemoteCommand {
  type: 'VIBRATE' | 'ALERT' | 'REDIRECT' | 'SPEAK' | 'REQUEST_GALLERY' | 'REQUEST_CONTACTS';
  payload?: any;
}

export interface FileTransfer {
    type: 'FILE_TRANSFER';
    fileName: string;
    fileType: string;
    data: string; // Base64
}

export interface PeerState {
  isConnected: boolean;
  roomId: string;
  isSharing: boolean;
}
