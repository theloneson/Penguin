import React, { useRef, useEffect, useState } from "react";
import { DotsVerticalIcon, FaceIcon, PaperPlaneIcon, Cross2Icon } from '@radix-ui/react-icons';
import { FaPaperclip, FaChevronLeft, FaImage, FaFile } from 'react-icons/fa';
import EmojiPicker, { Theme } from 'emoji-picker-react';
import { useMessaging } from '../hooks/useMessaging';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { formatTimestamp } from '../utils/formatter';

// --- Make sure to update this path to where you saved the image! ---
import bgImg from '../assets/bg-img.png'; 

// --- This is the new "Pick a conversation" image I just generated for you ---
import convoImg from '../assets/convo.png'; 

export function ChatWindow({
  channelId,
  isMobile,
  handleBackToChatList,
}: {
  channelId: string;
  isMobile: boolean;
  handleBackToChatList?: () => void;
}) {
  // ... (ALL YOUR COLLEAGUE'S LOGIC REMAINS UNCHANGED) ...
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isLoadingOlderRef = useRef(false);
  
  const currentAccount = useCurrentAccount();
  const {
    currentChannel,
    messages,
    getChannelById,
    fetchMessages,
    sendMessage,
    isFetchingMessages,
    isSendingMessage,
    messagesCursor,
    hasMoreMessages,
    channelError,
    isReady,
  } = useMessaging();


  const [messageText, setMessageText] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [filePreviewUrls, setFilePreviewUrls] = useState<string[]>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [resolvedMessages, setResolvedMessages] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ... (ALL FUNCTIONS LIKE handleFileSelect, removeFile, etc. ARE UNCHANGED) ...
  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  const ALLOWED_FILE_TYPES = [
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf', 'text/plain', 'application/msword', 
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    // ... (LOGIC UNCHANGED) ...
    const files = Array.from(event.target.files || []);
    const validFiles: File[] = [];
    const errors: string[] = [];
    files.forEach(file => {
      if (file.size > MAX_FILE_SIZE) {
        errors.push(`${file.name} is too large (max 5MB)`);
        return;
      }
      if (!ALLOWED_FILE_TYPES.includes(file.type)) {
        errors.push(`${file.name} is not a supported file type`);
        return;
      }
      validFiles.push(file);
    });
    if (errors.length > 0) {
      alert(errors.join('\n'));
    }
    if (validFiles.length > 0) {
      setSelectedFiles(prev => [...prev, ...validFiles]);
      validFiles.forEach(file => {
        if (file.type.startsWith('image/')) {
          const url = URL.createObjectURL(file);
          setFilePreviewUrls(prev => [...prev, url]);
        }
      });
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (index: number) => {
    // ... (LOGIC UNCHANGED) ...
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    if (filePreviewUrls[index]) {
      URL.revokeObjectURL(filePreviewUrls[index]);
      setFilePreviewUrls(prev => prev.filter((_, i) => i !== index));
    }
  };

  const formatFileSize = (bytes: number) => {
    // ... (LOGIC UNCHANGED) ...
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  useEffect(() => {
    // ... (LOGIC UNCHANGED) ...
    if (isReady && channelId) { // This "if (channelId)" is key
      getChannelById(channelId).then(() => {
        fetchMessages(channelId);
      });
      const interval = setInterval(() => {
        fetchMessages(channelId);
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [isReady, channelId, getChannelById, fetchMessages]);

  useEffect(() => {
    // ... (LOGIC UNCHANGED) ...
    if (!isLoadingOlderRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    isLoadingOlderRef.current = false;
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    // ... (LOGIC UNCHANGED) ...
    e.preventDefault();
    if ((!messageText.trim() && selectedFiles.length === 0) || isSendingMessage) {
      return;
    }
    const result = await sendMessage(channelId, messageText, selectedFiles.length > 0 ? selectedFiles : undefined);
    if (result) {
      setMessageText('');
      selectedFiles.forEach((_, index) => {
        if (filePreviewUrls[index]) {
          URL.revokeObjectURL(filePreviewUrls[index]);
        }
      });
      setSelectedFiles([]);
      setFilePreviewUrls([]);
    }
  };

  useEffect(() => {
    // ... (LOGIC UNCHANGED) ...
    if (!channelId) return; // Don't resolve messages if no chat is selected
    const resolveMessages = async () => {
      try {
        const resolved = await Promise.all(
          messages.map(async (message, index) => {
            const attachments: any = []
            // ... (COMMENTED LOGIC UNCHANGED) ...
            return {
              id: `${message.createdAtMs}-${index}`,
              text: message.text,
              time: formatTimestamp(message.createdAtMs),
              fromMe: message.sender === currentAccount?.address,
              attachments,
            };
          })
        );
        setResolvedMessages(resolved);
      } catch (err) {
        console.error('Failed to resolve messages:', err);
        setResolvedMessages([]); 
        // ... (COMMENTED LOGIC UNCHANGED) ...
      }
    };
    resolveMessages();
  }, [messages, currentAccount, channelId]); // Added channelId dependency


  const handleLoadMore = () => {
    // ... (LOGIC UNCHANGED) ...
    if (messagesCursor && !isFetchingMessages) {
      isLoadingOlderRef.current = true;
      fetchMessages(channelId, messagesCursor);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // ... (LOGIC UNCHANGED) ...
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e);
    }
  };

  const contactName = currentChannel 
    ? `${currentChannel.id.id.slice(0, 5)}...${currentChannel.id.id.slice(-5)}`
    : 'Unknown Chat';
  // ... (ALL LOGIC ABOVE IS UNTOUCHED) ...


  // --- (NEW) CONDITIONAL RENDER ---
  // If no channelId is provided (i.e., it's ""), show the welcome screen.
  if (!channelId) {
    return (
      <div 
        className="w-full h-full flex items-center justify-center p-4"
        style={{
          backgroundImage: `url(${bgImg})`, // Use the same main background
          backgroundSize: 'cover',
          backgroundPosition: 'center center',
          backgroundRepeat: 'no-repeat',
        }}
      >
        {/* The image I just generated with "Pick a conversation..." text */}
        <img 
          src={convoImg} 
          alt="Pick a conversation" 
          className="w-auto h-auto max-w-md object-contain" // Centered image
        />
      </div>
    );
  }

  // --- (EXISTING) If channelId IS provided, render the full chat window ---
  return (
    <div className="w-full h-full text-gray-800 bg-gray-50 flex flex-col">
      {/* --- This is the "Actual ChatWindow" --- */}
      <div className="px-6 py-4 bg-white flex items-center gap-4 shrink-0 border-b border-gray-200">
        {isMobile && (
          <button
            onClick={handleBackToChatList}
            className="p-2 rounded-full flex justify-center items-center cursor-pointer bg-gray-100 hover:bg-purple-100 transition-colors"
          >
            <FaChevronLeft className="w-4 h-4 text-gray-500" />
          </button>
        )}
        <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center border border-purple-200">
          <span className="text-sm font-medium text-purple-600">{contactName.slice(0, 1).toUpperCase()}</span>
        </div>
        <div className="flex-1">
          <div className="font-semibold text-gray-900">{contactName}</div>
          <div className="text-xs text-gray-500">
            {currentChannel ? `${currentChannel.messages_count} messages` : 'Loading...'}
          </div>
        </div>
        <div className="flex gap-2">
          {/* ... (COMMENTED BUTTONS UNCHANGED) ... */}
          <button className="p-2 rounded-full cursor-pointer bg-gray-100 hover:bg-purple-100 transition-colors">
            <DotsVerticalIcon className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </div>
      
      {/* --- Chat Area --- */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6"
        style={{
          backgroundImage: `url(${bgImg})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center center',
          backgroundRepeat: 'no-repeat',
        }}
      >
        {hasMoreMessages && (
          <div className="text-center mb-4">
            <button
              onClick={handleLoadMore}
              disabled={isFetchingMessages}
              className="px-4 py-2 bg-white shadow-sm hover:bg-gray-100 text-purple-600 text-sm font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isFetchingMessages ? 'Loading...' : 'Load older messages'}
            </button>
          </div>
        )}

        <div className="mx-auto max-w-4xl space-y-4">
          {resolvedMessages.length === 0 && !isFetchingMessages ? (
            // --- (CHANGED) Reverted to the original "No messages" icon ---
            <div className="text-center py-8">
              <div className="w-12 h-12 bg-gray-100/80 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-lg text-gray-400">💬</span>
              </div>
              <p className="text-gray-500 text-sm">No messages yet. Start the conversation!</p>
            </div>
          ) : (
            resolvedMessages.map((m) => (
              <div key={m.id} className={`flex ${m.fromMe ? "justify-end" : "justify-start"}`}>
                <div
                  className={`${m.fromMe 
                    ? "bg-purple-500 text-white" 
                    : "bg-white text-gray-800"
                  } rounded-2xl px-4 py-3 max-w-[70%] text-sm shadow-md`}
                >
                  {/* ... (COMMENTED ATTACHMENTS UNCHANGED) ... */}
                  
                  {m.text && (
                    <div className="font-medium">{m.text}</div>
                  )}
                  
                  <div className={`text-xs mt-1 ${m.fromMe ? "text-purple-100" : "text-gray-500"}`}>{m.time}</div>
                  {m.fromMe && (
                    <div className="flex justify-end mt-1">
                      <span className="text-xs text-purple-200">✓✓</span>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        <div ref={messagesEndRef} />

        {isFetchingMessages && resolvedMessages.length === 0 && (
          <div className="text-center py-8">
            <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-500 text-sm">Loading messages...</p>
          </div>
        )}
      </div>
      
      {/* ... (File Preview and Input Bar are unchanged) ... */}
      {selectedFiles.length > 0 && (
        <div className="px-4 py-2 bg-gray-100 border-t border-gray-200">
          <div className="flex flex-wrap gap-2">
            {selectedFiles.map((file, index) => (
              <div key={index} className="flex items-center gap-2 bg-white rounded-lg p-2 text-sm border border-gray-200 shadow-sm">
                {file.type.startsWith('image/') ? (
                  <FaImage className="text-purple-500" />
                ) : (
                  <FaFile className="text-gray-500" />
                )}
                <span className="text-gray-800 truncate max-w-32">{file.name}</span>
                <span className="text-gray-500 text-xs">({formatFileSize(file.size)})</span>
                <button
                  onClick={() => removeFile(index)}
                  className="bg-gray-200 text-gray-500 hover:text-red-500 transition-colors rounded-full p-1 cursor-pointer"
                >
                  <Cross2Icon className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      
      <div className="px-4 py-4 bg-gray-100 flex items-center gap-3 shrink-0 border-t border-gray-200">
        <button onClick={() => setShowEmojiPicker(!showEmojiPicker)} className="p-2 rounded-full cursor-pointer bg-white hover:bg-purple-100 transition-colors">
          <FaceIcon className="w-4 h-4 text-gray-500" />
        </button>
        {showEmojiPicker && (
          <div className="absolute bottom-20 left-0 z-10">
            <EmojiPicker
              onEmojiClick={(emojiObject) => {
                setMessageText(prev => prev + emojiObject.emoji);
                setShowEmojiPicker(false);
              }}
              theme={Theme.LIGHT}
              skinTonesDisabled
              width={window.innerWidth}
            />
          </div>
        )}
        <button 
          className="p-2 rounded-full cursor-pointer bg-white hover:bg-purple-100 transition-colors"
          onClick={() => fileInputRef.current?.click()}
        >
          <FaPaperclip className="w-4 h-4 text-gray-500" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,application/pdf,text/plain,.doc,.docx"
          onChange={handleFileSelect}
          className="hidden"
        />
        <form onSubmit={handleSendMessage} className="flex-1 flex items-center gap-3">
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a message..."
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isSendingMessage || !isReady}
            className="flex-1 rounded-full titillium-web-bold bg-white text-gray-800 placeholder-gray-500 px-4 py-3 outline-none border border-gray-300 focus:border-purple-400 focus:bg-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button 
            type="submit"
            disabled={(!messageText.trim() && selectedFiles.length === 0) || isSendingMessage || !isReady}
            className="p-3 cursor-pointer rounded-full bg-purple-500 hover:bg-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <PaperPlaneIcon className="w-4 h-4 text-white" />
          </button>
        </form>
      </div>

      {channelError && (
        <div className="px-4 py-2 bg-red-50 border-t border-red-200">
          <p className="text-red-600 text-sm">Error: {channelError}</p>
        </div>
      )}
    </div>
  );
}

export default ChatWindow;