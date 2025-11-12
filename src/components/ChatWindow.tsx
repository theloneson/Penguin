import React, { useRef, useEffect, useState } from "react";
import { DotsVerticalIcon, FaceIcon, PaperPlaneIcon, Cross2Icon } from '@radix-ui/react-icons';
import { FaPaperclip, FaChevronLeft, FaImage, FaFile } from 'react-icons/fa';
import EmojiPicker, { Theme } from 'emoji-picker-react';
import { useMessaging } from '../hooks/useMessaging';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { formatTimestamp } from '../utils/formatter';

// --- (NEW) IMPORT YOUR BACKGROUND IMAGE ---
// --- Make sure to update this path to where you saved the image! ---
import bgImg from '../assets/bg-img.png'; 

export function ChatWindow({
  channelId,
  isMobile,
  handleBackToChatList,
}: {
  channelId: string;
  isMobile: boolean;
  handleBackToChatList?: () => void;
}) {
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
  //const [attachmentErrors, setAttachmentErrors] = useState<{ [key: string]: string }>({});
  //const [globalError, setGlobalError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  const ALLOWED_FILE_TYPES = [
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf', 'text/plain', 'application/msword', 
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
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
      
      // create preview URLs for images
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
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    
    // clean up preview URL if it's an image
    if (filePreviewUrls[index]) {
      URL.revokeObjectURL(filePreviewUrls[index]);
      setFilePreviewUrls(prev => prev.filter((_, i) => i !== index));
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  useEffect(() => {
    if (isReady && channelId) {
      getChannelById(channelId).then(() => {
        fetchMessages(channelId);
      });

      // Auto-refresh messages every 10 seconds
      const interval = setInterval(() => {
        fetchMessages(channelId);
      }, 10000);

      return () => clearInterval(interval);
    }
  }, [isReady, channelId, getChannelById, fetchMessages]);

  useEffect(() => {
    if (!isLoadingOlderRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    isLoadingOlderRef.current = false;
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
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
    const resolveMessages = async () => {
      try {
        const resolved = await Promise.all(
          messages.map(async (message, index) => {
            const attachments: any = []
            /**await Promise.all(
              (message.attachments || []).map(async (attachment, attIndex) => {
                try {
                  const data = attachment.data instanceof Promise ? await attachment.data : attachment.data || '';
                  return {
                    name: attachment.fileName || 'Unknown File',
                    type: attachment.mimeType || 'application/octet-stream',
                    size: typeof attachment.fileSize === 'number' ? attachment.fileSize : 0,
                    data,
                  };
                } catch (err) {
                  const errorMsg = err instanceof Error ? err.message.includes('502') ? 'Aggregator unavailable (502 Bad Gateway)' : err.message : 'Failed to fetch attachment';
                  setAttachmentErrors(prev => ({
                    ...prev,
                    [`${message.createdAtMs}-${index}-${attIndex}`]: errorMsg,
                  }));
                  return {
                    name: attachment.fileName || 'Unknown File',
                    type: attachment.mimeType || 'application/octet-stream',
                    size: typeof attachment.fileSize === 'number' ? attachment.fileSize : 0,
                    data: '',
                  };
                }
              })
            );*/
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
        setResolvedMessages([]); // Fallback to empty array to prevent crash
        //setAttachmentErrors(prev => ({
          //...prev,
          //global: 'Chat failed to load due to server error. Please try again.',
        //}));
      }
    };
    resolveMessages();
  }, [messages, currentAccount]);


  const handleLoadMore = () => {
    if (messagesCursor && !isFetchingMessages) {
      isLoadingOlderRef.current = true;
      fetchMessages(channelId, messagesCursor);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e);
    }
  };

  const contactName = currentChannel 
    ? `${currentChannel.id.id.slice(0, 5)}...${currentChannel.id.id.slice(-5)}`
    : 'Unknown Chat';

  return (
    // --- (CHANGED) Main container: light background, dark text ---
    <div className="w-full h-full text-gray-800 bg-gray-50 flex flex-col">
      {/* --- (CHANGED) Header: white background, light border --- */}
      <div className="px-6 py-4 bg-white flex items-center gap-4 shrink-0 border-b border-gray-200">
        {isMobile && (
          // --- (CHANGED) Mobile back button: light bg, purple hover ---
          <button
            onClick={handleBackToChatList}
            className="p-2 rounded-full flex justify-center items-center cursor-pointer bg-gray-100 hover:bg-purple-100 transition-colors"
          >
            {/* --- (CHANGED) Mobile back icon: darker color --- */}
            <FaChevronLeft className="w-4 h-4 text-gray-500" />
          </button>
        )}
        {/* --- (CHANGED) Avatar placeholder: purple theme --- */}
        <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center border border-purple-200">
          {/* --- (CHANGED) Avatar text: purple theme --- */}
          <span className="text-sm font-medium text-purple-600">{contactName.slice(0, 1).toUpperCase()}</span>
        </div>
        <div className="flex-1">
          {/* --- (CHANGED) Contact name: dark text --- */}
          <div className="font-semibold text-gray-900">{contactName}</div>
          {/* --- (CHANGED) Contact status: medium gray text --- */}
          <div className="text-xs text-gray-500">
            {currentChannel ? `${currentChannel.messages_count} messages` : 'Loading...'}
          </div>
        </div>
        <div className="flex gap-2">
          {/*
          <button className="p-2 rounded-full cursor-pointer bg-gray-800/50 hover:bg-indigo-500/20 transition-colors">
            <FaPhone className="w-4 h-4 text-gray-400" />
          </button>
          <button className="p-2 rounded-full cursor-pointer bg-gray-800/50 hover:bg-indigo-500/20 transition-colors">
            <FaVideo className="w-4 h-4 text-gray-400" />
          </button>
          */}
          {/* --- (CHANGED) Header button: light bg, purple hover --- */}
          <button className="p-2 rounded-full cursor-pointer bg-gray-100 hover:bg-purple-100 transition-colors">
            {/* --- (CHANGED) Header icon: darker color --- */}
            <DotsVerticalIcon className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </div>
      <div
        ref={scrollRef}
        // --- (CHANGED) Chat Area: Removed bg-gray-900, using new background image style ---
        className="flex-1 overflow-y-auto p-6"
        style={{
          // --- (NEW) Using your imported background image ---
          backgroundImage: `url(${bgImg})`,
          backgroundRepeat: 'repeat',
          backgroundSize: 'auto', // 'auto' is good for tiling patterns
        }}
      >
        {hasMoreMessages && (
          <div className="text-center mb-4">
            {/* --- (CHANGED) Load More button: light theme, purple text --- */}
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
            <div className="text-center py-8">
              {/* --- (CHANGED) "No messages" icon bg --- */}
              <div className="w-12 h-12 bg-gray-100/80 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-lg text-gray-400">💬</span>
              </div>
              {/* --- (CHANGED) "No messages" text color --- */}
              <p className="text-gray-500 text-sm">No messages yet. Start the conversation!</p>
            </div>
          ) : (
            resolvedMessages.map((m) => (
              <div key={m.id} className={`flex ${m.fromMe ? "justify-end" : "justify-start"}`}>
                <div
                  // --- (CHANGED) Message Bubbles: Purple for 'me', White for 'other' ---
                  className={`${m.fromMe 
                    ? "bg-purple-500 text-white" 
                    : "bg-white text-gray-800"
                  } rounded-2xl px-4 py-3 max-w-[70%] text-sm shadow-md`} // Added shadow-md
                >

                  {/**{m.attachments && m.attachments.length > 0 && (
                    <div className="mb-2 space-y-2">
                      {m.attachments.map((attachment: any, index: number) => {
                        const errorKey = `${m.id}-${index}`;
                        const hasError = attachmentErrors[errorKey];
                        return (
                          <div key={index} className="bg-black/20 rounded-lg p-2">
                            {hasError ? (
                              <div className="flex items-center gap-2 text-xs text-red-400">
                                <FaFile className="text-red-400" />
                                <span className="truncate">{attachment.name}</span>
                                <span>({hasError})</span>
                              </div>
                            ) : attachment.type?.startsWith('image/') && attachment.data ? (
                              <a
                                href={`data:${attachment.type};base64,${attachment.data}`}
                                download={attachment.name}
                                className="inline-block"
                              >
                                <img 
                                  src={`data:${attachment.type};base64,${attachment.data}`}
                                  alt={attachment.name}
                                  className="max-w-full max-h-48 rounded-lg object-contain cursor-pointer"
                                  onError={() => setAttachmentErrors(prev => ({
                                    ...prev,
                                    [errorKey]: 'Image failed to load',
                                  }))}
                                />
                              </a>
                            ) : (
                              <a
                                href={attachment.data ? `data:${attachment.type};base64,${attachment.data}` : '#'}
                                download={attachment.name}
                                className="flex items-center gap-2 text-xs text-gray-400 hover:text-indigo-400 transition-colors"
                              >
                                <FaFile className="text-gray-400" />
                                <span className="truncate">{attachment.name}</span>
                                <span className="text-gray-500">({formatFileSize(attachment.size)})</span>
                              </a>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}*/}
                  
                  {m.text && (
                    <div className="font-medium">{m.text}</div>
                  )}
                  
                  {/* --- (CHANGED) Timestamp colors for new bubbles --- */}
                  <div className={`text-xs mt-1 ${m.fromMe ? "text-purple-100" : "text-gray-500"}`}>{m.time}</div>
                  {m.fromMe && (
                    <div className="flex justify-end mt-1">
                      {/* --- (CHANGED) Read receipt color for purple bubble --- */}
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
            {/* --- (CHANGED) Loading spinner color --- */}
            <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            {/* --- (CHANGED) Loading text color --- */}
            <p className="text-gray-500 text-sm">Loading messages...</p>
          </div>
        )}
      </div>
      
      {selectedFiles.length > 0 && (
        // --- (CHANGED) File preview bar: light theme ---
        <div className="px-4 py-2 bg-gray-100 border-t border-gray-200">
          <div className="flex flex-wrap gap-2">
            {selectedFiles.map((file, index) => (
              // --- (CHANGED) File preview item: light theme ---
              <div key={index} className="flex items-center gap-2 bg-white rounded-lg p-2 text-sm border border-gray-200 shadow-sm">
                {file.type.startsWith('image/') ? (
                  // --- (CHANGED) Image icon color ---
                  <FaImage className="text-purple-500" />
                ) : (
                  // --- (CHANGED) File icon color ---
                  <FaFile className="text-gray-500" />
                )}
                {/* --- (CHANGED) File name text color --- */}
                <span className="text-gray-800 truncate max-w-32">{file.name}</span>
                {/* --- (CHANGED) File size text color --- */}
                <span className="text-gray-500 text-xs">({formatFileSize(file.size)})</span>
                <button
                  onClick={() => removeFile(index)}
                  // --- (CHANGED) Remove file button: light theme, red hover ---
                  className="bg-gray-200 text-gray-500 hover:text-red-500 transition-colors rounded-full p-1 cursor-pointer"
                >
                  <Cross2Icon className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* --- (CHANGED) Input bar container: light theme --- */}
      <div className="px-4 py-4 bg-gray-100 flex items-center gap-3 shrink-0 border-t border-gray-200">
        {/* --- (CHANGED) Input buttons: light theme, purple hover --- */}
        <button onClick={() => setShowEmojiPicker(!showEmojiPicker)} className="p-2 rounded-full cursor-pointer bg-white hover:bg-purple-100 transition-colors">
          {/* --- (CHANGED) Input icon color --- */}
          <FaceIcon className="w-4 h-4 text-gray-500" />
        </button>
        {showEmojiPicker && (
          <div className="absolute bottom-20 left-0 z-10">
            <EmojiPicker
              onEmojiClick={(emojiObject) => {
                setMessageText(prev => prev + emojiObject.emoji);
                setShowEmojiPicker(false);
              }}
              // --- (CHANGED) Emoji picker theme ---
              theme={Theme.LIGHT}
              skinTonesDisabled
              width={window.innerWidth}
            />
          </div>
        )}
        <button 
          // --- (CHANGED) Input buttons: light theme, purple hover ---
          className="p-2 rounded-full cursor-pointer bg-white hover:bg-purple-100 transition-colors"
          onClick={() => fileInputRef.current?.click()}
        >
          {/* --- (CHANGED) Input icon color --- */}
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
            // --- (CHANGED) Message input field: light theme, purple focus ---
            className="flex-1 rounded-full titillium-web-bold bg-white text-gray-800 placeholder-gray-500 px-4 py-3 outline-none border border-gray-300 focus:border-purple-400 focus:bg-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button 
            type="submit"
            disabled={(!messageText.trim() && selectedFiles.length === 0) || isSendingMessage || !isReady}
            // --- (CHANGED) Send button: purple theme ---
            className="p-3 cursor-pointer rounded-full bg-purple-500 hover:bg-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <PaperPlaneIcon className="w-4 h-4 text-white" />
          </button>
        </form>
      </div>

      {channelError && (
        // --- (CHANGED) Error bar: light theme ---
        <div className="px-4 py-2 bg-red-50 border-t border-red-200">
          {/* --- (CHANGED) Error text: dark red --- */}
          <p className="text-red-600 text-sm">Error: {channelError}</p>
        </div>
      )}
    </div>
  );
}

export default ChatWindow;