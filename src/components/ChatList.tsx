import { motion } from 'framer-motion';
import { MagnifyingGlassIcon, PlusIcon } from '@radix-ui/react-icons';
import { FaComments, FaUser, FaUsers, FaSpinner } from 'react-icons/fa';
import { FaDoorOpen } from "react-icons/fa6";
import { useDisconnectWallet, useCurrentAccount } from "@mysten/dapp-kit";
import { useState, useRef, useEffect } from 'react';
import { useMessaging } from '../hooks/useMessaging';
import { isValidSuiAddress } from '@mysten/sui/utils';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { formatTimestamp } from '../utils/formatter';

export function ChatList({ onSelect, selectedChatId }: { onSelect?: (id: string) => void; selectedChatId?: string }) {
  const { mutate: disconnect } = useDisconnectWallet();
  const currentAccount = useCurrentAccount();
  const { 
    channels, 
    createChannel, 
    isCreatingChannel, 
    channelError, 
    isReady 
  } = useMessaging();
  
  // [KEEP ALL YOUR ORIGINAL STATE AND LOGIC EXACTLY THE SAME]
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'groups'>('all');
  const [addressTags, setAddressTags] = useState<string[]>([]);
  const [currentAddressInput, setCurrentAddressInput] = useState('');
  const [validStatus, setValidStatus] = useState<'idle' | 'resolving' | 'valid' | 'invalid'>('idle');
  const [resolvedAddress, setResolvedAddress] = useState('');
  const validationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  // [KEEP ALL YOUR ORIGINAL USEFFECTS AND HANDLERS EXACTLY THE SAME]
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (validationTimeoutRef.current) {
      clearTimeout(validationTimeoutRef.current);
    }

    const validate = async () => {
      const input = searchQuery.trim();
      
      if (!input) {
        setValidStatus('idle');
        setResolvedAddress('');
        return;
      }

      const inputLower = input.toLowerCase();

      if (isValidSuiAddress(input)) {
        setValidStatus('valid');
        setResolvedAddress(input);
        return;
      }

      if (!inputLower.endsWith('.sui')) {
        setValidStatus('invalid');
        setResolvedAddress('');
        return;
      }

      setValidStatus('resolving');
      try {
        const client = new SuiClient({ url: getFullnodeUrl('mainnet') });
        const resolved = await client.resolveNameServiceAddress({ name: inputLower });
        
        if (isMountedRef.current) {
          if (resolved) {
            setValidStatus('valid');
            setResolvedAddress(resolved);
          } else {
            setValidStatus('invalid');
            setResolvedAddress('');
          }
        }
      } catch (e) {
        if (isMountedRef.current) {
          setValidStatus('invalid');
          setResolvedAddress('');
        }
      }
    };

    validationTimeoutRef.current = setTimeout(validate, 300);
  }, [searchQuery]);

  const handleAddAddress = async () => {
    const input = currentAddressInput.trim();
    
    if (!input) return;
    
    let address = input;
    
    if (input.toLowerCase().endsWith('.sui')) {
      try {
        const client = new SuiClient({ url: getFullnodeUrl('mainnet') });
        const resolved = await client.resolveNameServiceAddress({ name: input.toLowerCase() });
        if (!resolved) {
          setValidationError('Invalid SuiNS name');
          return;
        }
        address = resolved;
      } catch (e) {
        setValidationError('Failed to resolve SuiNS name');
        return;
      }
    }
    
    if (!isValidSuiAddress(address)) {
      setValidationError('Invalid Sui address');
      return;
    }
    
    if (currentAccount && address.toLowerCase() === currentAccount.address.toLowerCase()) {
      setValidationError('You cannot add your own address');
      return;
    }
    
    if (addressTags.includes(address)) {
      setValidationError('Address already added');
      return;
    }
    
    setAddressTags([...addressTags, address]);
    setCurrentAddressInput('');
    setValidationError(null);
  };

  const handleRemoveAddress = (addressToRemove: string) => {
    setAddressTags(addressTags.filter(addr => addr !== addressToRemove));
  };

  const handleCreateGroupWithTags = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (addressTags.length < 2) {
      setValidationError('Please add at least 2 addresses to create a group');
      return;
    }

    const result = await createChannel(addressTags);
    if (result?.channelId) {
      setAddressTags([]);
      setCurrentAddressInput('');
      setShowCreateGroup(false);
      setSearchQuery('');
    }
  };

  const handleCreateSingleChat = async (input: string) => {
    setValidationError(null);
    let address = input;
    
    if (input.toLowerCase().endsWith('.sui')) {
      try {
        const client = new SuiClient({ url: getFullnodeUrl('mainnet') });
        const resolved = await client.resolveNameServiceAddress({ name: input.toLowerCase() });
        if (!resolved) {
          setValidationError('Invalid SuiNS name');
          return;
        }
        address = resolved;
      } catch (e) {
        setValidationError('Failed to resolve SuiNS name');
        return;
      }
    }
    
    if (!isValidSuiAddress(address)) {
      setValidationError('Invalid Sui address');
      return;
    }

    if (currentAccount && address.toLowerCase() === currentAccount.address.toLowerCase()) {
      setValidationError('You cannot chat with yourself');
      return;
    }

    const result = await createChannel([address]);
    if (result?.channelId) {
      setSearchQuery('');
      setValidStatus('idle');
      setResolvedAddress('');
    }
  };

  const filteredChannels = channels.filter(channel => {
    if (activeFilter === 'groups') {
      return channel.auth.member_permissions.contents.length > 2;
    }

    if (!searchQuery.trim()) return true;
    
    const query = searchQuery.toLowerCase();
    const channelId = channel.id.id.toLowerCase();
    const lastMessage = channel.last_message?.text.toLowerCase() || '';
    
    return channelId.includes(query) || lastMessage.includes(query);
  });

  const isNewAddress = searchQuery.trim() && 
  (isValidSuiAddress(searchQuery.trim()) || searchQuery.trim().toLowerCase().endsWith('.sui')) && 
  !channels.some(channel => 
    channel.auth.member_permissions.contents.some((member: any) => {
      const memberAddress = typeof member === 'string' ? member : member?.address || member?.id || member;
      return memberAddress && typeof memberAddress === 'string' && 
        memberAddress.toLowerCase() === (resolvedAddress || searchQuery.trim()).toLowerCase();
    })
  );

  const chatItems = filteredChannels
    .sort((a, b) => {
      const aTime = a.last_message ? a.last_message.createdAtMs : a.created_at_ms;
      const bTime = b.last_message ? b.last_message.createdAtMs : b.created_at_ms;
      return bTime - aTime; 
    })
    .map(channel => {
      const channelId = channel.id.id;
      const memberCount = channel.auth.member_permissions.contents.length;
      const isGroup = memberCount > 2;
      
      const displayName = isGroup 
        ? `Group ${channelId.slice(0, 5)}...${channelId.slice(-5)}`
        : `${channelId.slice(0, 5)}...${channelId.slice(-5)}`;
      
      return {
        id: channel.id.id,
        name: displayName,
        lastMessage: channel.last_message?.text || 'No messages yet',
        time: channel.last_message 
          ? formatTimestamp(channel.last_message.createdAtMs)
          : formatTimestamp(channel.created_at_ms),
        unread: 0,
        avatarUrl: undefined,
        isGroup,
        memberCount
      };
    });

  return (
    <div className="w-full h-full bg-white border-r border-gray-200">
      {/* Header - Clean with subtle Penguin accent */}
      <div className="bg-slate-50 px-6 py-5 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-sm">
              <FaComments className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">Messages</h1>
              <p className="text-sm text-gray-600">Penguin Chat</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button 
              onClick={() => setShowCreateGroup(true)}
              className="p-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors cursor-pointer"
            >
              <PlusIcon className="w-5 h-5" />
            </button>
            <button 
              onClick={() => disconnect()} 
              className="p-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors cursor-pointer"
            >
              <FaDoorOpen className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search Bar - Clean and functional */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <MagnifyingGlassIcon className="w-4 h-4 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search or enter address..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setValidationError(""); setValidStatus("idle")}}
            className="w-full p-3 pl-10 rounded-xl bg-gray-50 text-gray-900 placeholder-gray-500 border border-gray-200 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors outline-none"
          />
        </div>
      </div>

      {/* Search Results - Professional */}
      {searchQuery && (
        <div className="px-6 py-3 bg-white border-b border-gray-200">
          <div className="space-y-2">
            {validStatus === 'resolving' && 
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <FaSpinner className="w-3 h-3 animate-spin" />
                <span>Resolving SuiNS name...</span>
              </div>
            }
            {validStatus === 'valid' && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-blue-50 border border-blue-200">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-900">Valid address</div>
                    <div className="text-xs text-gray-600 font-mono">
                      {resolvedAddress && resolvedAddress !== searchQuery ? 
                        `${resolvedAddress.slice(0, 8)}...${resolvedAddress.slice(-6)}` : 
                        `${searchQuery.slice(0, 8)}...${searchQuery.slice(-6)}`
                      }
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleCreateSingleChat(searchQuery.trim())}
                  disabled={!isReady || isCreatingChannel || validStatus !== 'valid'}
                  className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  Start Chat
                </button>
              </div>
            )}
            {validStatus === 'invalid' && (
              <div className="flex items-center gap-2 text-sm text-red-600">
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                Invalid Sui address or name
              </div>
            )}
            {validationError && (
              <div className="text-sm text-red-600">
                {validationError}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Filter Tabs - Minimal */}
      <div className="px-6 py-3 bg-white border-b border-gray-200">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          <button 
            className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors cursor-pointer ${
              activeFilter === 'all' 
                ? 'bg-white text-gray-900 shadow-sm' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
            onClick={() => setActiveFilter('all')}
          >
            All
          </button>
          <button 
            className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors cursor-pointer ${
              activeFilter === 'groups' 
                ? 'bg-white text-gray-900 shadow-sm' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
            onClick={() => setActiveFilter('groups')}
          >
            Groups
          </button>
        </div>
      </div>

      {/* Create Group Modal - Clean overlay */}
      {showCreateGroup && (
        <div className="absolute inset-0 z-50 bg-white flex flex-col">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => {
                  setShowCreateGroup(false);
                  setAddressTags([]);
                  setCurrentAddressInput('');
                  setValidationError(null);
                }}
                className="p-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h2 className="text-lg font-semibold text-gray-900">New Group</h2>
            </div>
          </div>

          <div className="flex-1 p-6 overflow-y-auto">
            <p className="text-gray-600 text-sm mb-6">Add at least 2 addresses to create a group chat</p>
            
            {addressTags.length > 0 && (
              <div className="mb-6">
                <div className="flex flex-wrap gap-2">
                  {addressTags.map((address, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-2 rounded-lg text-sm font-medium"
                    >
                      <span className="font-mono">{address.slice(0, 6)}...{address.slice(-4)}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveAddress(address)}
                        className="text-blue-500 hover:text-blue-700 transition-colors cursor-pointer"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <div className="flex gap-2 mb-6">
              <input
                type="text"
                placeholder="Enter Sui address or SuiNS name..."
                value={currentAddressInput}
                onChange={(e) => {
                  setCurrentAddressInput(e.target.value);
                  setValidationError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddAddress();
                  }
                }}
                className="flex-1 p-3 rounded-lg bg-gray-50 text-gray-900 placeholder-gray-500 border border-gray-200 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors outline-none"
                disabled={!isReady || isCreatingChannel}
              />
              <button
                type="button"
                onClick={handleAddAddress}
                disabled={!currentAddressInput.trim() || !isReady || isCreatingChannel}
                className="px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                Add
              </button>
            </div>

            {validationError && (
              <div className="mb-4 text-sm text-red-600">
                {validationError}
              </div>
            )}
            
            {channelError && (
              <div className="mb-4 text-sm text-red-600">
                Error: {channelError}
              </div>
            )}
          </div>

          <div className="p-6 border-t border-gray-200">
            <button
              type="button"
              onClick={handleCreateGroupWithTags}
              disabled={!isReady || isCreatingChannel || addressTags.length < 2}
              className="w-full py-3 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              {isCreatingChannel ? 'Creating...' : `Create Group (${addressTags.length})`}
            </button>
          </div>
        </div>
      )}

      {/* Chat List - Clean Telegram-like */}
      <div className="h-full overflow-y-auto bg-white">
        {chatItems.length > 0 ? (
          <ul className="list-none m-0 p-0">
            {chatItems.map((chat) => (
              <motion.li
                key={chat.id}
                className={`flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors border-b border-gray-100 ${
                  selectedChatId === chat.id ? 'bg-blue-50' : ''
                }`}
                onClick={() => onSelect?.(chat.id)}
                whileHover={{ backgroundColor: 'rgba(243, 244, 246, 0.8)' }}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  selectedChatId === chat.id 
                    ? 'bg-blue-500' 
                    : 'bg-gray-300'
                }`}>
                  {chat.avatarUrl ? (
                    <img src={chat.avatarUrl} alt={chat.name} className="h-full w-full object-cover rounded-xl" />
                  ) : chat.isGroup ? (
                    <FaUsers className="w-5 h-5 text-white" />
                  ) : (
                    <FaUser className="w-5 h-5 text-white" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-medium text-gray-900 truncate">{chat.name}</span>
                    <span className="text-xs text-gray-500 shrink-0">{chat.time}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600 truncate">{chat.lastMessage}</span>
                      {chat.isGroup && (
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                          {chat.memberCount}
                        </span>
                      )}
                    </div>
                    {chat.unread > 0 && (
                      <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-500 px-1 text-xs font-medium text-white">
                        {chat.unread}
                      </span>
                    )}
                  </div>
                </div>
              </motion.li>
            ))}
          </ul>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center px-6 py-12">
            <div className="w-16 h-16 bg-gray-200 rounded-2xl flex items-center justify-center mb-4">
              <FaComments className="w-6 h-6 text-gray-500" />
            </div>
            <p className="text-gray-900 font-medium mb-2">
              {searchQuery ? 'No chats found' : 'No chats yet'}
            </p>
            <p className="text-gray-600 text-sm">
              {searchQuery ? 'Try a different search' : 'Start a conversation to begin messaging'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default ChatList;