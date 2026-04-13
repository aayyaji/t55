import React, { useState, useEffect } from 'react';
import { auth, signInWithGoogle, loginAsGuest } from './lib/firebase';
import { onAuthStateChanged, User as FirebaseUser, updateProfile } from 'firebase/auth';
import { nanoid } from 'nanoid';
import { RoomService, UserService, ReactionService } from './lib/firestoreService';
import { RoomState, User, Reaction } from './types';
import { VideoPlayer } from './components/VideoPlayer';
import { Chat } from './components/Chat';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useUIStore } from './store/uiStore';
import { motion, AnimatePresence } from 'motion/react';
import { LogIn, Users, MessageSquare, Share2, Plus, UserCircle, Play, Settings, X, Search, Sun, Moon, Instagram, Loader2 } from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { YouTubeService, YouTubeSearchResult } from './lib/youtubeService';

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [participants, setParticipants] = useState<User[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [publicRooms, setPublicRooms] = useState<{ id: string; state: RoomState }[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [newVideoUrl, setNewVideoUrl] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [theme, setTheme] = useState<'cinema' | 'neon' | 'minimal'>('minimal');
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<YouTubeSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  useEffect(() => {
    if (isSettingsOpen && searchResults.length === 0 && roomState?.hostId === user?.uid) {
      const loadTrending = async () => {
        setIsSearching(true);
        const trending = await YouTubeService.getTrendingVideos();
        setSearchResults(trending);
        setIsSearching(false);
      };
      loadTrending();
    }
  }, [isSettingsOpen, roomState?.hostId, user?.uid]);

  const { isChatOpen, toggleChat } = useUIStore();

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Typing indicator logic
  useEffect(() => {
    if (!roomId || !user) return;
    UserService.setTypingStatus(roomId, user.uid, isTyping);
  }, [isTyping, roomId, user]);

  const createPoll = async () => {
    if (!roomId || !pollQuestion || pollOptions.some(o => !o)) return;
    const poll = {
      id: nanoid(),
      question: pollQuestion,
      options: pollOptions.map(o => ({ text: o, votes: [] })),
      active: true,
      createdAt: Date.now()
    };
    await RoomService.updateRoomState(roomId, { activePoll: poll });
    setPollQuestion('');
    setPollOptions(['', '']);
    toast.success('تم إنشاء الاستطلاع!');
  };

  const votePoll = async (optionIndex: number) => {
    if (!roomId || !roomState?.activePoll || !user) return;
    const poll = { ...roomState.activePoll };
    poll.options.forEach(opt => {
      opt.votes = opt.votes.filter(v => v !== user.uid);
    });
    poll.options[optionIndex].votes.push(user.uid);
    await RoomService.updateRoomState(roomId, { activePoll: poll });
  };

  const changeTheme = async (newTheme: 'cinema' | 'neon' | 'minimal') => {
    if (!roomId) return;
    await RoomService.updateRoomState(roomId, { theme: newTheme });
    setTheme(newTheme);
  };

  useEffect(() => {
    if (roomState?.theme) setTheme(roomState.theme);
  }, [roomState?.theme]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const rId = params.get('room');
    if (rId) setRoomId(rId);
  }, []);

  useEffect(() => {
    if (!user || roomId) return;
    const unsub = RoomService.listRooms(setPublicRooms);
    return () => unsub();
  }, [user, roomId]);

  useEffect(() => {
    if (!roomId || !user) return;

    const unsubRoom = RoomService.subscribeToRoom(roomId, setRoomState);
    const unsubUsers = UserService.subscribeToUsers(roomId, setParticipants);
    const unsubReactions = ReactionService.subscribeToReactions(roomId, setReactions);

    // Initial heartbeat and presence
    RoomService.heartbeat(roomId);
    UserService.updatePresence(roomId, {
      id: user.uid,
      name: user.displayName || `زائر ${user.uid.slice(0, 4)}`,
      isHost: roomState?.hostId === user.uid,
      isOnline: true,
      lastSeen: Date.now()
    });

    const presenceInterval = setInterval(() => {
      UserService.updatePresence(roomId, {
        id: user.uid,
        name: user.displayName || `زائر ${user.uid.slice(0, 4)}`,
        isHost: roomState?.hostId === user.uid,
        isOnline: true,
        lastSeen: Date.now()
      });
      // Refresh room activity so it stays in the public list
      RoomService.heartbeat(roomId);
    }, 10000);

    return () => {
      unsubRoom();
      unsubUsers();
      unsubReactions();
      clearInterval(presenceInterval);
    };
  }, [roomId, user, roomState?.hostId]);

  const createRoom = async () => {
    if (!user) return;
    const newRoomId = nanoid(10);
    const videoId = 'dQw4w9WgXcQ'; 
    await RoomService.createRoom(newRoomId, videoId, user.uid);
    window.history.pushState({}, '', `?room=${newRoomId}`);
    setRoomId(newRoomId);
    toast.success('تم إنشاء الغرفة بنجاح!');
  };

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success('تم نسخ الرابط إلى الحافظة!');
  };

  const extractVideoId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const changeVideo = async () => {
    if (!roomId || !newVideoUrl) return;
    const vId = extractVideoId(newVideoUrl);
    if (!vId) {
      toast.error('رابط يوتيوب غير صالح');
      return;
    }
    await RoomService.updateRoomState(roomId, { videoId: vId, currentTime: 0, isPlaying: true });
    setIsSettingsOpen(false);
    setNewVideoUrl('');
    toast.success('تم تغيير الفيديو!');
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const results = await YouTubeService.searchVideos(searchQuery);
      setSearchResults(results);
      if (results.length === 0) {
        toast.error('لم يتم العثور على نتائج');
      }
    } catch (error) {
      console.error(error);
      toast.error('حدث خطأ أثناء البحث');
    } finally {
      setIsSearching(false);
    }
  };

  const selectVideo = async (videoId: string) => {
    if (!roomId) return;
    await RoomService.updateRoomState(roomId, { videoId, currentTime: 0, isPlaying: true });
    setIsSettingsOpen(false);
    setSearchResults([]);
    setSearchQuery('');
    toast.success('تم تغيير الفيديو!');
  };

  const leaveRoom = async () => {
    if (!roomId || !user) return;
    
    // If user is host, delete the room immediately
    if (roomState?.hostId === user.uid) {
      await RoomService.deleteRoom(roomId);
      toast.info('تم إغلاق الغرفة وحذفها بنجاح');
    } else {
      // Just leave for non-hosts
      toast.info('لقد غادرت الغرفة');
    }
    
    window.history.pushState({}, '', window.location.pathname);
    setRoomId(null);
    setRoomState(null);
  };

  const handleGoogleLogin = async () => {
    try {
      await signInWithGoogle();
      toast.success('تم تسجيل الدخول بجوجل بنجاح!');
    } catch (error) {
      console.error('Google Login Error:', error);
      toast.error('حدث خطأ أثناء تسجيل الدخول بجوجل.');
    }
  };

  const handleGuestLogin = async () => {
    try {
      await loginAsGuest();
      toast.success('تم الدخول كزائر بنجاح!');
    } catch (error: any) {
      console.error('Guest Login Error:', error);
      if (error.code === 'auth/operation-not-allowed') {
        toast.error('عذراً، يجب تفعيل "تسجيل الدخول المجهول" (Anonymous Auth) من لوحة تحكم Firebase أولاً.');
      } else {
        toast.error('حدث خطأ أثناء الدخول كزائر. يرجى المحاولة لاحقاً.');
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)]">
        <div className="w-16 h-16 border-4 border-brand-500 border-t-transparent rounded-full animate-spin shadow-[0_0_30px_rgba(14,165,233,0.3)]"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--bg-primary)] p-4 text-center relative overflow-hidden" dir="rtl">
        {/* Theme Toggle for Landing */}
        <div className="absolute top-10 left-10 z-50">
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="p-4 bg-[var(--input-bg)] hover:bg-[var(--glass-border)] border border-[var(--glass-border)] rounded-2xl text-[var(--text-secondary)] transition-all hover:text-[var(--text-primary)]"
          >
            {isDarkMode ? <Sun size={24} /> : <Moon size={24} />}
          </button>
        </div>
        
        {/* Background Glows */}
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-brand-500/10 blur-[150px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-500/10 blur-[150px] rounded-full animate-pulse" style={{ animationDelay: '1s' }} />

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center space-y-16 max-w-4xl z-10"
        >
          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 px-5 py-2 bg-brand-500/10 border border-brand-500/20 rounded-full text-brand-400 text-sm font-bold mb-4 animate-float"
            >
              <span className="w-2 h-2 bg-brand-500 rounded-full animate-ping" />
              مستقبل المشاهدة الجماعية في العراق 🇮🇶
            </motion.div>
            <h1 className="text-8xl md:text-[12rem] font-display font-black tracking-tighter bg-gradient-to-b from-[var(--text-primary)] via-[var(--text-primary)] to-[var(--text-primary)]/20 bg-clip-text text-transparent leading-[0.75]">
              سينك ستريم
            </h1>
            <p className="text-[var(--text-secondary)] text-xl md:text-3xl max-w-2xl mx-auto leading-relaxed font-medium">
              شاهد يوتيوب مع أصدقائك في العراق بتزامن تام. تجربة سينمائية، دردشة مباشرة، وتفاعلات حية في مكان واحد.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
            <button
              onClick={handleGoogleLogin}
              className="w-full sm:w-auto flex items-center justify-center gap-4 px-12 py-7 bg-white text-black font-black rounded-[2.5rem] hover:bg-zinc-200 transition-all transform hover:scale-105 active:scale-95 shadow-2xl shadow-black/20 text-2xl"
            >
              <LogIn size={28} />
              تسجيل الدخول بجوجل
            </button>
            <button
              onClick={handleGuestLogin}
              className="w-full sm:w-auto flex items-center justify-center gap-4 px-12 py-7 bg-[var(--input-bg)] text-[var(--text-primary)] font-black rounded-[2.5rem] border border-[var(--glass-border)] hover:bg-[var(--glass-border)] transition-all transform hover:scale-105 active:scale-95 text-2xl"
            >
              <UserCircle size={28} />
              الدخول كزائر
            </button>
          </div>

          <div className="flex flex-col items-center gap-4 pt-10">
            <a 
              href="https://www.instagram.com/_50j0/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-2xl font-bold hover:scale-105 transition-all shadow-lg"
            >
              <Instagram size={20} />
              صنع بواسطة _50j0
            </a>
          </div>

          <div className="pt-20 grid grid-cols-3 gap-12 text-[var(--text-secondary)] border-t border-[var(--glass-border)]">
            <div className="space-y-2">
              <div className="text-[var(--text-primary)] font-black text-4xl">100%</div>
              <div className="text-xs uppercase tracking-[0.2em] font-bold">تزامن دقيق</div>
            </div>
            <div className="space-y-2">
              <div className="text-[var(--text-primary)] font-black text-4xl">∞</div>
              <div className="text-xs uppercase tracking-[0.2em] font-bold">غرف غير محدودة</div>
            </div>
            <div className="space-y-2">
              <div className="text-[var(--text-primary)] font-black text-4xl">0ms</div>
              <div className="text-xs uppercase tracking-[0.2em] font-bold">تأخير منخفض</div>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  if (!roomId) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--bg-primary)] p-6" dir="rtl">
        {/* Theme Toggle for Room List */}
        <div className="absolute top-10 left-10 z-50">
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="p-4 bg-[var(--input-bg)] hover:bg-[var(--glass-border)] border border-[var(--glass-border)] rounded-2xl text-[var(--text-secondary)] transition-all hover:text-[var(--text-primary)]"
          >
            {isDarkMode ? <Sun size={24} /> : <Moon size={24} />}
          </button>
        </div>
        
        <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Create Room Card */}
          <motion.div 
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            className="glass-card p-20 text-center space-y-12 relative overflow-hidden flex flex-col justify-center group"
          >
            <div className="absolute top-0 left-0 w-full h-3 bg-gradient-to-r from-brand-500 via-purple-500 to-brand-500" />
            <div className="w-40 h-40 bg-brand-500/10 rounded-[3.5rem] flex items-center justify-center mx-auto rotate-12 group-hover:rotate-0 transition-all duration-700 shadow-inner">
              <Play className="text-brand-400 fill-brand-400" size={80} />
            </div>
            <div className="space-y-6">
              <h2 className="text-6xl font-display font-black tracking-tight">ابدأ المتعة الآن</h2>
              <p className="text-[var(--text-secondary)] text-xl leading-relaxed max-w-sm mx-auto">أنشئ غرفتك الخاصة وشارك اللحظات مع من تحب في ثوانٍ معدودة.</p>
            </div>
            <button
              onClick={createRoom}
              className="btn-primary text-2xl py-8 shadow-brand-500/40 rounded-[2.5rem]"
            >
              <Plus size={32} />
              إنشاء غرفة جديدة
            </button>
          </motion.div>

          {/* Public Rooms List */}
          <motion.div 
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            className="glass-card p-16 space-y-10 flex flex-col"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-4xl font-display font-black">الغرف النشطة</h2>
              <div className="px-6 py-2.5 bg-green-500/10 text-green-400 rounded-full text-sm font-black uppercase tracking-widest flex items-center gap-3 border border-green-500/20">
                <span className="w-3 h-3 bg-green-500 rounded-full animate-ping" />
                مباشر
              </div>
            </div>

            <div className="flex-1 space-y-6 overflow-y-auto max-h-[600px] pr-4 custom-scrollbar">
              {publicRooms.length > 0 ? (
                publicRooms.map((room) => (
                  <button
                    key={room.id}
                    onClick={() => {
                      setRoomId(room.id);
                      window.history.pushState({}, '', `?room=${room.id}`);
                    }}
                    className="w-full p-8 bg-[var(--input-bg)] hover:bg-[var(--glass-border)] border border-[var(--glass-border)] rounded-[2.5rem] transition-all text-right group flex items-center justify-between hover:scale-[1.02] active:scale-[0.98] shadow-sm hover:shadow-xl"
                  >
                    <div className="space-y-3">
                      <div className="text-[var(--text-primary)] text-2xl font-black group-hover:text-brand-400 transition-colors">غرفة: {room.id.slice(0, 8)}</div>
                      <div className="text-base text-[var(--text-secondary)] flex items-center gap-3 font-medium">
                        <Users size={20} className="text-brand-500" />
                        نشطة منذ {new Date(room.state.lastUpdated).toLocaleTimeString('ar-SA')}
                      </div>
                    </div>
                    <div className="w-16 h-16 rounded-[1.5rem] bg-brand-500/10 flex items-center justify-center text-brand-400 group-hover:bg-brand-500 group-hover:text-white transition-all shadow-lg">
                      <LogIn size={32} />
                    </div>
                  </button>
                ))
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-[var(--text-secondary)] space-y-8 py-24">
                  <div className="w-32 h-32 bg-[var(--input-bg)] rounded-full flex items-center justify-center">
                    <Search size={64} className="opacity-20" />
                  </div>
                  <p className="text-2xl font-medium">لا توجد غرف نشطة حالياً</p>
                </div>
              )}
            </div>
          </motion.div>
        </div>

        <div className="mt-12 flex flex-col items-center gap-4">
          <a 
            href="https://www.instagram.com/_50j0/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-2xl font-bold hover:scale-105 transition-all shadow-lg"
          >
            <Instagram size={20} />
            صنع بواسطة _50j0
          </a>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className={`min-h-screen transition-all duration-700 ${
        theme === 'cinema' ? 'bg-black' : 
        theme === 'neon' ? 'bg-[#0a0a0f]' : 
        'bg-[var(--bg-primary)]'
      } flex flex-col`} dir="rtl">
        {theme === 'neon' && (
          <div className="fixed inset-0 pointer-events-none opacity-20">
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-600 rounded-full blur-[120px] animate-pulse" />
            <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-600 rounded-full blur-[120px] animate-pulse" />
          </div>
        )}
        <Toaster position="top-center" theme={isDarkMode ? 'dark' : 'light'} />
        
        {/* Header */}
        <header className="h-20 md:h-28 glass border-b border-[var(--glass-border)] px-4 md:px-12 flex items-center justify-between z-50 sticky top-0">
          <div className="flex items-center gap-4 md:gap-10">
            <div className="flex items-center gap-3 md:gap-4 group cursor-pointer">
              <div className="w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-[1.5rem] overflow-hidden shadow-2xl shadow-brand-500/40 group-hover:scale-110 transition-transform border-2 border-brand-500/20 group-hover:border-brand-500/50">
                <img 
                  src="https://storage.googleapis.com/applet-assets/fbc229f5-8e03-4d21-a785-375f1238a529/input_file_0.png" 
                  alt="سينك ستريم العراق" 
                  className="w-full h-full object-cover brightness-90 group-hover:brightness-110 transition-all"
                  referrerPolicy="no-referrer"
                />
              </div>
              <h1 className="text-xl md:text-3xl font-display font-black tracking-tighter text-[var(--text-primary)] hidden sm:block">سينك ستريم العراق 🇮🇶</h1>
            </div>
            <div className="h-8 md:h-10 w-[1px] bg-[var(--glass-border)] hidden lg:block" />
            <div className="hidden lg:flex items-center gap-5 text-[var(--text-secondary)] bg-[var(--input-bg)] px-6 md:px-8 py-2 md:py-3 rounded-xl md:rounded-[1.5rem] border border-[var(--glass-border)]">
              <Users size={20} className="text-brand-400" />
              <span className="text-sm md:text-base font-bold">{participants.length} يشاهدون</span>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-6">
            <button
              onClick={copyLink}
              className="btn-secondary px-4 md:px-8 py-2 md:py-4 text-sm md:text-base"
            >
              <Share2 size={20} md:size={24} />
              <span className="hidden md:inline">مشاركة</span>
            </button>

            <button
              onClick={leaveRoom}
              className="flex items-center gap-2 md:gap-4 px-4 md:px-8 py-2 md:py-4 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-xl md:rounded-[1.5rem] text-red-400 transition-all text-sm md:text-base font-black"
            >
              <X size={20} md:size={24} />
              <span className="hidden md:inline">إغلاق</span>
            </button>
            
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2 md:p-4 bg-[var(--input-bg)] hover:bg-[var(--glass-border)] border border-[var(--glass-border)] rounded-xl md:rounded-[1.5rem] text-[var(--text-secondary)] transition-all hover:text-[var(--text-primary)]"
            >
              {isDarkMode ? <Sun size={20} md:size={26} /> : <Moon size={20} md:size={26} />}
            </button>

            {roomState?.hostId === user.uid && (
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="p-2 md:p-3.5 bg-[var(--input-bg)] hover:bg-[var(--glass-border)] border border-[var(--glass-border)] rounded-xl md:rounded-2xl text-[var(--text-secondary)] transition-all hover:text-[var(--text-primary)]"
              >
                <Settings size={20} md:size={22} />
              </button>
            )}

            <button
              onClick={toggleChat}
              className={`p-2 md:p-3.5 rounded-xl md:rounded-2xl transition-all border ${isChatOpen ? 'bg-brand-500/20 border-brand-500/30 text-brand-400' : 'bg-[var(--input-bg)] border-[var(--glass-border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
            >
              <MessageSquare size={22} />
            </button>

            <div className="w-12 h-12 rounded-2xl overflow-hidden border border-[var(--glass-border)] shadow-2xl">
              {user.photoURL ? (
                <img src={user.photoURL} alt={user.displayName || ''} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center text-white font-black text-xl">
                  {user.displayName?.[0] || 'Z'}
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
          {/* Reaction Overlay */}
          <div className="absolute inset-0 pointer-events-none z-40 overflow-hidden">
            <AnimatePresence>
              {reactions.map((r) => (
                <motion.div
                  key={r.id || r.timestamp}
                  initial={{ y: '100vh', x: `${Math.random() * 100}vw`, opacity: 1, scale: 0.5 }}
                  animate={{ y: '-10vh', opacity: 0, scale: 2 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 4, ease: 'easeOut' }}
                  className="absolute text-6xl drop-shadow-2xl"
                >
                  {r.emoji}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          <div className="flex-1 p-4 md:p-10 flex flex-col gap-6 md:gap-10 overflow-y-auto custom-scrollbar relative">
            {/* Active Poll Overlay */}
            <AnimatePresence>
              {roomState?.activePoll && (
                <motion.div
                  initial={{ opacity: 0, x: 40, scale: 0.9 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: 40, scale: 0.9 }}
                  className="absolute top-10 left-10 w-96 glass-card p-10 space-y-8 border-brand-500/30 shadow-2xl shadow-brand-500/20 z-50"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-brand-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-brand-500/20">
                        <MessageSquare size={20} />
                      </div>
                      <h4 className="text-2xl font-display font-black text-[var(--text-primary)]">استطلاع رأي</h4>
                    </div>
                    <div className="w-3 h-3 bg-brand-500 rounded-full animate-pulse" />
                  </div>
                  <p className="text-lg font-bold text-[var(--text-secondary)] leading-relaxed">{roomState.activePoll.question}</p>
                  <div className="space-y-4">
                    {roomState.activePoll.options.map((opt, idx) => {
                      const totalVotes = roomState.activePoll!.options.reduce((acc, curr) => acc + curr.votes.length, 0);
                      const percentage = totalVotes > 0 ? Math.round((opt.votes.length / totalVotes) * 100) : 0;
                      const hasVoted = opt.votes.includes(user.uid);
                      
                      return (
                        <button
                          key={idx}
                          onClick={() => votePoll(idx)}
                          className={`w-full p-6 rounded-[1.5rem] border transition-all text-right relative overflow-hidden group ${
                            hasVoted ? 'border-brand-500 bg-brand-500/10' : 'border-[var(--glass-border)] bg-[var(--input-bg)] hover:bg-[var(--glass-border)]'
                          }`}
                        >
                          <div 
                            className="absolute inset-0 bg-brand-500/10 transition-all duration-1000" 
                            style={{ width: `${percentage}%`, right: 0 }} 
                          />
                          <div className="relative flex items-center justify-between">
                            <span className="font-black text-lg">{percentage}%</span>
                            <span className="font-bold text-lg">{opt.text}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="video-shadow rounded-2xl md:rounded-[2.5rem] overflow-hidden border border-[var(--glass-border)]">
              <VideoPlayer 
                roomId={roomId} 
                isHost={roomState?.hostId === user.uid} 
                initialState={roomState}
              />
            </div>
            
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 md:gap-10">
              <div className="xl:col-span-2 space-y-6 md:space-y-10">
                <div className="glass-card p-6 md:p-10 space-y-6 md:space-y-8">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl md:text-2xl font-display font-black text-[var(--text-primary)]">تفاصيل الجلسة</h3>
                    <div className="px-3 py-1 bg-brand-500/10 text-brand-400 rounded-full text-[10px] md:text-xs font-black uppercase tracking-widest border border-brand-500/20">نشط 🇮🇶</div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10">
                    <div className="space-y-2">
                      <span className="text-[10px] md:text-xs text-[var(--text-secondary)] uppercase font-black tracking-widest">معرف الغرفة الفريد</span>
                      <div className="text-[var(--text-primary)] font-mono text-base md:text-xl bg-[var(--input-bg)] p-3 md:p-4 rounded-xl md:rounded-2xl border border-[var(--glass-border)] truncate">{roomId}</div>
                    </div>
                    <div className="space-y-2">
                      <span className="text-[10px] md:text-xs text-[var(--text-secondary)] uppercase font-black tracking-widest">المضيف المسؤول</span>
                      <div className="text-brand-400 font-black text-base md:text-xl bg-brand-500/5 p-3 md:p-4 rounded-xl md:rounded-2xl border border-brand-500/10">
                        {participants.find(p => p.isHost)?.name || 'جاري التحميل...'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="glass-card p-6 md:p-10 space-y-6 md:space-y-8">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl md:text-2xl font-display font-black text-[var(--text-primary)]">المشاركون</h3>
                  <span className="bg-[var(--input-bg)] text-[var(--text-secondary)] px-3 py-1 rounded-lg text-sm font-bold">{participants.length}</span>
                </div>
                <div className="space-y-3 md:space-y-4 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                  {participants.map(p => (
                    <div key={p.id} className="flex items-center justify-between p-3 md:p-4 bg-[var(--input-bg)] rounded-xl md:rounded-2xl border border-[var(--glass-border)] hover:bg-[var(--glass-border)] transition-all group">
                      <div className="flex items-center gap-3 md:gap-4">
                        <div className={`w-2.5 h-2.5 rounded-full ${p.isOnline ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-zinc-600'}`} />
                        <span className="text-base md:text-lg font-bold text-[var(--text-primary)]">{p.name}</span>
                      </div>
                      {p.isHost && (
                        <span className="text-[9px] md:text-[10px] bg-brand-500/20 text-brand-400 px-2 md:px-3 py-1 rounded-lg font-black border border-brand-500/20 uppercase tracking-tighter">مضيف</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar Chat */}
          <AnimatePresence>
            {isChatOpen && (
              <motion.aside
                initial={{ x: 500 }}
                animate={{ x: 0 }}
                exit={{ x: 500 }}
                className="w-[450px] border-r border-[var(--glass-border)] bg-[var(--bg-primary)]/90 backdrop-blur-3xl hidden lg:block shadow-2xl"
              >
                <Chat 
                  roomId={roomId} 
                  currentUser={{ id: user.uid, name: user.displayName || 'مستخدم' }} 
                />
              </motion.aside>
            )}
          </AnimatePresence>

          {/* Settings Modal */}
          <AnimatePresence>
            {isSettingsOpen && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-10">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setIsSettingsOpen(false)}
                  className="absolute inset-0 bg-black/80 backdrop-blur-xl"
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: 40 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 40 }}
                  className="glass-card p-6 md:p-16 max-w-4xl w-full relative z-10 space-y-8 md:space-y-12 max-h-[90vh] overflow-y-auto custom-scrollbar"
                >
                  <div className="flex items-center justify-between sticky top-0 bg-[var(--card-bg)] backdrop-blur-3xl z-20 py-2">
                    <h2 className="text-3xl md:text-5xl font-display font-black text-[var(--text-primary)]">إعدادات الغرفة</h2>
                    <button onClick={() => setIsSettingsOpen(false)} className="p-2 md:p-4 hover:bg-[var(--glass-border)] rounded-xl md:rounded-2xl transition-colors">
                      <X size={24} md:size={32} />
                    </button>
                  </div>
                  
                  <div className="space-y-8 md:space-y-10">
                  {/* Theme Selection */}
                  <div className="space-y-4 md:space-y-6">
                    <label className="text-[10px] md:text-xs font-black text-[var(--text-secondary)] uppercase tracking-[0.2em]">تخصيص المود (Theme)</label>
                    <div className="grid grid-cols-3 gap-3 md:gap-6">
                      {[
                        { id: 'minimal', name: 'كلاسيك', icon: '🎬' },
                        { id: 'cinema', name: 'سينما', icon: '🌑' },
                        { id: 'neon', name: 'نيون', icon: '🌈' },
                      ].map((t) => (
                        <button
                          key={t.id}
                          onClick={() => setTheme(t.id as any)}
                          className={`p-4 md:p-8 rounded-2xl md:rounded-[2rem] border-2 transition-all flex flex-col items-center gap-2 md:gap-4 ${
                            theme === t.id ? 'border-brand-500 bg-brand-500/10' : 'border-[var(--glass-border)] bg-[var(--input-bg)] hover:bg-[var(--glass-border)]'
                          }`}
                        >
                          <span className="text-2xl md:text-4xl">{t.icon}</span>
                          <span className="font-black text-[var(--text-primary)] text-sm md:text-lg">{t.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* YouTube Search */}
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] md:text-xs text-[var(--text-secondary)] font-black uppercase tracking-[0.2em]">
                        {searchQuery ? 'نتائج البحث' : 'فيديوهات مقترحة'}
                      </label>
                      {searchQuery && (
                        <button 
                          onClick={() => {
                            setSearchQuery('');
                            setSearchResults([]);
                          }}
                          className="text-[10px] md:text-xs text-brand-400 font-black uppercase hover:underline"
                        >
                          مسح البحث
                        </button>
                      )}
                    </div>
                    <div className="flex flex-col md:flex-row gap-4">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                          placeholder="ابحث عن مقطع، أغنية، أو فيلم..."
                          className="glass-input w-full pr-14 md:pr-16 text-[var(--text-primary)] text-base md:text-lg h-16 md:h-20"
                        />
                        <Search className="absolute right-5 md:right-6 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" size={24} />
                      </div>
                      <button 
                        onClick={handleSearch}
                        disabled={isSearching}
                        className="btn-primary px-8 md:px-10 h-16 md:h-20 rounded-xl md:rounded-2xl flex items-center justify-center min-w-[100px] md:min-w-[120px] text-lg"
                      >
                        {isSearching ? <Loader2 className="animate-spin" size={24} /> : 'بحث'}
                      </button>
                    </div>

                    {/* Search Results */}
                    <AnimatePresence>
                      {searchResults.length > 0 && (
                        <motion.div 
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 20 }}
                          className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto custom-scrollbar p-2"
                        >
                          {searchResults.map((result) => (
                            <button
                              key={result.id}
                              onClick={() => selectVideo(result.id)}
                              className="flex flex-col p-3 bg-[var(--input-bg)] rounded-2xl border border-[var(--glass-border)] hover:border-brand-500 transition-all group text-right gap-3"
                            >
                              <div className="relative aspect-video w-full overflow-hidden rounded-xl shadow-lg">
                                <img src={result.thumbnail} alt={result.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/0 transition-colors" />
                              </div>
                              <div className="space-y-1 px-1">
                                <h4 className="text-sm md:text-base font-black text-[var(--text-primary)] line-clamp-2 leading-tight">{result.title}</h4>
                                <p className="text-[10px] md:text-xs text-[var(--text-secondary)] font-bold">{result.channelTitle}</p>
                              </div>
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="space-y-4">
                    <label className="text-[10px] md:text-xs text-[var(--text-secondary)] font-black uppercase tracking-[0.2em]">أو أدخل رابط الفيديو يدوياً</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={newVideoUrl}
                        onChange={(e) => setNewVideoUrl(e.target.value)}
                        placeholder="https://www.youtube.com/watch?v=..."
                        className="glass-input w-full pr-14 md:pr-16 text-[var(--text-primary)] text-base md:text-lg h-16 md:h-20"
                      />
                      <Search className="absolute right-5 md:right-6 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" size={24} />
                    </div>
                  </div>

                  {/* Create Poll */}
                  <div className="space-y-6">
                    <label className="text-[10px] md:text-xs font-black text-[var(--text-secondary)] uppercase tracking-[0.2em]">إنشاء استطلاع رأي</label>
                    <div className="space-y-4 md:space-y-5">
                      <input
                        type="text"
                        value={pollQuestion}
                        onChange={(e) => setPollQuestion(e.target.value)}
                        placeholder="ما هو سؤالك؟"
                        className="w-full glass-input text-[var(--text-primary)] h-16 md:h-20 text-base md:text-lg"
                      />
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                        {pollOptions.map((opt, idx) => (
                          <input
                            key={idx}
                            type="text"
                            value={opt}
                            onChange={(e) => {
                              const newOpts = [...pollOptions];
                              newOpts[idx] = e.target.value;
                              setPollOptions(newOpts);
                            }}
                            placeholder={`خيار ${idx + 1}`}
                            className="glass-input text-[var(--text-primary)] h-14 md:h-16"
                          />
                        ))}
                      </div>
                      <button onClick={createPoll} className="w-full btn-secondary py-5 md:py-6 text-lg md:text-xl">بدء الاستطلاع</button>
                    </div>
                  </div>

                  <button
                    onClick={changeVideo}
                    className="btn-primary w-full text-xl md:text-2xl py-6 md:py-7 rounded-2xl md:rounded-[2rem]"
                  >
                    تحديث الفيديو للجميع
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
        {/* Active Poll Overlay */}
        <AnimatePresence>
          {roomState?.activePoll && (
            <motion.div 
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 100 }}
              className="fixed bottom-32 right-10 z-[60] w-80 glass-card p-6 space-y-4 border-brand-500/30"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-brand-400 uppercase tracking-widest">استطلاع مباشر</span>
                {roomState.hostId === user.uid && (
                  <button 
                    onClick={() => RoomService.updateRoomState(roomId, { activePoll: null })}
                    className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              <h4 className="font-bold text-lg text-[var(--text-primary)]">{roomState.activePoll.question}</h4>
              <div className="space-y-3">
                {roomState.activePoll.options.map((opt, idx) => {
                  const totalVotes = roomState.activePoll!.options.reduce((acc, o) => acc + o.votes.length, 0);
                  const percentage = totalVotes > 0 ? (opt.votes.length / totalVotes) * 100 : 0;
                  const hasVoted = opt.votes.includes(user.uid);

                  return (
                    <button
                      key={idx}
                      onClick={() => votePoll(idx)}
                      className={`w-full relative h-12 rounded-xl overflow-hidden border transition-all ${
                        hasVoted ? 'border-brand-500 bg-brand-500/10' : 'border-[var(--glass-border)] bg-[var(--input-bg)] hover:bg-[var(--glass-border)]'
                      }`}
                    >
                      <div 
                        className="absolute inset-y-0 left-0 bg-brand-500/20 transition-all duration-1000" 
                        style={{ width: `${percentage}%` }}
                      />
                      <div className="absolute inset-0 flex items-center justify-between px-4 text-sm font-bold text-[var(--text-primary)]">
                        <span>{opt.text}</span>
                        <span>{Math.round(percentage)}%</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        </main>
      </div>
    </ErrorBoundary>
  );
}

