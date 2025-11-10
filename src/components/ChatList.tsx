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
      
      const hasAttachment =
        channel.last_message?.attachments &&
        channel.last_message.attachments.length > 0;

      return {
        id: channel.id.id,
        name: displayName,
        lastMessage: hasAttachment
          ? '[Attachment]'
          : channel.last_message?.text || 'No messages yet',
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
    <div className="w-full h-full text-black bg-white border-r-4 border-black">
      <div className="px-6 py-4 sticky top-0 z-10 bg-white border-b-4 border-black">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-vibrant-blue border-4 border-black flex items-center justify-center">
              <FaComments className="w-6 h-6 text-black" />
            </div>
            <div className="text-2xl font-black italic text-black">CHATS</div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowCreateGroup(true)}
              className="p-3 rounded-full cursor-pointer bg-vibrant-purple border-4 border-black hover:bg-vibrant-pink transition-colors"
            >
              <PlusIcon className="w-5 h-5 text-black"/>
            </button>
            <button onClick={()=>disconnect()} className="p-3 rounded-full cursor-pointer bg-vibrant-orange border-4 border-black hover:bg-vibrant-yellow transition-colors">
              <FaDoorOpen className="w-5 h-5 text-black"/>
            </button>
          </div>
        </div>
        <div className="relative my-4">
          <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
            <MagnifyingGlassIcon className="w-5 h-5 text-black"/>
          </div>
          <input
            type="text"
            placeholder="Search chats or enter Sui address/SuiNS name"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setValidationError(""); setValidStatus("idle")}}
            className="w-full p-3 titillium-web-bold pl-12 rounded-full bg-vibrant-mint text-black placeholder-black/60 border-4 
                      border-black focus:bg-vibrant-yellow hover:bg-vibrant-yellow/50 transition-colors outline-none"
          />
        </div>
          {searchQuery && (
            <div className="mt-1 text-sm font-bold">
              {validStatus === 'resolving' && 
                <span className="text-black flex items-center gap-2">
                  <FaSpinner className="w-4 h-4 animate-spin" /> Resolving…
                </span>
              }
              {validStatus === 'valid' && (
                <div className="flex items-center justify-between bg-vibrant-green rounded-full p-2 border-4 border-black">
                  <span className="text-black">
                    ✓ Valid&nbsp;
                    {resolvedAddress && resolvedAddress !== searchQuery && (
                      <span className="opacity-70">({resolvedAddress.slice(0, 6)}…{resolvedAddress.slice(-4)})</span>
                    )}
                  </span>
                  <button
                    onClick={() => handleCreateSingleChat(searchQuery.trim())}
                    disabled={!isReady || isCreatingChannel || validStatus !== 'valid'}
                    className="px-4 py-2 bg-vibrant-purple hover:bg-vibrant-blue text-black text-sm font-black rounded-full border-2 border-black disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Start Chat
                  </button>
                </div>
              )}
              {validStatus === 'invalid' && <span className="text-vibrant-orange bg-vibrant-yellow rounded-full px-3 py-1 border-4 border-black inline-block">✗ Invalid Sui address / name</span>}
              {validationError && (
                <div className="mt-1 text-sm text-vibrant-orange bg-vibrant-yellow rounded-full px-3 py-1 border-4 border-black inline-block">✗ {validationError}</div>
              )}
            </div>
          )}
        <div className="mt-4">
          <div className="flex gap-2">
            <button 
              className={`px-6 py-3 cursor-pointer text-sm font-black rounded-full transition-colors border-4 border-black ${
                activeFilter === 'all' 
                  ? 'bg-vibrant-purple text-black' 
                  : 'bg-white text-black hover:bg-vibrant-mint'
              }`}
              onClick={() => setActiveFilter('all')}
            >
              ALL
            </button>
            <button 
              className={`px-6 py-3 cursor-pointer text-sm font-black rounded-full transition-colors border-4 border-black ${
                activeFilter === 'groups' 
                  ? 'bg-vibrant-orange text-black' 
                  : 'bg-white text-black hover:bg-vibrant-yellow'
              }`}
              onClick={() => setActiveFilter('groups')}
            >
              GROUPS
            </button>
          </div>
        </div>

        {showCreateGroup && (
          <div className="mt-4 p-4 bg-vibrant-blue rounded-[2rem] border-4 border-black">
            <form onSubmit={handleCreateGroupWithTags}>
              <div className="mb-3">
                <label className="block text-lg font-black italic text-black mb-3 text-center">
                  CREATE A GROUP
                </label>
                <p className="text-sm font-bold text-black/70 mb-3 text-center">Add at least 2 addresses</p>
                
                {addressTags.length > 0 && (
                  <div className="mb-3 flex justify-center flex-wrap gap-2">
                    {addressTags.map((address, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 bg-white text-black px-3 py-2 rounded-full text-sm font-bold border-4 border-black"
                      >
                        <span className="font-mono">{address.slice(0, 5)}...{address.slice(-5)}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveAddress(address)}
                          className="bg-vibrant-orange hover:bg-vibrant-yellow text-black transition-colors rounded-full w-6 h-6 flex items-center justify-center border-2 border-black cursor-pointer font-black"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                
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
                    className="flex-1 p-3 rounded-full bg-white text-black placeholder-black/60 border-4 border-black focus:outline-none font-bold"
                    disabled={!isReady || isCreatingChannel}
                  />
                  <button
                    type="button"
                    onClick={handleAddAddress}
                    disabled={!currentAddressInput.trim() || !isReady || isCreatingChannel}
                    className="px-6 py-3 bg-vibrant-purple hover:bg-vibrant-pink text-black text-sm font-black rounded-full cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed border-4 border-black"
                  >
                    ADD
                  </button>
                </div>
                {validationError && (
                  <div className="mt-2 text-sm font-bold text-black bg-vibrant-yellow rounded-full px-3 py-1 border-4 border-black inline-block">{validationError}</div>
                )}
              </div>
              
              {channelError && (
                <div className="mb-3 text-sm font-bold text-black bg-vibrant-yellow rounded-full px-3 py-1 border-4 border-black inline-block">Error: {channelError}</div>
              )}
              
              <div className="flex gap-2 justify-center">
                <button
                  type="submit"
                  disabled={!isReady || isCreatingChannel || addressTags.length < 2}
                  className="px-6 py-3 bg-vibrant-green hover:bg-vibrant-mint text-black text-sm font-black rounded-full cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed border-4 border-black"
                >
                  {isCreatingChannel ? 'CREATING...' : `CREATE GROUP (${addressTags.length})`}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateGroup(false);
                    setAddressTags([]);
                    setCurrentAddressInput('');
                    setValidationError(null);
                  }}
                  className="px-6 py-3 bg-white hover:bg-vibrant-yellow text-black text-sm font-black rounded-full cursor-pointer border-4 border-black"
                >
                  CANCEL
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
      <ul className="list-none m-0 p-0">
        {chatItems.map((chat) => (
          <motion.li
            key={chat.id}
            className={`flex items-center gap-4 px-6 py-4 hover:bg-vibrant-mint cursor-pointer transition-all duration-200 ease-out group border-b-4 border-black ${
              selectedChatId === chat.id ? 'bg-vibrant-yellow' : 'bg-white'
            }`}
            onClick={() => onSelect?.(chat.id)}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
          >
            <div className="h-14 w-14 rounded-full bg-vibrant-purple flex items-center justify-center overflow-hidden border-4 border-black group-hover:bg-vibrant-pink transition-colors">
              {chat.avatarUrl ? (
                <img src={chat.avatarUrl} alt={chat.name} className="h-full w-full object-cover" />
              ) : chat.isGroup ? (
                <FaUsers className="w-6 h-6 text-black transition-colors" />
              ) : (
                <FaUser className="w-5 h-5 text-black transition-colors" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="font-black text-black truncate text-base">{chat.name}</span>
                <span className="text-xs text-black/70 ml-2 shrink-0 font-bold">{chat.time}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-black/80 truncate font-medium">{chat.lastMessage}</span>
                  {chat.isGroup && (
                    <span className="text-xs text-black bg-vibrant-orange px-3 py-1 rounded-full font-bold border-2 border-black">
                      {chat.memberCount}
                    </span>
                  )}
                </div>
                {chat.unread ? (
                  <span className="ml-2 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-vibrant-orange border-2 border-black px-2 text-xs font-black text-black">
                    {chat.unread}
                  </span>
                ) : null}
              </div>
            </div>
          </motion.li>
        ))}
        
        {/* empty state */}
        {chatItems.length === 0 && !showCreateGroup && !isNewAddress && (
          <div className="px-6 py-12 text-center">
            <div className="w-16 h-16 bg-vibrant-blue rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-black">
              <FaComments className="w-8 h-8 text-black" />
            </div>
            <p className="text-black text-lg font-black italic">
              {searchQuery ? 'NO CHATS FOUND' : 'NO CHATS YET'}
            </p>
            <p className="text-black/70 text-sm font-bold mt-2">
              {searchQuery ? 'Try a different search' : 'Create one to start messaging!'}
            </p>
          </div>
        )}
      </ul>
    </div>
  );
}

export default ChatList;
