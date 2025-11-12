import React, { useRef, useEffect, useState, useCallback, useMemo } from "react";
import { DotsVerticalIcon, FaceIcon, PaperPlaneIcon, Cross2Icon } from '@radix-ui/react-icons';
import { FaPaperclip, FaChevronLeft, FaImage, FaFile, FaComments, FaSpinner, FaDownload, FaMicrophone, FaStop, FaPlay, FaPause, FaGift } from 'react-icons/fa';
import EmojiPicker, { Theme } from 'emoji-picker-react';
import { useMessaging } from '../hooks/useMessaging';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { formatTimestamp } from '../utils/formatter';
import bgImg from '../assets/bg-img.png';
import { useSuiClient, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';

const AudioAttachmentPlayer = ({ url, name }: { url: string; name: string }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const handleEnded = () => setIsPlaying(false);
    const handlePause = () => setIsPlaying(false);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('pause', handlePause);
    return () => {
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('pause', handlePause);
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    setIsPlaying(false);
  }, [url]);

  const togglePlayback = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      return;
    }
    audio
      .play()
      .then(() => setIsPlaying(true))
      .catch(() => {
        setIsPlaying(false);
      });
  };

  const handleContainerClick = () => {
    togglePlayback();
  };

  return (
    <div
      className="flex items-center gap-3 bg-white border border-gray-200 rounded-full px-4 py-2 shadow-sm cursor-pointer"
      role="button"
      tabIndex={0}
      onClick={handleContainerClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          togglePlayback();
        }
      }}
    >
      <button
        onClick={(event) => {
          event.stopPropagation();
          togglePlayback();
        }}
        className="h-10 w-10 flex items-center justify-center rounded-full bg-purple-500 hover:bg-purple-600 transition-colors text-white"
        aria-label={isPlaying ? 'Pause audio message' : 'Play audio message'}
        type="button"
      >
        {isPlaying ? <FaPause className="w-4 h-4" /> : <FaPlay className="w-4 h-4" />}
      </button>
      <div className="flex-1 min-w-0">
        <span className="text-xs font-semibold text-gray-800 truncate">{name}</span>
      </div>
      <audio ref={audioRef} src={url} preload="metadata" className="hidden" />
    </div>
  );
};

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
    client: messagingClient,
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
  const [isRecording, setIsRecording] = useState(false);
  type ResolvedAttachment = {
    id: string;
    name: string;
    type: string;
    size: number;
    status: 'idle' | 'loading' | 'ready' | 'error';
    url?: string;
    error?: string;
    fetchData?: () => Promise<Uint8Array<ArrayBuffer> | Uint8Array | ArrayBuffer | undefined>;
    autoLoad?: boolean;
  };

  type ResolvedMessage = {
    id: string;
    text: string;
    time: string;
    fromMe: boolean;
    attachments: ResolvedAttachment[];
  };

  type AttachmentCacheEntry = {
    status: 'idle' | 'loading' | 'ready' | 'error';
    url?: string;
    error?: string;
  };

type TokenOption = {
  coinType: string;
  symbol: string;
  decimals: number;
  balance: bigint;
};

  const [resolvedMessages, setResolvedMessages] = useState<ResolvedMessage[]>([]);
  const [attachmentErrors, setAttachmentErrors] = useState<{ [key: string]: string }>({});
  const [globalAttachmentError, setGlobalAttachmentError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isGiftModalOpen, setIsGiftModalOpen] = useState(false);
  const [selectedRecipient, setSelectedRecipient] = useState<string | null>(null);
  const [giftError, setGiftError] = useState<string | null>(null);
  const [channelMembers, setChannelMembers] = useState<string[]>([]);
  const [tokenOptions, setTokenOptions] = useState<TokenOption[]>([]);
  const [selectedTokenType, setSelectedTokenType] = useState<string | null>(null);
  const [giftAmount, setGiftAmount] = useState('');
  const [isSendingGift, setIsSendingGift] = useState(false);
  const [isLoadingTokens, setIsLoadingTokens] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachmentUrlsRef = useRef<Map<string, string>>(new Map());
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const attachmentCacheRef = useRef<Record<string, AttachmentCacheEntry>>({});
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const suiClient = useSuiClient();
  const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction();
  const SUI_TYPE = '0x2::sui::SUI';

  const parseAmountToAtomic = useCallback((value: string, decimals: number): bigint => {
    const trimmed = value.trim();
    if (!trimmed) {
      return 0n;
    }
    if (!/^\d+(\.\d+)?$/.test(trimmed)) {
      throw new Error('Enter a valid numeric amount.');
    }
    const [wholePart, fracPart = ''] = trimmed.split('.');
    if (fracPart.length > decimals) {
      throw new Error(`Amount has more than ${decimals} decimal places.`);
    }
    const whole = BigInt(wholePart || '0');
    const fraction = fracPart.padEnd(decimals, '0').slice(0, decimals);
    const fractionValue = fraction ? BigInt(fraction) : 0n;
    const multiplier = 10n ** BigInt(decimals);
    return whole * multiplier + fractionValue;
  }, []);

