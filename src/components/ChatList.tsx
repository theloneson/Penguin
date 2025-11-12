import { motion, AnimatePresence } from 'framer-motion';
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

  // [KEEP ALL YOUR ORIGINAL LOGIC EXACTLY THE SAME]
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      if (validationTimeoutRef.current) {
        clearTimeout(validationTimeoutRef.current);
      }
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
        unread: Math.floor(Math.random() * 3),
        avatarUrl: undefined,
        isGroup,
        memberCount,
        online: Math.random() > 0.3
      };
    });

  return (
    // UPDATED: Main ChatList container now acts as a white card on top of the global gradient
    <div className="w-full h-full relative flex flex-col bg-white shadow-lg">
      <div className="relative z-10 flex flex-col h-full">
        {/* Header */}
        <motion.div
          className="p-4"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <motion.div
                className="w-10 h-10 rounded-full flex items-center justify-center text-gray-700 hover:bg-gray-100 transition-colors"
                whileTap={{ scale: 0.90 }}
              >
                <FaComments className="w-5 h-5" />
              </motion.div>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">Penguin</h1>
                <p className="text-sm text-gray-600">Ice-cool messaging</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <motion.button
                onClick={() => setShowCreateGroup(true)}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.90 }}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
                className="p-2 rounded-full text-gray-600 hover:bg-gray-100 transition-colors duration-150 cursor-pointer"
                aria-label="Create group"
                title="Create group"
              >
                <PlusIcon className="w-5 h-5" />
              </motion.button>
              <motion.button
                onClick={() => disconnect()}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.90 }}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
                className="p-2 rounded-full text-gray-600 hover:bg-gray-100 transition-colors duration-150 cursor-pointer"
                aria-label="Disconnect wallet"
                title="Disconnect wallet"
              >
                <FaDoorOpen className="w-5 h-5" />
              </motion.button>
            </div>
          </div>

          {/* Search Bar */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="relative mb-4"
          >
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <MagnifyingGlassIcon className="w-5 h-5 text-gray-500" />
            </div>
            {/* Search bar background remains light grey for contrast within the white card */}
            <input
              type="text"
              placeholder="Search chats or enter Sui address/SuiNS name..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setValidationError(""); setValidStatus("idle") }}
              className="w-full p-2.5 pl-10 bg-gray-100 text-gray-900 placeholder-gray-500 rounded-lg border-none outline-none focus:bg-gray-200 focus:ring-0 transition-colors duration-150"
            />
          </motion.div>

          {/* Search Results */}
          <AnimatePresence>
            {searchQuery && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-4 overflow-hidden"
              >
                {validStatus === 'resolving' &&
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex items-center gap-3 p-3 rounded-lg bg-gray-100"
                  >
                    <FaSpinner className="w-4 h-4 animate-spin text-gray-600" />
                    <span className="text-sm text-gray-700">Resolving SuiNS name...</span>
                  </motion.div>
                }
                {validStatus === 'valid' && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-between p-3 rounded-lg bg-gray-100"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                      <span className="text-sm text-gray-900">Valid address
                        {resolvedAddress && resolvedAddress !== searchQuery && (
                          <span className="text-gray-600 ml-1 text-xs">({resolvedAddress.slice(0, 6)}…{resolvedAddress.slice(-4)})</span>
                        )}
                      </span>
                    </div>
                    <motion.button
                      onClick={() => handleCreateSingleChat(searchQuery.trim())}
                      disabled={!isReady || isCreatingChannel || validStatus !== 'valid'}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      transition={{ type: "spring", stiffness: 400, damping: 17 }}
                      className="px-3 py-1.5 bg-[#6D58E2] hover:bg-[#5850A2] text-white text-sm rounded-md shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150 cursor-pointer"
                    >
                      Start Chat
                    </motion.button>
                  </motion.div>
                )}
                {validStatus === 'invalid' && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-2 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800"
                  >
                    <div className="w-2 h-2 bg-rose-500 rounded-full"></div>
                    <span className="text-sm">Invalid address or name</span>
                  </motion.div>
                )}
                {validationError && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800"
                  >
                    {validationError}
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Filter Tabs */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="flex gap-2"
          >
            <motion.button
              onClick={() => setActiveFilter('all')}
              whileTap={{ scale: 0.95 }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
              className={`flex-1 py-2 px-4 rounded-lg font-medium text-sm transition-all duration-150 cursor-pointer ${activeFilter === 'all'
                  ? 'bg-[#6D58E2] text-white shadow-sm'
                  : 'bg-transparent text-gray-600 hover:bg-gray-100' // Subtle hover for inactive
                }`}
            >
              All Chats
            </motion.button>
            <motion.button
              onClick={() => setActiveFilter('groups')}
              whileTap={{ scale: 0.95 }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
              className={`flex-1 py-2 px-4 rounded-lg font-medium text-sm transition-all duration-150 cursor-pointer ${activeFilter === 'groups'
                  ? 'bg-[#6D58E2] text-white shadow-sm'
                  : 'bg-transparent text-gray-600 hover:bg-gray-100' // Subtle hover for inactive
                }`}
            >
              Groups
            </motion.button>
          </motion.div>
        </motion.div>

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto px-2 custom-scrollbar">
          <div className="space-y-0.5 pb-4">
            <AnimatePresence>
              {chatItems.map((chat, index) => {
                const isSelected = selectedChatId === chat.id;
                return (
                  <motion.button
                    key={chat.id}
                    onClick={() => onSelect?.(chat.id)}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.02 }}
                    // UPDATED: Hover now adds a bg-gray-100 and a subtle shadow
                    whileHover={{ scale: 1.01, boxShadow: "0px 2px 8px rgba(0, 0, 0, 0.05)" }}
                    whileTap={{ scale: 0.99, boxShadow: "0px 1px 4px rgba(0, 0, 0, 0.03)" }}
                    className={`w-full p-3 rounded-lg flex items-center gap-3 transition-all duration-100 cursor-pointer text-left
                      ${isSelected
                        ? 'bg-[#6D58E2] shadow-sm' // Selected: Brand purple background with small shadow
                        : 'bg-transparent hover:bg-gray-100' // Default: Transparent, Hover: Light grey background (shadow from whileHover)
                      }`}
                  >
                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                      <div
                        className={`w-12 h-12 rounded-full flex items-center justify-center ${isSelected ? "bg-white" : "bg-gray-300"
                          }`}
                      >
                        {chat.avatarUrl ? (
                          <img src={chat.avatarUrl} alt={chat.name} className="w-full h-full rounded-full object-cover" />
                        ) : chat.isGroup ? (
                          <FaUsers className={`w-5 h-5 ${isSelected ? "text-[#6D58E2]" : "text-white"}`} />
                        ) : (
                          <FaUser className={`w-5 h-5 ${isSelected ? "text-[#6D58E2]" : "text-white"}`} />
                        )}
                      </div>
                      {!chat.isGroup && chat.online && (
                        <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white" />
                      )}
                    </div>

                    {/* Chat Info */}
                    <div className="flex-1 text-left overflow-hidden min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className={`font-medium truncate pr-2 ${isSelected ? "text-white" : "text-gray-900"}`}>{chat.name}</span>
                        <span className={`text-xs flex-shrink-0 ${isSelected ? "text-white/80" : "text-gray-500"}`}>{chat.time}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm truncate ${isSelected ? "text-white/80" : "text-gray-600"}`}>{chat.lastMessage}</span>
                          {chat.isGroup && (
                            <span className={`text-xs px-2 py-0.5 rounded-full ${isSelected ? "bg-white/20 text-white/90" : "bg-gray-200 text-gray-600"
                              }`}>
                              {chat.memberCount}
                            </span>
                          )}
                        </div>
                        {chat.unread > 0 && (
                          <div className={`rounded-full px-2 py-0.5 text-xs font-medium min-w-[20px] text-center ${isSelected ? "bg-white text-[#6D58E2]" : "bg-[#6D58E2] text-white"
                            }`}>
                            {chat.unread}
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.button>
                )
              })}
            </AnimatePresence>
          </div>
        </div>

        {/* Create Group Modal (Professional White) */}
        <AnimatePresence>
          {showCreateGroup && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-20 bg-white flex flex-col rounded-t-xl shadow-2xl"
            >
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-6 border-b border-gray-200"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">Create Group</h2>
                    <p className="text-gray-600 mt-1">Add at least 2 addresses</p>
                  </div>
                  <motion.button
                    onClick={() => {
                      setShowCreateGroup(false);
                      setAddressTags([]);
                      setCurrentAddressInput('');
                      setValidationError(null);
                    }}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    className="p-2 rounded-full text-gray-500 hover:bg-gray-100 transition-colors cursor-pointer"
                  >
                    <div className="w-5 h-5">×</div>
                  </motion.button>
                </div>
              </motion.div>

              <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">
                {/* Address Tags */}
                {addressTags.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="mb-6"
                  >
                    <h3 className="text-sm font-medium text-gray-900 mb-3">Members ({addressTags.length})</h3>
                    <div className="flex flex-wrap gap-2">
                      {addressTags.map((address, index) => (
                        <motion.div
                          key={index}
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: index * 0.1 }}
                          className="flex items-center gap-2 bg-gray-100 text-gray-700 px-3 py-1.5 rounded-full text-sm"
                        >
                          <span className="font-mono text-xs">{address.slice(0, 6)}...{address.slice(-4)}</span>
                          <motion.button
                            type="button"
                            onClick={() => handleRemoveAddress(address)}
                            whileHover={{ scale: 1.1 }}
                            className="text-gray-500 hover:text-gray-800 transition-colors cursor-pointer"
                          >
                            ×
                          </motion.button>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* Add Address Input */}
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-gray-900 mb-3">Add Member</h3>
                  <div className="flex gap-2">
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
                      className="flex-1 p-3 bg-gray-100 text-gray-900 placeholder-gray-500 border-none rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6D58E2] transition-all duration-200"
                      disabled={!isReady || isCreatingChannel}
                    />
                    <motion.button
                      type="button"
                      onClick={handleAddAddress}
                      disabled={!currentAddressInput.trim() || !isReady || isCreatingChannel}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      transition={{ type: "spring", stiffness: 400, damping: 17 }}
                      className="px-4 py-3 bg-[#6D58E2] hover:bg-[#5850A2] text-white text-sm rounded-lg shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 cursor-pointer"
                    >
                      Add
                    </motion.button>
                  </div>
                </div>

                {validationError && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-6 p-3 bg-rose-50 text-rose-700 rounded-lg border border-rose-200 text-sm"
                  >
                    {validationError}
                  </motion.div>
                )}

                {channelError && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-6 p-3 bg-rose-50 text-rose-700 rounded-lg border border-rose-200 text-sm"
                  >
                    Error: {channelError}
                  </motion.div>
                )}
              </div>

              <div className="p-6 border-t border-gray-200">
                <motion.button
                  type="button"
                  onClick={handleCreateGroupWithTags}
                  disabled={!isReady || isCreatingChannel || addressTags.length < 2}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ type: "spring", stiffness: 400, damping: 17 }}
                  className="w-full py-3 bg-[#6D58E2] hover:bg-[#5850A2] text-white rounded-lg shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 cursor-pointer"
                >
                  {isCreatingChannel ? 'Creating...' : `Create Group (${addressTags.length})`}
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default ChatList;