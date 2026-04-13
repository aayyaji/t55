export interface User {
  id: string;
  name: string;
  photoURL?: string;
  isHost: boolean;
  isOnline: boolean;
  lastSeen: number;
  isTyping?: boolean;
}

export interface Message {
  id: string;
  userId: string;
  userName: string;
  text: string;
  timestamp: number;
}

export interface Poll {
  id: string;
  question: string;
  options: { text: string; votes: string[] }[];
  active: boolean;
  createdAt: number;
}

export interface RoomState {
  videoId: string;
  isPlaying: boolean;
  currentTime: number;
  lastUpdated: number;
  hostId: string;
  theme?: 'cinema' | 'neon' | 'minimal';
  activePoll?: Poll | null;
}

export interface Reaction {
  id: string;
  emoji: string;
  userId: string;
  timestamp: number;
}
