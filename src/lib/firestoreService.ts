import { 
  collection, 
  doc, 
  onSnapshot, 
  setDoc, 
  updateDoc, 
  addDoc, 
  serverTimestamp,
  query,
  where,
  orderBy,
  limit,
  deleteDoc
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { RoomState, User, Message, Reaction } from '../types';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
    },
    operationType,
    path
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const RoomService = {
  subscribeToRoom: (roomId: string, callback: (state: RoomState) => void) => {
    const roomRef = doc(db, 'rooms', roomId);
    return onSnapshot(roomRef, (snapshot) => {
      if (snapshot.exists()) {
        callback(snapshot.data() as RoomState);
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, `rooms/${roomId}`));
  },

  updateRoomState: async (roomId: string, updates: Partial<RoomState>) => {
    const roomRef = doc(db, 'rooms', roomId);
    try {
      await updateDoc(roomRef, {
        ...updates,
        lastUpdated: Date.now()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `rooms/${roomId}`);
    }
  },

  createRoom: async (roomId: string, videoId: string, userId: string) => {
    const roomRef = doc(db, 'rooms', roomId);
    const initialState: RoomState = {
      videoId,
      isPlaying: false,
      currentTime: 0,
      lastUpdated: Date.now(),
      hostId: userId
    };
    try {
      await setDoc(roomRef, initialState);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `rooms/${roomId}`);
    }
  },

  heartbeat: async (roomId: string) => {
    const roomRef = doc(db, 'rooms', roomId);
    try {
      await updateDoc(roomRef, {
        lastUpdated: Date.now()
      });
    } catch (error) {
      // Ignore errors for heartbeat
    }
  },

  deleteRoom: async (roomId: string) => {
    const roomRef = doc(db, 'rooms', roomId);
    try {
      await deleteDoc(roomRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `rooms/${roomId}`);
    }
  },

  listRooms: (callback: (rooms: { id: string; state: RoomState }[]) => void) => {
    const roomsRef = collection(db, 'rooms');
    // Only show rooms active in the last 2 minutes
    const activeThreshold = Date.now() - 120000;
    const q = query(
      roomsRef, 
      where('lastUpdated', '>', activeThreshold),
      orderBy('lastUpdated', 'desc'), 
      limit(10)
    );
    return onSnapshot(q, (snapshot) => {
      const rooms = snapshot.docs.map(doc => ({
        id: doc.id,
        state: doc.data() as RoomState
      }));
      callback(rooms);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'rooms'));
  }
};

export const UserService = {
  subscribeToUsers: (roomId: string, callback: (users: User[]) => void) => {
    const usersRef = collection(db, 'rooms', roomId, 'users');
    return onSnapshot(usersRef, (snapshot) => {
      const users = snapshot.docs.map(doc => doc.data() as User);
      callback(users);
    }, (error) => handleFirestoreError(error, OperationType.LIST, `rooms/${roomId}/users`));
  },

  updatePresence: async (roomId: string, user: User) => {
    const userRef = doc(db, 'rooms', roomId, 'users', user.id);
    try {
      await setDoc(userRef, {
        ...user,
        lastSeen: Date.now(),
        isOnline: true
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `rooms/${roomId}/users/${user.id}`);
    }
  },

  setTypingStatus: async (roomId: string, userId: string, isTyping: boolean) => {
    const userRef = doc(db, 'rooms', roomId, 'users', userId);
    try {
      await updateDoc(userRef, { isTyping });
    } catch (error) {
      // Ignore typing errors
    }
  }
};

export const ChatService = {
  subscribeToMessages: (roomId: string, callback: (messages: Message[]) => void) => {
    const messagesRef = collection(db, 'rooms', roomId, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'desc'), limit(50));
    return onSnapshot(q, (snapshot) => {
      const messages = snapshot.docs.map(doc => doc.data() as Message).reverse();
      callback(messages);
    }, (error) => handleFirestoreError(error, OperationType.LIST, `rooms/${roomId}/messages`));
  },

  sendMessage: async (roomId: string, message: Omit<Message, 'id' | 'timestamp'>) => {
    const messagesRef = collection(db, 'rooms', roomId, 'messages');
    try {
      await addDoc(messagesRef, {
        ...message,
        timestamp: Date.now()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `rooms/${roomId}/messages`);
    }
  }
};

export const ReactionService = {
  subscribeToReactions: (roomId: string, callback: (reactions: Reaction[]) => void) => {
    const reactionsRef = collection(db, 'rooms', roomId, 'reactions');
    const q = query(reactionsRef, orderBy('timestamp', 'desc'), limit(10));
    return onSnapshot(q, (snapshot) => {
      const reactions = snapshot.docs.map(doc => doc.data() as Reaction);
      callback(reactions);
    }, (error) => handleFirestoreError(error, OperationType.LIST, `rooms/${roomId}/reactions`));
  },

  sendReaction: async (roomId: string, emoji: string, userId: string) => {
    const reactionsRef = collection(db, 'rooms', roomId, 'reactions');
    try {
      await addDoc(reactionsRef, {
        emoji,
        userId,
        timestamp: Date.now()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `rooms/${roomId}/reactions`);
    }
  }
};
