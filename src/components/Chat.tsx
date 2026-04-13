import React, { useState, useEffect, useRef } from 'react';
import { Send, Smile } from 'lucide-react';
import { ChatService, ReactionService, UserService } from '../lib/firestoreService';
import { Message, User } from '../types';
import { motion, AnimatePresence } from 'motion/react';

interface ChatProps {
  roomId: string;
  currentUser: { id: string; name: string };
}

export const Chat: React.FC<ChatProps> = ({ roomId, currentUser }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [typingUsers, setTypingUsers] = useState<User[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribe = ChatService.subscribeToMessages(roomId, (msgs) => {
      setMessages(msgs);
    });
    return () => unsubscribe();
  }, [roomId]);

  useEffect(() => {
    const unsubscribe = UserService.subscribeToUsers(roomId, (users) => {
      setTypingUsers(users.filter(u => u.isTyping && u.id !== currentUser.id));
    });
    return () => unsubscribe();
  }, [roomId, currentUser.id]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, typingUsers]);

  const handleTyping = (text: string) => {
    setInputText(text);
    UserService.setTypingStatus(roomId, currentUser.id, text.length > 0);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    await ChatService.sendMessage(roomId, {
      userId: currentUser.id,
      userName: currentUser.name,
      text: inputText.trim(),
    });
    setInputText('');
    UserService.setTypingStatus(roomId, currentUser.id, false);
  };

  const sendReaction = (emoji: string) => {
    ReactionService.sendReaction(roomId, emoji, currentUser.id);
  };

  return (
    <div className="flex flex-col h-full glass-card overflow-hidden border-none shadow-none rounded-none md:rounded-[2.5rem]">
      {/* Chat Header */}
      <div className="p-8 border-b border-[var(--glass-border)] flex items-center justify-between bg-brand-500/5">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-brand-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-brand-500/20">
            <Send size={24} />
          </div>
          <div>
            <h3 className="text-xl font-black text-[var(--text-primary)]">الدردشة المباشرة</h3>
            <p className="text-sm text-[var(--text-secondary)] font-bold">تفاعل مع أصدقائك</p>
          </div>
        </div>
        <div className="flex gap-3 flex-row-reverse">
          {['🔥', '❤️', '😂', '😮'].map(emoji => (
            <button
              key={emoji}
              onClick={() => sendReaction(emoji)}
              className="w-10 h-10 flex items-center justify-center bg-[var(--input-bg)] hover:bg-[var(--glass-border)] rounded-xl transition-all hover:scale-125 active:scale-90 border border-[var(--glass-border)]"
            >
              <span className="text-xl">{emoji}</span>
            </button>
          ))}
        </div>
      </div>

      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar"
      >
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id || msg.timestamp}
              initial={{ opacity: 0, x: msg.userId === currentUser.id ? -20 : 20 }}
              animate={{ opacity: 1, x: 0 }}
              className={`flex flex-col ${msg.userId === currentUser.id ? 'items-start' : 'items-end'}`}
            >
              <div className="flex items-center gap-3 mb-2">
                {msg.userId !== currentUser.id && (
                  <span className="text-xs font-black text-[var(--text-secondary)] uppercase tracking-wider">{msg.userName}</span>
                )}
              </div>
              <div
                className={`max-w-[85%] p-5 rounded-[1.5rem] text-base font-medium shadow-sm ${
                  msg.userId === currentUser.id
                    ? 'bg-brand-500 text-white rounded-tl-none'
                    : 'bg-[var(--input-bg)] text-[var(--text-primary)] border border-[var(--glass-border)] rounded-tr-none'
                }`}
              >
                {msg.text}
              </div>
              <span className="text-[10px] text-[var(--text-secondary)] mt-2 font-bold opacity-50">
                {new Date(msg.timestamp).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </motion.div>
          ))}
          {typingUsers.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 text-[var(--text-secondary)] text-xs font-bold bg-[var(--input-bg)] px-4 py-2 rounded-full border border-[var(--glass-border)] w-fit"
            >
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-brand-500 rounded-full animate-bounce" />
                <span className="w-1.5 h-1.5 bg-brand-500 rounded-full animate-bounce [animation-delay:0.2s]" />
                <span className="w-1.5 h-1.5 bg-brand-500 rounded-full animate-bounce [animation-delay:0.4s]" />
              </div>
              <span>{typingUsers.length === 1 ? `${typingUsers[0].name} يكتب...` : 'عدة أشخاص يكتبون...'}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="p-8 border-t border-[var(--glass-border)] bg-[var(--bg-secondary)]/50">
        <form
          onSubmit={handleSend}
          className="relative flex items-center gap-4"
        >
          <input
            type="text"
            value={inputText}
            onChange={(e) => handleTyping(e.target.value)}
            onBlur={() => UserService.setTypingStatus(roomId, currentUser.id, false)}
            placeholder="اكتب رسالتك هنا..."
            className="flex-1 glass-input h-16 text-base pr-6 pl-16"
          />
          <button
            type="submit"
            disabled={!inputText.trim()}
            className="absolute left-3 p-3 bg-brand-500 text-white rounded-xl hover:bg-brand-400 transition-all disabled:opacity-50 disabled:hover:bg-brand-500 shadow-lg shadow-brand-500/20"
          >
            <Send size={24} />
          </button>
        </form>
      </div>
    </div>
  );
};
