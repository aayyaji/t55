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
    <div className="flex flex-col h-full glass-card overflow-hidden">
      <div className="p-4 border-b border-[var(--glass-border)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-display font-semibold text-[var(--text-primary)]">الدردشة المباشرة</h3>
          <span className="text-xs">🇮🇶</span>
        </div>
        <div className="flex gap-2 flex-row-reverse">
          {['🔥', '❤️', '😂', '😮'].map(emoji => (
            <button
              key={emoji}
              onClick={() => sendReaction(emoji)}
              className="hover:scale-125 transition-transform cursor-pointer"
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide"
      >
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id || msg.timestamp}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex flex-col ${msg.userId === currentUser.id ? 'items-start' : 'items-end'}`}
            >
              <span className="text-[10px] text-[var(--text-secondary)] mb-1 px-1">{msg.userName}</span>
              <div className={`px-4 py-2 rounded-2xl max-w-[80%] text-sm ${
                msg.userId === currentUser.id 
                  ? 'bg-brand-600 text-white rounded-tl-none' 
                  : 'bg-[var(--input-bg)] text-[var(--text-primary)] rounded-tr-none border border-[var(--glass-border)]'
              }`}>
                {msg.text}
              </div>
            </motion.div>
          ))}
          {typingUsers.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-end"
            >
              <div className="bg-[var(--input-bg)] text-[var(--text-secondary)] px-4 py-2 rounded-2xl rounded-tr-none text-[10px] italic flex items-center gap-2 border border-[var(--glass-border)]">
                <span className="flex gap-1">
                  <span className="w-1 h-1 bg-[var(--text-secondary)] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1 h-1 bg-[var(--text-secondary)] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1 h-1 bg-[var(--text-secondary)] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </span>
                {typingUsers.length === 1 ? `${typingUsers[0].name} يكتب...` : 'عدة أشخاص يكتبون...'}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <form onSubmit={handleSend} className="p-4 bg-[var(--input-bg)] border-t border-[var(--glass-border)]">
        <div className="relative">
          <input
            type="text"
            value={inputText}
            onChange={(e) => handleTyping(e.target.value)}
            onBlur={() => UserService.setTypingStatus(roomId, currentUser.id, false)}
            placeholder="اكتب شيئاً..."
            className="w-full bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-full py-3 pr-5 pl-12 text-sm focus:ring-2 focus:ring-brand-500 transition-all outline-none text-right text-[var(--text-primary)]"
            dir="rtl"
          />
          <button
            type="submit"
            className="absolute left-2 top-1/2 -translate-y-1/2 p-2 text-brand-400 hover:text-brand-300 transition-colors"
          >
            <Send size={18} className="rotate-180" />
          </button>
        </div>
      </form>
    </div>
  );
};