const formatBalance = useCallback((balance: bigint, decimals: number) => {
    const multiplier = 10n ** BigInt(decimals);
    const whole = balance / multiplier;
    const fraction = balance % multiplier;
    if (fraction === 0n) {
      return whole.toString();
    }
    const fractionStr = fraction.toString().padStart(decimals, '0').replace(/0+$/, '');
    return `${whole.toString()}.${fractionStr}`;
  }, []);

const extractSymbolFromCoinType = (coinType: string) => {
  const parts = coinType.split('::');
  return parts.length >= 3 ? parts[2] : coinType;
};

  const fetchCoinsForType = useCallback(
    async (coinType: string) => {
      if (!currentAccount?.address) {
        return [];
      }
      const owner = currentAccount.address;
      const coins: any[] = [];
      let cursor: string | null = null;
      do {
        const page = await suiClient.getCoins({
          owner,
          coinType,
          limit: 200,
          cursor,
        });
        coins.push(...page.data);
        cursor = page.hasNextPage ? page.nextCursor ?? null : null;
      } while (cursor);
      return coins;
    },
    [currentAccount?.address, suiClient],
  );

  const loadTokens = useCallback(async (): Promise<TokenOption[]> => {
    if (!currentAccount?.address) {
      return [];
    }

    const owner = currentAccount.address;
    const balances = new Map<string, bigint>();
    const metadataCache = new Map<string, { symbol: string; decimals: number }>();

    try {
      const suiBalance = await suiClient.getBalance({ owner, coinType: SUI_TYPE });
      balances.set(SUI_TYPE, BigInt(suiBalance.totalBalance));
    } catch (error) {
      console.warn('Unable to fetch SUI balance:', error);
    }

    let cursor: string | null = null;
    do {
      const page = await suiClient.getAllCoins({
        owner,
        limit: 200,
        cursor,
      });
      page.data.forEach((coin: any) => {
        if (!coin.coinType || coin.coinType === SUI_TYPE) {
          return;
        }
        const existing = balances.get(coin.coinType) ?? 0n;
        balances.set(coin.coinType, existing + BigInt(coin.balance));
      });
      cursor = page.hasNextPage ? page.nextCursor ?? null : null;
    } while (cursor);

    const options: TokenOption[] = [];
    for (const [coinType, balance] of balances.entries()) {
      if (balance <= 0n) continue;

      let symbol = 'COIN';
      let decimals = 9;

      if (coinType === SUI_TYPE) {
        symbol = 'SUI';
        decimals = 9;
      } else {
        if (!metadataCache.has(coinType)) {
          try {
            const metadata = await suiClient.getCoinMetadata({ coinType });
            metadataCache.set(coinType, {
              symbol: metadata?.symbol ?? extractSymbolFromCoinType(coinType),
              decimals: metadata?.decimals ?? decimals,
            });
          } catch (error) {
            console.warn('Unable to fetch metadata for', coinType, error);
            metadataCache.set(coinType, {
              symbol: extractSymbolFromCoinType(coinType),
              decimals,
            });
          }
        }
        const meta = metadataCache.get(coinType);
        if (meta) {
          symbol = meta.symbol;
          decimals = meta.decimals;
        }
        if (!symbol || symbol.toUpperCase() === 'COIN') {
          symbol = extractSymbolFromCoinType(coinType);
        }
      }

      options.push({
        coinType,
        symbol,
        decimals,
        balance,
      });
    }

    options.sort((a, b) => Number(b.balance - a.balance));
    return options;
  }, [SUI_TYPE, currentAccount?.address, suiClient]);

  const refreshTokens = useCallback(async (): Promise<TokenOption[]> => {
    if (!currentAccount?.address) {
      setTokenOptions([]);
      setSelectedTokenType(null);
      setGiftAmount('');
      setGiftError(null);
      setIsLoadingTokens(false);
      return [];
    }

    setIsLoadingTokens(true);
    try {
      const options = await loadTokens();
      setTokenOptions(options);
      let fallbackCoinType: string | null = null;
      if (options.length > 0) {
        fallbackCoinType = options[0].coinType;
      }
      setSelectedTokenType((prev) => {
        if (prev && options.some((option) => option.coinType === prev)) {
          return prev;
        }
        return fallbackCoinType;
      });
      if (options.length === 0) {
        setGiftAmount('');
      }
      setGiftError(null);
      return options;
    } finally {
      setIsLoadingTokens(false);
    }
  }, [currentAccount?.address, loadTokens]);

  const cleanupAttachmentCaches = useCallback((seenKeys: Set<string>) => {
    for (const [key, url] of Array.from(attachmentUrlsRef.current.entries())) {
      if (!seenKeys.has(key)) {
        URL.revokeObjectURL(url);
        attachmentUrlsRef.current.delete(key);
      }
    }

    for (const key of Object.keys(attachmentCacheRef.current)) {
      if (!seenKeys.has(key)) {
        delete attachmentCacheRef.current[key];
      }
    }
  }, []);

  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  useEffect(() => {
    refreshTokens();
  }, [refreshTokens]);

  useEffect(() => {
    const handleClickAway = (event: MouseEvent) => {
      if (!menuRef.current) return;
      if (menuRef.current.contains(event.target as Node)) return;
      setIsMenuOpen(false);
    };

    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickAway);
    }
    return () => document.removeEventListener('mousedown', handleClickAway);
  }, [isMenuOpen]);

  useEffect(() => {
    let cancelled = false;
    const loadMembers = async () => {
      if (!messagingClient) {
        setChannelMembers([]);
        return;
      }
      try {
        const response = await messagingClient.getChannelMembers(channelId);
        if (cancelled) return;
        const addresses = (response.members ?? [])
          .map((member) => member.memberAddress?.toLowerCase())
          .filter((addr): addr is string => !!addr);
        setChannelMembers(addresses);
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to fetch channel members:', error);
          setChannelMembers([]);
        }
      }
    };
    loadMembers();
    return () => {
      cancelled = true;
    };
  }, [messagingClient, channelId]);

  const otherParticipants = useMemo(() => {
    const currentAddr = currentAccount?.address?.toLowerCase();
    return channelMembers.filter(
      (addr) => addr && addr !== currentAddr,
    );
  }, [channelMembers, currentAccount]);

  const selectedTokenInfo = useMemo(() => {
    if (!selectedTokenType) return null;
    return tokenOptions.find((option) => option.coinType === selectedTokenType) ?? null;
  }, [selectedTokenType, tokenOptions]);

  const shortAddress = useCallback((address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }, []);

  const handleGiftOption = useCallback(() => {
    if (otherParticipants.length === 0) {
      setToastMessage('No recipient available for gifting.');
      return;
    }

    setIsMenuOpen(false);
    setGiftError(null);

    const showModal = (options: TokenOption[]) => {
      if (options.length === 0) {
        setToastMessage('No tokens available for gifting.');
        return;
      }
      let defaultRecipient: string | null = null;
      if (selectedRecipient && otherParticipants.includes(selectedRecipient)) {
        defaultRecipient = selectedRecipient;
      } else if (otherParticipants.length > 0) {
        defaultRecipient = otherParticipants[0];
      }
      setSelectedRecipient(defaultRecipient);
      setGiftAmount('');
      setGiftError(null);
      setIsGiftModalOpen(true);
    };

    if (!isLoadingTokens && tokenOptions.length > 0) {
      showModal(tokenOptions);
      return;
    }

    refreshTokens()
      .then((options) => {
        showModal(options);
      })
      .catch((error) => {
        console.error('Failed to load wallet tokens:', error);
        setToastMessage('Failed to load wallet tokens. Please try again.');
      });
  }, [otherParticipants, isLoadingTokens, tokenOptions, refreshTokens, selectedRecipient]);

  const ALLOWED_FILE_TYPES = [
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf', 'text/plain', 'application/msword', 
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'audio/webm'
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

  useEffect(() => {
    return () => {
      attachmentUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      attachmentUrlsRef.current.clear();
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
        } catch (err) {
          // ignore
        }
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (toastMessage) {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
      toastTimeoutRef.current = setTimeout(() => {
        setToastMessage(null);
        toastTimeoutRef.current = null;
      }, 5000);
    }
  }, [toastMessage]);

  useEffect(() => {
    if (channelError) {
      setToastMessage(channelError);
    }
  }, [channelError]);

  const dismissToast = useCallback(() => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = null;
    }
    setToastMessage(null);
  }, []);

  const triggerFileDownload = useCallback((url: string, filename: string) => {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    anchor.click();
  }, []);

  const cleanupMediaResources = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (err) {
        // ignore
      }
    }
    mediaRecorderRef.current = null;
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
  }, []);

  const handleStartRecording = useCallback(async () => {
    if (isRecording || isSendingMessage || !isReady) {
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setToastMessage('Microphone access is not supported in this browser.');
      return;
    }

    try {
      setShowEmojiPicker(false);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        audioChunksRef.current = [];
        cleanupMediaResources();
        setIsRecording(false);

        if (blob.size === 0) {
          return;
        }

        const audioFile = new File([blob], `voice-message-${Date.now()}.webm`, {
          type: 'audio/webm',
        });

        setSelectedFiles((prev) => [...prev, audioFile]);
        setToastMessage('Voice message ready to send.');
      };

      recorder.start();
      setIsRecording(true);
    } catch (error) {
      cleanupMediaResources();
      setIsRecording(false);
      setToastMessage('Unable to access microphone. Please check permissions.');
    }
  }, [cleanupMediaResources, isRecording, isReady, isSendingMessage]);

  const handleStopRecording = useCallback(() => {
    if (!isRecording) {
      return;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (error) {
        cleanupMediaResources();
        setIsRecording(false);
        setToastMessage('Failed to record audio. Please try again.');
      }
    } else {
      cleanupMediaResources();
      setIsRecording(false);
    }
  }, [cleanupMediaResources, isRecording]);

  const fetchAttachmentData = useCallback(
    (messageId: string, attachmentId: string, openAfterFetch = false) => {
      const message = resolvedMessages.find((m) => m.id === messageId);
      if (!message) {
        return;
      }
      const attachment = message.attachments.find((att) => att.id === attachmentId);
      if (!attachment) {
        return;
      }

      if (attachment.status === 'ready' && attachment.url) {
        if (openAfterFetch) {
          triggerFileDownload(attachment.url, attachment.name);
        }
        return;
      }

      if (!attachment.fetchData) {
        setResolvedMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? {
                  ...m,
                  attachments: m.attachments.map((att) =>
                    att.id === attachmentId
                      ? { ...att, status: 'error', error: 'Attachment data unavailable' }
                      : att
                  ),
                }
              : m
          )
        );
        setToastMessage('Attachment data unavailable.');
        return;
      }

      const attachmentMeta = {
        name: attachment.name,
        type: attachment.type,
        fetchData: attachment.fetchData,
      };

      attachmentCacheRef.current[attachmentId] = {
        ...(attachmentCacheRef.current[attachmentId] ?? { status: 'idle' }),
        status: 'loading',
        error: undefined,
      };
      setAttachmentErrors((prev) => {
        const { [attachmentId]: _removed, ...rest } = prev;
        return rest;
      });

      if (attachment.status !== 'loading') {
        setResolvedMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? {
                  ...m,
                  attachments: m.attachments.map((att) =>
                    att.id === attachmentId
                      ? { ...att, status: 'loading', error: undefined }
                      : att
                  ),
                }
              : m
          )
        );
      }

      attachmentMeta
        .fetchData()
        .then((raw) => {
          if (!raw) {
            throw new Error('Attachment data unavailable');
          }
          const byteArray = raw instanceof Uint8Array ? raw : new Uint8Array(raw);
          const buffer = byteArray.buffer.slice(
            byteArray.byteOffset,
            byteArray.byteOffset + byteArray.byteLength
          ) as ArrayBuffer;
          const blob = new Blob([buffer], {
            type: attachmentMeta.type || 'application/octet-stream',
          });
          const objectUrl = URL.createObjectURL(blob);
          const existingUrl = attachmentUrlsRef.current.get(attachmentId);
          if (existingUrl) {
            URL.revokeObjectURL(existingUrl);
          }
          attachmentUrlsRef.current.set(attachmentId, objectUrl);
          attachmentCacheRef.current[attachmentId] = {
            status: 'ready',
            url: objectUrl,
          };
          setResolvedMessages((prev) =>
            prev.map((m) =>
              m.id === messageId
                ? {
                    ...m,
                    attachments: m.attachments.map((att) =>
                      att.id === attachmentId
                        ? {
                            ...att,
                            status: 'ready',
                            url: objectUrl,
                            error: undefined,
                          }
                        : att
                    ),
                  }
                : m
            )
          );
          setAttachmentErrors((prev) => {
            const { [attachmentId]: _removed, ...rest } = prev;
            return rest;
          });
          if (openAfterFetch) {
            triggerFileDownload(objectUrl, attachmentMeta.name);
          }
        })
        .catch((err) => {
          const messageText =
            err instanceof Error
              ? err.message.includes('502')
                ? 'Attachment temporarily unavailable (502 Bad Gateway)'
                : err.message
              : 'Failed to fetch attachment';

          const existingUrl = attachmentUrlsRef.current.get(attachmentId);
          if (existingUrl) {
            URL.revokeObjectURL(existingUrl);
            attachmentUrlsRef.current.delete(attachmentId);
          }
          attachmentCacheRef.current[attachmentId] = {
            status: 'error',
            error: messageText,
          };

          setResolvedMessages((prev) =>
            prev.map((m) =>
              m.id === messageId
                ? {
                    ...m,
                    attachments: m.attachments.map((att) =>
                      att.id === attachmentId
                        ? { ...att, status: 'error', error: messageText }
                        : att
                    ),
                  }
                : m
            )
          );
          setAttachmentErrors((prev) => ({
            ...prev,
            [attachmentId]: messageText,
          }));
          setToastMessage(messageText);
        });
    },
    [resolvedMessages, triggerFileDownload]
  );

  const handleAttachmentClick = useCallback(
    (messageId: string, attachmentId: string) => {
      fetchAttachmentData(messageId, attachmentId, true);
    },
    [fetchAttachmentData]
  );

  const handleAttachmentImageError = useCallback((attachmentId: string) => {
    const existingUrl = attachmentUrlsRef.current.get(attachmentId);
    if (existingUrl) {
      URL.revokeObjectURL(existingUrl);
      attachmentUrlsRef.current.delete(attachmentId);
    }
    attachmentCacheRef.current[attachmentId] = {
      ...(attachmentCacheRef.current[attachmentId] ?? { status: 'error' }),
      status: 'error',
      url: undefined,
      error: 'Image failed to load',
    };
    setAttachmentErrors((prev) => ({
      ...prev,
      [attachmentId]: 'Image failed to load',
    }));
  }, []);

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
      setGlobalAttachmentError(null);
      const seenKeys = new Set<string>();
      const errorsFromCache: Record<string, string> = {};

      try {
        const resolved = messages.map((message, index) => {
          const attachments =
            message.attachments?.map((attachment, attIndex) => {
              const attachmentId = `${message.createdAtMs}-${index}-${attIndex}`;
              const mimeType = (attachment.mimeType || '').toLowerCase();
              const isImage = mimeType.startsWith('image/');
              const isAudio = mimeType.startsWith('audio/');
              const fetchData =
                attachment && attachment.data
                  ? () =>
                      attachment.data instanceof Promise
                        ? attachment.data
                        : Promise.resolve(attachment.data)
                  : undefined;
              if (!attachmentCacheRef.current[attachmentId]) {
                attachmentCacheRef.current[attachmentId] = { status: 'idle' };
              }
              const cacheEntry = attachmentCacheRef.current[attachmentId];
              if (cacheEntry.url && !attachmentUrlsRef.current.has(attachmentId)) {
                attachmentUrlsRef.current.set(attachmentId, cacheEntry.url);
              }
              if (cacheEntry.error) {
                errorsFromCache[attachmentId] = cacheEntry.error;
              }
              seenKeys.add(attachmentId);
              return {
                id: attachmentId,
                name: attachment.fileName || 'Attachment',
                type: attachment.mimeType || 'application/octet-stream',
                size:
                  typeof attachment.fileSize === 'number'
                    ? attachment.fileSize
                    : 0,
                status: cacheEntry.status,
                url: cacheEntry.url,
                error: cacheEntry.error,
                fetchData,
                autoLoad: (isImage || isAudio) && !!fetchData && cacheEntry.status === 'idle',
              };
            }) ?? [];

          return {
            id: `${message.createdAtMs}-${index}`,
            text: message.text,
            time: formatTimestamp(message.createdAtMs),
            fromMe: message.sender === currentAccount?.address,
            attachments,
          };
        });
        setResolvedMessages(resolved);
        setAttachmentErrors(errorsFromCache);
        cleanupAttachmentCaches(seenKeys);
      } catch (err) {
        console.error('Failed to resolve messages:', err);
        setGlobalAttachmentError('Chat failed to load due to server error. Please try again.');
        setToastMessage('Chat failed to load due to server error. Please try again.');
        cleanupAttachmentCaches(new Set());
        setAttachmentErrors({});
        setResolvedMessages([]);
      }
    };
    resolveMessages();
  }, [messages, currentAccount, cleanupAttachmentCaches]);

  useEffect(() => {
    resolvedMessages.forEach((message) => {
      message.attachments.forEach((attachment) => {
        if (attachment.autoLoad && attachment.status === 'idle') {
          fetchAttachmentData(message.id, attachment.id, false);
        }
      });
    });
  }, [resolvedMessages, fetchAttachmentData]);


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

  const hasSendableContent = messageText.trim().length > 0 || selectedFiles.length > 0;

  const handleGiftModalClose = () => {
    setIsGiftModalOpen(false);
    setGiftError(null);
    setSelectedRecipient(null);
    setGiftAmount('');
    setIsSendingGift(false);
  };

  const handleGiftSend = async () => {
    if (!currentAccount?.address) {
      setGiftError('Wallet not connected.');
      return;
    }

    const effectiveRecipient =
      selectedRecipient || (otherParticipants.length === 1 ? otherParticipants[0] : null);

    if (!effectiveRecipient) {
      setGiftError('Please select a recipient.');
      return;
    }

    const token = selectedTokenInfo;
    if (!token) {
      setGiftError('Please select a token to gift.');
      return;
    }

    let amountAtomic: bigint;
    try {
      amountAtomic = parseAmountToAtomic(giftAmount, token.decimals);
    } catch (error) {
      setGiftError(error instanceof Error ? error.message : 'Enter a valid amount.');
      return;
    }

    if (amountAtomic <= 0n) {
      setGiftError('Enter an amount greater than zero.');
      return;
    }
    if (amountAtomic > token.balance) {
      setGiftError('Insufficient balance for selected token.');
      return;
    }

    setIsSendingGift(true);
    try {
      const coins = await fetchCoinsForType(token.coinType);
      if (!coins.length) {
        throw new Error('No coins available for the selected token.');
      }

      const transferCoin = coins.find((coin) => BigInt(coin.balance) >= amountAtomic);
      if (!transferCoin) {
        throw new Error('Insufficient balance for gifting.');
      }

      const tx = new Transaction();

      if (token.coinType === SUI_TYPE) {
        tx.setGasPayment([
          {
            objectId: transferCoin.coinObjectId,
            version: transferCoin.version,
            digest: transferCoin.digest,
          },
        ]);
        const [coinToTransfer] = tx.splitCoins(tx.gas, [tx.pure.u64(amountAtomic)]);
        tx.transferObjects([coinToTransfer], tx.pure.address(effectiveRecipient));
      } else {
        const suiCoins = await fetchCoinsForType(SUI_TYPE);
        if (!suiCoins.length) {
          throw new Error('No SUI available to pay gas for the gift.');
        }
        const gasCoin = suiCoins[0];
        tx.setGasPayment([
          {
            objectId: gasCoin.coinObjectId,
            version: gasCoin.version,
            digest: gasCoin.digest,
          },
        ]);
        const [coinToTransfer] = tx.splitCoins(
          tx.object(transferCoin.coinObjectId),
          [tx.pure.u64(amountAtomic)],
        );
        tx.transferObjects([coinToTransfer], tx.pure.address(effectiveRecipient));
      }

      tx.setSender(currentAccount.address);

      const simulation = await suiClient.devInspectTransactionBlock({
        sender: currentAccount.address,
        transactionBlock: tx,
      });
      const simStatus =
        simulation.effects?.status?.status ?? (simulation.effects?.status as any);
      if (simStatus !== 'success') {
        throw new Error(simulation.effects?.status?.error || 'Gift simulation failed.');
      }

      await signAndExecuteTransaction({
        transaction: tx,
      });

      const formattedAmount = formatBalance(amountAtomic, token.decimals);
      await refreshTokens();
      setToastMessage(
        `Gifted ${formattedAmount} ${token.symbol} to ${shortAddress(
          effectiveRecipient,
        )}.`,
      );
      const giftMessage = `${shortAddress(currentAccount.address)} sent ${formattedAmount} ${token.symbol} to ${shortAddress(
        effectiveRecipient,
      )}`;
      await sendMessage(channelId, giftMessage);
      handleGiftModalClose();
    } catch (error) {
      console.error('Failed to send gift:', error);
      setGiftError(
        error instanceof Error ? error.message : 'Failed to send gift. Please try again.',
      );
    } finally {
      setIsSendingGift(false);
    }
  };

  return (
    <div className="w-full h-full text-gray-800 bg-gray-50 flex flex-col">
      <div className="relative px-6 py-4 bg-white flex items-center gap-4 shrink-0 border-b border-gray-200">
        {isMobile && (
          <button
              onClick={handleBackToChatList}
              className="p-2 rounded-full flex justify-center items-center cursor-pointer bg-gray-100 hover:bg-purple-100 transition-colors"
            >
              <FaChevronLeft className="w-4 h-4 text-gray-500" />
            </button>
        )}
        <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center border border-purple-200">
          <span className="text-sm font-semibold text-purple-600">{contactName.slice(0, 1).toUpperCase()}</span>
        </div>
        <div className="flex-1">
          <div className="font-semibold text-gray-900 text-base">{contactName}</div>
          <div className="text-xs text-gray-500 font-medium">
            {currentChannel ? `${currentChannel.messages_count} messages` : 'Loading...'}
          </div>
        </div>
        <div className="relative" ref={menuRef}>
          <button
            className="p-2 rounded-full cursor-pointer bg-gray-100 hover:bg-purple-100 transition-colors"
            onClick={() => setIsMenuOpen((prev) => !prev)}
            aria-haspopup="menu"
            aria-expanded={isMenuOpen}
          >
            <DotsVerticalIcon className="w-4 h-4 text-gray-500" />
          </button>
          {isMenuOpen && (
            <div className="absolute right-0 mt-2 w-44 rounded-lg border border-gray-200 bg-white shadow-lg z-30 overflow-hidden">
              <button
                onClick={handleGiftOption}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-purple-50 transition-colors"
              >
                <FaGift className="w-4 h-4 text-purple-500" />
                <span>Send Gift</span>
              </button>
            </div>
          )}
        </div>
      </div>
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
              className="px-4 py-2 bg-white shadow-sm hover:bg-gray-100 text-purple-600 text-sm font-medium rounded-lg border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isFetchingMessages ? 'Loading...' : 'Load older messages'}
            </button>
          </div>
        )}

        <div className="mx-auto max-w-4xl space-y-4">
          {globalAttachmentError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-xs font-medium text-red-600 text-center">
              {globalAttachmentError}
            </div>
          )}
          {resolvedMessages.length === 0 && !isFetchingMessages ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 bg-white/80 rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-200 shadow-sm">
                <span className="text-xl text-gray-400"><FaComments /></span>
              </div>
              <p className="text-gray-600 text-sm font-medium">No messages yet. Start the conversation!</p>
            </div>
          ) : (
            resolvedMessages.map((m) => (
              <div key={m.id} className={`flex ${m.fromMe ? "justify-end" : "justify-start"}`}>
                <div
                  className={`${m.fromMe 
                    ? "bg-purple-500 text-white" 
                    : "bg-white text-gray-800 border border-gray-200"
                  } rounded-2xl px-4 py-3 max-w-[70%] text-sm shadow-md`}
                >

                  {m.attachments && m.attachments.length > 0 && (
                    <div className="mb-2 space-y-2">
                      {m.attachments.map((attachment) => {
                        const hasError =
                          attachment.error || attachmentErrors[attachment.id];
                        const isImage = attachment.type?.startsWith('image/');
                        const isAudio = attachment.type?.startsWith('audio/');
                        return (
                          <div key={attachment.id} className="bg-black/10 rounded-lg p-2">
                            {hasError ? (
                              <div className="flex items-center gap-2 text-xs text-red-500">
                                <FaFile className="text-red-500" />
                                <span className="truncate">{attachment.name}</span>
                                <span>({hasError})</span>
                              </div>
                            ) : isAudio ? (
                              attachment.url ? (
                                <AudioAttachmentPlayer url={attachment.url} name={attachment.name} />
                              ) : (
                                <div className="flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-4 text-xs font-medium text-gray-600">
                                  <FaSpinner className="w-4 h-4 animate-spin text-gray-500" />
                                  Loading audio...
                                </div>
                              )
                            ) : isImage ? (
                              attachment.url ? (
                                <img 
                                  src={attachment.url}
                                  alt={attachment.name}
                                  className="max-w-full max-h-48 rounded-md object-contain border border-gray-200"
                                  onError={() => handleAttachmentImageError(attachment.id)}
                                />
                              ) : (
                                <div className="flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-4 text-xs font-medium text-gray-600">
                                  <FaSpinner className="w-4 h-4 animate-spin text-gray-500" />
                                  Loading image...
                                </div>
                              )
                            ) : (
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2 text-xs text-gray-700">
                                  <FaFile className="text-gray-500" />
                                  <span className="truncate font-semibold">{attachment.name}</span>
                                  <span className="text-gray-500">
                                    ({formatFileSize(attachment.size)})
                                  </span>
                                </div>
                                <button
                                  onClick={() => handleAttachmentClick(m.id, attachment.id)}
                                  className="p-2 rounded-full bg-white hover:bg-gray-100 text-gray-600 text-xs font-medium border border-gray-200 flex items-center justify-center"
                                  disabled={attachment.status === 'loading'}
                                >
                                  {attachment.status === 'loading' ? (
                                    <FaSpinner className="w-4 h-4 animate-spin text-gray-500" />
                                  ) : (
                                    <FaDownload className="w-4 h-4" />
                                  )}
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  
                  {m.text && (
                    <div className="font-medium">{m.text}</div>
                  )}
                  
                  <div className={`text-xs mt-1 font-medium ${m.fromMe ? "text-purple-100" : "text-gray-500"}`}>{m.time}</div>
                  {m.fromMe && (
                    <div className="flex justify-end mt-1">
                      <span className="text-xs text-purple-200 font-medium">✓✓</span>
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
            <div className="w-10 h-10 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600 text-sm font-medium">Loading messages...</p>
          </div>
        )}
      </div>
      
      {selectedFiles.length > 0 && (
        <div className="px-4 py-3 bg-gray-100 border-t border-gray-200">
          <div className="flex flex-wrap gap-2">
            {selectedFiles.map((file, index) => (
              <div key={index} className="flex items-center gap-2 bg-white rounded-lg p-2 text-sm border border-gray-200 shadow-sm">
                {file.type.startsWith('image/') ? (
                  <FaImage className="text-purple-500" />
                ) : (
                  <FaFile className="text-gray-500" />
                )}
                <span className="text-gray-800 truncate max-w-32 font-medium">{file.name}</span>
                <span className="text-gray-500 text-xs">({formatFileSize(file.size)})</span>
                <button
                  onClick={() => removeFile(index)}
                  className="bg-gray-200 hover:bg-gray-300 text-gray-600 transition-colors rounded-full w-6 h-6 flex items-center justify-center"
                >
                  <Cross2Icon className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      
      <div className="px-4 py-4 bg-gray-100 flex items-center gap-3 shrink-0 border-t border-gray-200 relative">
        {showEmojiPicker && (
          <div className="absolute bottom-full mb-3 left-4 z-10">
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
          className="p-2 rounded-full cursor-pointer bg-white hover:bg-purple-100 transition-colors text-gray-600 border border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={() => fileInputRef.current?.click()}
          disabled={isRecording || !isReady}
        >
          <FaPaperclip className="w-4 h-4" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,application/pdf,text/plain,.doc,.docx"
          onChange={handleFileSelect}
          className="hidden"
          disabled={isRecording || !isReady}
        />
        <form onSubmit={handleSendMessage} className="flex-1 flex items-center gap-3 relative">
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              placeholder="Type a message..."
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isSendingMessage || !isReady}
              className="w-full rounded-full titillium-web-bold bg-white text-gray-800 placeholder-gray-500 pr-12 pl-5 py-3 outline-none border border-gray-300 focus:border-purple-400 focus:bg-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="absolute inset-y-0 right-3 my-auto h-9 w-9 rounded-full bg-white hover:bg-purple-100 transition-colors border border-gray-200 flex items-center justify-center text-gray-600"
            >
              <FaceIcon className="w-4 h-4" />
            </button>
          </div>
          {hasSendableContent ? (
            <button 
              type="submit"
              disabled={(!messageText.trim() && selectedFiles.length === 0) || isSendingMessage || !isReady}
              className="p-3 cursor-pointer rounded-full bg-purple-500 hover:bg-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-white"
            >
              <PaperPlaneIcon className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={isRecording ? handleStopRecording : handleStartRecording}
              className={`p-3 cursor-pointer rounded-full border border-gray-300 transition-colors ${
                isRecording
                  ? 'bg-red-500 hover:bg-red-600 text-white'
                  : 'bg-white hover:bg-purple-100 text-gray-600'
              }`}
              disabled={!isReady || isSendingMessage}
            >
              {isRecording ? (
                <FaStop className="w-4 h-4" />
              ) : (
                <FaMicrophone className="w-4 h-4" />
              )}
            </button>
          )}
        </form>
      </div>

      {isGiftModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 text-center">Send a Gift</h2>
            {otherParticipants.length > 1 ? (
              <div className="space-y-3">
                <label className="block text-xs font-medium text-gray-600 uppercase tracking-wide">Select recipient</label>
                <select
                  value={selectedRecipient ?? ''}
                  onChange={(event) => {
                    setSelectedRecipient(event.target.value || null);
                    setGiftError(null);
                  }}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 focus:outline-none focus:border-purple-500"
                >
                  {otherParticipants.map((addr) => (
                    <option key={addr} value={addr}>
                      {shortAddress(addr)}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <p className="text-sm font-medium text-gray-600 text-center">
                Gift will be sent to{' '}
                <span className="font-semibold text-gray-800">
                  {otherParticipants.length ? shortAddress(otherParticipants[0]) : 'N/A'}
                </span>
              </p>
            )}

            {isLoadingTokens && (
              <p className="mt-3 text-xs font-medium text-gray-500 text-center">Loading wallet tokens...</p>
            )}

            <div className="mt-4 space-y-3">
              <label className="block text-xs font-medium text-gray-600 uppercase tracking-wide">Token</label>
              <select
                value={selectedTokenType ?? ''}
                onChange={(event) => {
                  setSelectedTokenType(event.target.value || null);
                  setGiftError(null);
                }}
                disabled={isLoadingTokens || tokenOptions.length === 0}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 focus:outline-none focus:border-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {tokenOptions.map((token) => (
                  <option key={token.coinType} value={token.coinType}>
                    {token.symbol}
                  </option>
                ))}
              </select>
              {selectedTokenInfo && (
                <p className="text-xs font-semibold text-gray-500">
                  Balance: {formatBalance(selectedTokenInfo.balance, selectedTokenInfo.decimals)}{' '}
                  {selectedTokenInfo.symbol}
                </p>
              )}
            </div>

            <div className="mt-4 space-y-3">
              <label className="block text-xs font-medium text-gray-600 uppercase tracking-wide">Amount</label>
              <input
                type="text"
                inputMode="decimal"
                pattern="^\d*\.?\d*$"
                value={giftAmount}
                onChange={(event) => {
                  setGiftAmount(event.target.value);
                  setGiftError(null);
                }}
                placeholder="0.0"
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 focus:outline-none focus:border-purple-500"
              />
            </div>

            {giftError && (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-600 text-center">
                {giftError}
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={handleGiftModalClose}
                className="rounded-lg border border-gray-300 bg-white px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleGiftSend}
                disabled={isSendingGift || isLoadingTokens}
                className="rounded-lg bg-purple-500 px-5 py-2 text-sm font-medium text-white hover:bg-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSendingGift ? 'Sending...' : 'Send Gift'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toastMessage && (
        <div className="fixed top-6 right-6 z-50">
          <div className="relative max-w-xs rounded-xl border border-gray-200 bg-white px-6 py-4 shadow-lg">
            <button
              onClick={dismissToast}
              className="absolute top-2 right-2 p-1 rounded-full border border-gray-200 bg-gray-100 hover:bg-gray-200 transition-colors"
              aria-label="Dismiss notification"
            >
              <Cross2Icon className="w-4 h-4 text-gray-600" />
            </button>
            <div className="text-sm font-medium text-gray-700 pr-6">{toastMessage}</div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ChatWindow;

