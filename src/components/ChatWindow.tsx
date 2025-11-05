import React, { useRef, useEffect, useState } from "react";
import { DotsVerticalIcon, FaceIcon, PaperPlaneIcon, Cross2Icon } from '@radix-ui/react-icons';
import { FaPaperclip, FaChevronLeft, FaImage, FaFile } from 'react-icons/fa';
import EmojiPicker, { Theme } from 'emoji-picker-react';
import { useMessaging } from '../hooks/useMessaging';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { formatTimestamp } from '../utils/formatter';

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
    <div className="w-full h-full text-black bg-white flex flex-col">
      <div className="px-6 py-4 bg-vibrant-blue flex items-center gap-4 shrink-0 border-b-4 border-black">
        {isMobile && (
          <button
              onClick={handleBackToChatList}
              className="p-3 rounded-full flex justify-center items-center cursor-pointer bg-white hover:bg-vibrant-yellow transition-colors border-4 border-black"
            >
              <FaChevronLeft className="w-5 h-5 text-black" />
            </button>
        )}
        <div className="h-12 w-12 rounded-full bg-vibrant-purple flex items-center justify-center border-4 border-black">
          <span className="text-lg font-black text-black">{contactName.slice(0, 1).toUpperCase()}</span>
        </div>
        <div className="flex-1">
          <div className="font-black text-black text-lg">{contactName}</div>
          <div className="text-sm text-black/70 font-bold">
            {currentChannel ? `${currentChannel.messages_count} messages` : 'Loading...'}
          </div>
        </div>
        <div className="flex gap-2">
          {/*
          <button className="p-2 rounded-full cursor-pointer bg-white hover:bg-vibrant-yellow transition-colors border-4 border-black">
            <FaPhone className="w-4 h-4 text-black" />
          </button>
          <button className="p-2 rounded-full cursor-pointer bg-white hover:bg-vibrant-yellow transition-colors border-4 border-black">
            <FaVideo className="w-4 h-4 text-black" />
          </button>
          */}
          <button className="p-3 rounded-full cursor-pointer bg-white hover:bg-vibrant-yellow transition-colors border-4 border-black">
            <DotsVerticalIcon className="w-5 h-5 text-black" />
          </button>
        </div>
      </div>
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 bg-vibrant-mint/30"
        >
        {hasMoreMessages && (
          <div className="text-center mb-4">
            <button
              onClick={handleLoadMore}
              disabled={isFetchingMessages}
              className="px-6 py-3 bg-vibrant-purple hover:bg-vibrant-pink text-black text-sm font-black rounded-full disabled:opacity-50 disabled:cursor-not-allowed border-4 border-black"
            >
              {isFetchingMessages ? 'LOADING...' : 'LOAD MORE'}
            </button>
          </div>
        )}

        <div className="mx-auto max-w-4xl space-y-4">
          {resolvedMessages.length === 0 && !isFetchingMessages ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-vibrant-yellow rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-black">
                <span className="text-3xl">💬</span>
              </div>
              <p className="text-black text-lg font-black italic">NO MESSAGES YET</p>
              <p className="text-black/70 text-sm font-bold mt-2">Start the conversation!</p>
            </div>
          ) : (
            resolvedMessages.map((m) => (
              <div key={m.id} className={`flex ${m.fromMe ? "justify-end" : "justify-start"}`}>
                <div
                  className={`${m.fromMe 
                    ? "bg-vibrant-purple text-black border-4 border-black" 
                    : "bg-white text-black border-4 border-black"
                  } rounded-[2rem] px-5 py-3 max-w-[70%] text-sm shadow-lg`}
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
                    <div className="font-bold">{m.text}</div>
                  )}
                  
                  <div className={`text-xs mt-1 font-bold ${m.fromMe ? "text-black/70" : "text-black/60"}`}>{m.time}</div>
                  {m.fromMe && (
                    <div className="flex justify-end mt-1">
                      <span className="text-xs text-black/70 font-black">✓✓</span>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        <div ref={messagesEndRef} />

        {isFetchingMessages && resolvedMessages.length === 0 && (
          <div className="text-center py-12">
            <div className="w-12 h-12 border-4 border-vibrant-purple border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-black text-base font-black italic">LOADING...</p>
          </div>
        )}
      </div>
      
      {selectedFiles.length > 0 && (
        <div className="px-4 py-3 bg-vibrant-yellow border-t-4 border-black">
          <div className="flex flex-wrap gap-2">
            {selectedFiles.map((file, index) => (
              <div key={index} className="flex items-center gap-2 bg-white rounded-full p-3 text-sm border-4 border-black">
                {file.type.startsWith('image/') ? (
                  <FaImage className="text-vibrant-purple" />
                ) : (
                  <FaFile className="text-black" />
                )}
                <span className="text-black truncate max-w-32 font-bold">{file.name}</span>
                <span className="text-black/70 text-xs font-bold">({formatFileSize(file.size)})</span>
                <button
                  onClick={() => removeFile(index)}
                  className="bg-vibrant-orange hover:bg-vibrant-pink text-black transition-colors rounded-full w-6 h-6 flex items-center justify-center border-2 border-black cursor-pointer font-black"
                >
                  <Cross2Icon className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      
      <div className="px-4 py-4 bg-vibrant-blue flex items-center gap-3 shrink-0 border-t-4 border-black">
        <button onClick={() => setShowEmojiPicker(!showEmojiPicker)} className="p-3 rounded-full cursor-pointer bg-white hover:bg-vibrant-yellow transition-colors border-4 border-black">
          <FaceIcon className="w-5 h-5 text-black" />
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
          className="p-3 rounded-full cursor-pointer bg-white hover:bg-vibrant-yellow transition-colors border-4 border-black"
          onClick={() => fileInputRef.current?.click()}
        >
          <FaPaperclip className="w-5 h-5 text-black" />
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
            className="flex-1 rounded-full titillium-web-bold bg-white text-black placeholder-black/60 px-5 py-3 outline-none border-4 border-black focus:bg-vibrant-mint transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button 
            type="submit"
            disabled={(!messageText.trim() && selectedFiles.length === 0) || isSendingMessage || !isReady}
            className="p-4 cursor-pointer rounded-full bg-vibrant-purple hover:bg-vibrant-pink transition-colors disabled:opacity-50 disabled:cursor-not-allowed border-4 border-black"
          >
            <PaperPlaneIcon className="w-5 h-5 text-black" />
          </button>
        </form>
      </div>

      {channelError && (
        <div className="px-4 py-3 bg-vibrant-yellow border-t-4 border-black">
          <p className="text-black text-sm font-bold">Error: {channelError}</p>
        </div>
      )}
    </div>
  );
}

export default ChatWindow;
