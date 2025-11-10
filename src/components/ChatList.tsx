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

  // KEEP ALL YOUR ORIGINAL useEffect AND HANDLER FUNCTIONS EXACTLY AS THEY WERE
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

  // KEEP YOUR ORIGINAL chatItems MAPPING
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
      {/* Header - Clean but with personality */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 px-6 py-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30">
              <FaComments className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Penguin Chat</h1>
              <p className="text-white/80 text-sm">Connected and ready</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowCreateGroup(true)}
              className="p-3 rounded-2xl bg-white/20 hover:bg-white/30 backdrop-blur-sm transition-all cursor-pointer border border-white/30"
            >
              <PlusIcon className="w-5 h-5 text-white" />
            </button>
            <button 
              onClick={() => disconnect()} 
              className="p-3 rounded-2xl bg-white/20 hover:bg-white/30 backdrop-blur-sm transition-all cursor-pointer border border-white/30"
            >
              <FaDoorOpen className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        {/* Search Bar - Clean but functional */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
            <MagnifyingGlassIcon className="w-5 h-5 text-white/70" />
          </div>
          <input
            type="text"
            placeholder="Search chats or enter Sui address/SuiNS name..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setValidationError(""); setValidStatus("idle")}}
            className="w-full p-4 pl-12 rounded-2xl bg-white/20 backdrop-blur-sm text-white placeholder-white/70 border border-white/30 focus:bg-white/30 focus:border-white/50 transition-all outline-none"
          />
        </div>
      </div>

      {/* Search Results - KEEPING ALL YOUR ORIGINAL LOGIC */}
      {searchQuery && (
        <div className="px-6 py-4 bg-white border-b border-gray-200">
          <div className="space-y-2">
            {validStatus === 'resolving' && 
              <div className="flex items-center gap-3 text-sm text-gray-600 p-3 rounded-xl bg-blue-50">
                <FaSpinner className="w-4 h-4 animate-spin text-blue-500" />
                <span>Resolving SuiNS name...</span>
              </div>
            }
            {validStatus === 'valid' && (
              <div className="flex items-center justify-between p-4 rounded-xl bg-green-50 border border-green-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-gray-900">Valid Address Found</div>
                    <div className="text-xs text-gray-600 font-mono">
                      {resolvedAddress && resolvedAddress !== searchQuery ? 
                        `Resolved: ${resolvedAddress.slice(0, 8)}...${resolvedAddress.slice(-6)}` : 
                        `${searchQuery.slice(0, 8)}...${searchQuery.slice(-6)}`
                      }
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleCreateSingleChat(searchQuery.trim())}
                  disabled={!isReady || isCreatingChannel || validStatus !== 'valid'}
                  className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  Start Chat
                </button>
              </div>
            )}
            {validStatus === 'invalid' && (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-200">
                <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                </div>
                <span className="text-sm font-medium text-gray-900">Invalid Sui address or SuiNS name</span>
              </div>
            )}
            {validationError && (
              <div className="p-4 rounded-xl bg-yellow-50 border border-yellow-200 text-sm text-gray-900">
                {validationError}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Filter Tabs - Clean design */}
      <div className="px-6 py-4 bg-white border-b border-gray-200">
        <div className="flex gap-2">
          <button 
            className={`px-6 py-3 text-sm font-semibold rounded-xl transition-all cursor-pointer border ${
              activeFilter === 'all' 
                ? 'bg-blue-500 text-white border-blue-500 shadow-sm' 
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
            onClick={() => setActiveFilter('all')}
          >
            All Chats
          </button>
          <button 
            className={`px-6 py-3 text-sm font-semibold rounded-xl transition-all cursor-pointer border ${
              activeFilter === 'groups' 
                ? 'bg-purple-500 text-white border-purple-500 shadow-sm' 
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
            onClick={() => setActiveFilter('groups')}
          >
            Groups
          </button>
        </div>
      </div>

      {/* Create Group Modal - KEEPING ALL YOUR ORIGINAL LOGIC */}
      {showCreateGroup && (
        <div className="absolute inset-0 z-20 bg-white p-6 border-r border-gray-200 flex flex-col">
          <div className="mb-6">
            <h3 className="text-2xl font-bold text-gray-900 mb-2">Create Group Chat</h3>
            <p className="text-gray-600">Add at least 2 addresses to create a group</p>
          </div>
          
          {/* Address Tags */}
          {addressTags.length > 0 && (
            <div className="mb-6">
              <div className="flex flex-wrap gap-2">
                {addressTags.map((address, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 bg-blue-50 text-blue-700 px-4 py-2 rounded-xl text-sm font-semibold border border-blue-200"
                  >
                    <span className="font-mono">{address.slice(0, 6)}...{address.slice(-4)}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveAddress(address)}
                      className="text-blue-500 hover:text-blue-700 transition-colors cursor-pointer text-lg font-bold"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Add Address Input */}
          <div className="flex gap-3 mb-6">
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
              className="flex-1 p-4 rounded-xl bg-gray-50 text-gray-900 placeholder-gray-500 border border-gray-200 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
              disabled={!isReady || isCreatingChannel}
            />
            <button
              type="button"
              onClick={handleAddAddress}
              disabled={!currentAddressInput.trim() || !isReady || isCreatingChannel}
              className="px-6 py-4 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              Add
            </button>
          </div>

          {validationError && (
            <div className="mb-6 p-4 text-sm text-red-700 bg-red-50 rounded-xl border border-red-200">
              {validationError}
            </div>
          )}
          
          {channelError && (
            <div className="mb-6 p-4 text-sm text-red-700 bg-red-50 rounded-xl border border-red-200">
              Error: {channelError}
            </div>
          )}
          
          {/* Action Buttons */}
          <div className="flex gap-3 mt-auto">
            <button
              type="button"
              onClick={handleCreateGroupWithTags}
              disabled={!isReady || isCreatingChannel || addressTags.length < 2}
              className="flex-1 px-6 py-4 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white text-sm font-semibold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              {isCreatingChannel ? 'Creating Group...' : `Create Group (${addressTags.length})`}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowCreateGroup(false);
                setAddressTags([]);
                setCurrentAddressInput('');
                setValidationError(null);
              }}
              className="px-6 py-4 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-xl transition-all cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Chat List - Clean but functional */}
      <div className="h-full overflow-y-auto bg-white">
        {chatItems.length > 0 ? (
          <ul className="list-none m-0 p-0">
            {chatItems.map((chat) => (
              <motion.li
                key={chat.id}
                className={`flex items-center gap-4 px-6 py-4 hover:bg-gray-50 cursor-pointer transition-all border-b border-gray-100 ${
                  selectedChatId === chat.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                }`}
                onClick={() => onSelect?.(chat.id)}
                whileHover={{ backgroundColor: 'rgba(59, 130, 246, 0.05)' }}
                whileTap={{ scale: 0.98 }}
              >
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                  selectedChatId === chat.id 
                    ? 'bg-gradient-to-br from-blue-500 to-purple-600' 
                    : 'bg-gradient-to-br from-gray-400 to-gray-500'
                }`}>
                  {chat.avatarUrl ? (
                    <img src={chat.avatarUrl} alt={chat.name} className="h-full w-full object-cover rounded-2xl" />
                  ) : chat.isGroup ? (
                    <FaUsers className="w-6 h-6 text-white" />
                  ) : (
                    <FaUser className="w-6 h-6 text-white" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-semibold text-gray-900 truncate">{chat.name}</span>
                    <span className="text-xs text-gray-500 shrink-0">{chat.time}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600 truncate">{chat.lastMessage}</span>
                      {chat.isGroup && (
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full font-medium">
                          {chat.memberCount} members
                        </span>
                      )}
                    </div>
                    {chat.unread > 0 && (
                      <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-blue-500 px-2 text-xs font-semibold text-white">
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
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-3xl flex items-center justify-center mb-6">
              <FaComments className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              {searchQuery ? 'No chats found' : 'No chats yet'}
            </h3>
            <p className="text-gray-600 text-sm mb-6">
              {searchQuery ? 'Try a different search' : 'Create a chat to start messaging'}
            </p>
            <button
              onClick={() => setShowCreateGroup(true)}
              className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold rounded-xl transition-all cursor-pointer"
            >
              Start New Chat
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default ChatList;