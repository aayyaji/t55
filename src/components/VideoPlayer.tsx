import React, { useState, useEffect, useRef } from 'react';
import { Play } from 'lucide-react';
import YouTube, { YouTubeProps, YouTubePlayer } from 'react-youtube';
import { RoomState } from '../types';
import { RoomService } from '../lib/firestoreService';

interface VideoPlayerProps {
  roomId: string;
  isHost: boolean;
  initialState: RoomState | null;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ roomId, isHost, initialState }) => {
  const playerRef = useRef<YouTubePlayer | null>(null);
  const [localState, setLocalState] = useState<RoomState | null>(initialState);
  const lastSyncRef = useRef<number>(0);

  useEffect(() => {
    const unsubscribe = RoomService.subscribeToRoom(roomId, (state) => {
      setLocalState(state);
      
      if (!playerRef.current) return;

      // Drift correction and sync
      const playerTime = playerRef.current.getCurrentTime();
      const serverTime = state.currentTime;
      const timeDiff = Math.abs(playerTime - serverTime);

      // If we are not host, follow the server
      if (!isHost) {
        if (timeDiff > 2) {
          playerRef.current.seekTo(serverTime, true);
        }
        
        const playerState = playerRef.current.getPlayerState();
        if (state.isPlaying && playerState !== 1) {
          playerRef.current.playVideo();
        } else if (!state.isPlaying && playerState !== 2) {
          playerRef.current.pauseVideo();
        }
      }
    });

    return () => unsubscribe();
  }, [roomId, isHost]);

  const onStateChange: YouTubeProps['onStateChange'] = (event) => {
    if (!isHost) return;

    const playerState = event.data;
    const currentTime = event.target.getCurrentTime();
    
    // 1 = playing, 2 = paused
    const isPlaying = playerState === 1;
    
    // Debounce updates to Firestore
    const now = Date.now();
    if (now - lastSyncRef.current > 1000) {
      RoomService.updateRoomState(roomId, {
        isPlaying,
        currentTime,
      });
      lastSyncRef.current = now;
    }
  };

  const opts: YouTubeProps['opts'] = {
    height: '100%',
    width: '100%',
    playerVars: {
      autoplay: 1,
      controls: 1,
      modestbranding: 1,
      rel: 0,
    },
  };

  return (
    <div className="relative aspect-video w-full rounded-[2.5rem] overflow-hidden glass-card video-shadow group border-none shadow-2xl">
      {localState?.videoId ? (
        <>
          <YouTube
            videoId={localState.videoId}
            opts={opts}
            onReady={(e) => { playerRef.current = e.target; }}
            onStateChange={onStateChange}
            className="absolute inset-0 w-full h-full"
          />
          {/* Overlay for Host Status */}
          <div className="absolute top-8 right-8 pointer-events-none">
            <div className="glass px-6 py-3 rounded-2xl flex items-center gap-3 border border-white/10 shadow-2xl">
              <div className={`w-3 h-3 rounded-full ${isHost ? 'bg-brand-500 animate-pulse' : 'bg-zinc-500'}`} />
              <span className="text-sm font-black text-white uppercase tracking-widest">
                {isHost ? 'أنت المتحكم (Host)' : 'وضع المزامنة'}
              </span>
            </div>
          </div>
        </>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--input-bg)] space-y-6">
          <div className="w-24 h-24 bg-brand-500/10 rounded-full flex items-center justify-center animate-pulse">
            <Play className="text-brand-400 fill-brand-400" size={48} />
          </div>
          <p className="text-2xl font-display font-black text-[var(--text-secondary)]">في انتظار الفيديو...</p>
        </div>
      )}
    </div>
  );
};
