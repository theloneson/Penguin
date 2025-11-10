import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PaperPlaneIcon, DotsHorizontalIcon } from '@radix-ui/react-icons';
import { FaUser, FaArrowLeft } from 'react-icons/fa';
import { useCurrentAccount } from "@mysten/dapp-kit";
import { useMessaging } from '../hooks/useMessaging';
import { formatTimestamp } from '../utils/formatter';

interface ChatWindowProps {
  channelId: string;
  isMobile: boolean;
  handleBackToChatList: () => void;
}

interface Message {
  id: string;
  text: string;
  sender: string;
  timestamp: number;
  status: 'sent' | 'delivered' | 'read';
}

export function ChatWindow({ channelId, isMobile, handleBackToChatList }: ChatWindowProps) {
  const currentAccount = useCurrentAccount();
  const { channels, sendMessage, isSending } = useMessaging();
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const currentChannel = channels.find(channel => channel.id.id === channelId);
  
  // Mock messages for demo - replace with actual messages from your messaging hook
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: 'Hey there! How are you doing?',
      sender: '0x1234...5678',
      timestamp: Date.now() - 3600000,
      status: 'read'
    },
    {
      id: '2', 
      text: "I'm good! Just working on the Penguin chat app. It's coming along nicely.",
      sender: currentAccount?.address || '0xabcd...efgh',
      timestamp: Date.now() - 1800000,
      status: 'read'
    },
    {
      id: '3',
      text: 'That sounds awesome! Love what you guys are building.',
      sender: '0x1234...5678', 
      timestamp: Date.now() - 600000,
      status: 'read'
    }
  ]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !currentAccount) return;

    const messageData = {
      id: Date.now().toString(),
      text: newMessage,
      sender: currentAccount.address,
      timestamp: Date.now(),
      status: 'sent' as const
    };

    setMessages(prev => [...prev, messageData]);
    setNewMessage('');

    // Send via your messaging hook
    if (sendMessage && channelId) {
      try {
        await sendMessage(channelId, newMessage);
        // Update message status to delivered when confirmed
        setMessages(prev => 
          prev.map(msg => 
            msg.id === messageData.id 
              ? { ...msg, status: 'delivered' }
              : msg
          )
        );
      } catch (error) {
        console.error('Failed to send message:', error);
      }
    }
  };

  const isOwnMessage = (sender: string) => {
    return sender === currentAccount?.address;
  };

  const getDisplayName = (address: string) => {
    return isOwnMessage(address) ? 'You' : `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  if (!currentChannel) {
    return (
      <div className="w-full h-full bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gray-200 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FaUser className="w-6 h-6 text-gray-500" />
          </div>
          <p className="text-gray-600">Chat not found</p>
        </div>
      </div>
    );
  }

  const memberCount = currentChannel.auth.member_permissions.contents.length;
  const isGroup = memberCount > 2;
  const displayName = isGroup 
    ? `Group ${currentChannel.id.id.slice(0, 5)}...${currentChannel.id.id.slice(-5)}`
    : `${currentChannel.id.id.slice(0, 5)}...${currentChannel.id.id.slice(-5)}`;

  return (
    <div className="w-full h-full bg-white flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-slate-50">
        <div className="flex items-center gap-3">
          {isMobile && (
            <button 
              onClick={handleBackToChatList}
              className="p-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors cursor-pointer"
            >
              <FaArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-sm">
            {isGroup ? (
              <FaUser className="w-5 h-5 text-white" />
            ) : (
              <FaUser className="w-5 h-5 text-white" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-gray-900 truncate">{displayName}</h2>
            <p className="text-sm text-gray-600">
              {isGroup ? `${memberCount} members` : 'Online'}
            </p>
          </div>
          <button className="p-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors cursor-pointer">
            <DotsHorizontalIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto bg-gray-50 p-4">
        <div className="space-y-4">
          <AnimatePresence>
            {messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={`flex ${isOwnMessage(message.sender) ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl ${
                  isOwnMessage(message.sender)
                    ? 'bg-blue-500 text-white rounded-br-md'
                    : 'bg-white text-gray-900 border border-gray-200 rounded-bl-md'
                } shadow-sm`}>
                  {!isOwnMessage(message.sender) && (
                    <div className="text-xs font-medium text-blue-600 mb-1">
                      {getDisplayName(message.sender)}
                    </div>
                  )}
                  <p className="text-sm break-words">{message.text}</p>
                  <div className={`flex items-center gap-2 mt-1 ${
                    isOwnMessage(message.sender) ? 'justify-end' : 'justify-start'
                  }`}>
                    <span className={`text-xs ${
                      isOwnMessage(message.sender) ? 'text-blue-200' : 'text-gray-500'
                    }`}>
                      {formatTimestamp(message.timestamp)}
                    </span>
                    {isOwnMessage(message.sender) && (
                      <span className="text-xs text-blue-200">
                        {message.status === 'sent' && '✓'}
                        {message.status === 'delivered' && '✓✓'}
                        {message.status === 'read' && '✓✓'}
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Message Input */}
      <div className="p-4 border-t border-gray-200 bg-white">
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 p-3 rounded-xl bg-gray-50 text-gray-900 placeholder-gray-500 border border-gray-200 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors outline-none"
            disabled={isSending}
          />
          <motion.button
            type="submit"
            disabled={!newMessage.trim() || isSending}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="p-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer shadow-sm"
          >
            <PaperPlaneIcon className="w-5 h-5" />
          </motion.button>
        </form>
      </div>
    </div>
  );
}

export default ChatWindow;