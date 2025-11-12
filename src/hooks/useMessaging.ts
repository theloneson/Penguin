import { useMessagingClient } from '../providers/MessagingClientProvider';
import { useSessionKey } from '../providers/SessionKeyProvider';
import { useSignAndExecuteTransaction, useCurrentAccount, useSuiClient } from '@mysten/dapp-kit';
import { useState, useCallback, useEffect } from 'react';
import { Transaction } from '@mysten/sui/transactions';
import { MESSAGING_PACKAGE_ID, SUI_CLOCK_OBJECT_ID } from '../config/messaging';
import { DecryptedChannelObject, DecryptMessageResult, ChannelMessagesDecryptedRequest } from '@mysten/messaging';

export const useMessaging = () => {
  const messagingClient = useMessagingClient();
  const { sessionKey, isInitializing, error } = useSessionKey();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  const currentAccount = useCurrentAccount();
  const suiClient = useSuiClient();

  const [channels, setChannels] = useState<DecryptedChannelObject[]>([]);
  const [isCreatingChannel, setIsCreatingChannel] = useState(false);
  const [isFetchingChannels, setIsFetchingChannels] = useState(false);
  const [channelError, setChannelError] = useState<string | null>(null);

  const [currentChannel, setCurrentChannel] = useState<DecryptedChannelObject | null>(null);
  const [messages, setMessages] = useState<DecryptMessageResult[]>([]);
  const [isFetchingMessages, setIsFetchingMessages] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [messagesCursor, setMessagesCursor] = useState<bigint | null>(null);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [memberCapMap, setMemberCapMap] = useState<Record<string, string>>({});

  const fetchOwnedMemberCaps = useCallback(async (): Promise<Array<{ channelId: string; memberCapId: string }>> => {
    if (!currentAccount?.address) {
      return [];
    }

    const memberCapType = `${MESSAGING_PACKAGE_ID}::member_cap::MemberCap`;
    const ownedCaps: Array<{ channelId: string; memberCapId: string }> = [];

    try {
      let cursor: string | null = null;
      do {
        const response = await suiClient.getOwnedObjects({
          owner: currentAccount.address,
          filter: { StructType: memberCapType },
          cursor,
          limit: 50,
          options: { showContent: true },
        });

        for (const item of response.data ?? []) {
          const objectId = item.data?.objectId;
          const fields = (item.data?.content as any)?.fields;
          if (objectId && fields?.channel_id) {
            ownedCaps.push({
              channelId: fields.channel_id,
              memberCapId: objectId,
            });
          }
        }

        cursor = response.hasNextPage ? response.nextCursor ?? null : null;
      } while (cursor);
    } catch (err) {
      console.error('Failed to fetch owned member caps:', err);
    }

    return ownedCaps;
  }, [currentAccount?.address, suiClient]);

  const createChannel = useCallback(async (recipientAddresses: string[]) => {
    if (!messagingClient || !currentAccount) {
      setChannelError('[createChannel] Messaging client or account not available');
      return null;
    }

    setIsCreatingChannel(true);
    setChannelError(null);

    try {
      const flow = messagingClient.createChannelFlow({
        creatorAddress: currentAccount.address,
        initialMemberAddresses: recipientAddresses,
      });

      const channelTx = flow.build();
      const { digest } = await signAndExecute({
        transaction: channelTx,
      });

      const { objectChanges } = await suiClient.waitForTransaction({
        digest,
        options: { showObjectChanges: true },
      });

      const createdChannel = objectChanges?.find(
        (change) => change.type === 'created' && change.objectType?.endsWith('::channel::Channel')
      );

      const channelId = (createdChannel as any)?.objectId;

      const { creatorMemberCap } = await flow.getGeneratedCaps({ digest });

      const attachKeyTx = await flow.generateAndAttachEncryptionKey({
        creatorMemberCap,
      });

      const { digest: finalDigest } = await signAndExecute({
        transaction: attachKeyTx,
      });

      const { effects } = await suiClient.waitForTransaction({
        digest: finalDigest,
        options: { showEffects: true },
      });

      if (effects?.status.status !== 'success') {
        throw new Error('Transaction failed');
      }

      await fetchChannels();

      return { channelId };
    } catch (err) {
      const errorMsg = err instanceof Error ? `[createChannel] ${err.message}` : '[createChannel] Failed to create channel';
      setChannelError(errorMsg);
      console.error('Error creating channel:', err);
      return null;
    } finally {
      setIsCreatingChannel(false);
    }
  }, [messagingClient, currentAccount, signAndExecute, suiClient]);

  const fetchChannels = useCallback(async () => {
    if (!messagingClient || !currentAccount) {
      return;
    }

    setIsFetchingChannels(true);
    setChannelError(null);

    try {
      const ownedMemberCaps = await fetchOwnedMemberCaps();
      if (ownedMemberCaps.length === 0) {
        setMemberCapMap({});
        setChannels([]);
        return;
      }

      const capMap: Record<string, string> = {};
      ownedMemberCaps.forEach(({ channelId, memberCapId }) => {
        if (!capMap[channelId]) {
          capMap[channelId] = memberCapId;
        }
      });
      setMemberCapMap(capMap);

      const channelIds = Array.from(new Set(ownedMemberCaps.map(({ channelId }) => channelId)));
      const response = await messagingClient.getChannelObjectsByChannelIds({
        channelIds,
        userAddress: currentAccount.address,
      });

      const filtered = response.filter((channel: any) => {
        const typeString = channel?.type ?? channel?.data?.type;
        return typeof typeString === 'string'
          ? typeString.startsWith(`${MESSAGING_PACKAGE_ID}::channel::Channel`)
          : true;
      });

      setChannels(filtered);
    } catch (err) {
      const errorMsg = err instanceof Error ? `[fetchChannels] ${err.message}` : '[fetchChannels] Failed to fetch channels';
      setChannelError(errorMsg);
      console.error('Error fetching channels:', err);
    } finally {
      setIsFetchingChannels(false);
    }
  }, [messagingClient, currentAccount, fetchOwnedMemberCaps]);

  const getChannelById = useCallback(async (channelId: string) => {
    if (!messagingClient || !currentAccount) {
      return null;
    }

    setChannelError(null);

    try {
      const response = await messagingClient.getChannelObjectsByChannelIds({
        channelIds: [channelId],
        userAddress: currentAccount.address,
      });

      const filtered = response.filter((channel: any) => {
        const typeString = channel?.type ?? channel?.data?.type;
        return typeof typeString === 'string'
          ? typeString.startsWith(`${MESSAGING_PACKAGE_ID}::channel::Channel`)
          : true;
      });

      if (filtered.length > 0) {
        setCurrentChannel(filtered[0]);
        return filtered[0];
      }
      return null;
    } catch (err) {
      const errorMsg = err instanceof Error ? `[getChannelById] ${err.message}` : '[getChannelById] Failed to fetch channel';
      setChannelError(errorMsg);
      console.error('Error fetching channel:', err);
      return null;
    }
  }, [messagingClient, currentAccount]);

  const fetchMessages = useCallback(async (channelId: string, cursor: bigint | null = null) => {
    if (!messagingClient || !currentAccount) {
      return;
    }

    setIsFetchingMessages(true);
    setChannelError(null);

    try {
      const response = await messagingClient.getChannelMessages({
        channelId,
        userAddress: currentAccount.address,
        cursor,
        limit: 20,
        direction: 'backward',
      });

      if (cursor === null) {
        setMessages(response.messages);
      } else {
        setMessages(prev => [...response.messages, ...prev]);
      }

      setMessagesCursor(response.cursor);
      setHasMoreMessages(response.hasNextPage);
    } catch (err) {
      const errorMsg = err instanceof Error ? `[fetchMessages] ${err.message}` : '[fetchMessages] Failed to fetch messages';
      setChannelError(errorMsg);
      console.error('Error fetching messages:', err);
    } finally {
      setIsFetchingMessages(false);
    }
  }, [messagingClient, currentAccount]);

  const getMemberCapForChannel = useCallback(async (channelId: string) => {
    if (!currentAccount) {
      return null;
    }

    if (memberCapMap[channelId]) {
      return memberCapMap[channelId];
    }

    const ownedMemberCaps = await fetchOwnedMemberCaps();
    const updatedMap: Record<string, string> = { ...memberCapMap };
    ownedMemberCaps.forEach(({ channelId: id, memberCapId }) => {
      if (!updatedMap[id]) {
        updatedMap[id] = memberCapId;
      }
    });
    setMemberCapMap(updatedMap);

    return updatedMap[channelId] ?? null;
  }, [currentAccount, memberCapMap, fetchOwnedMemberCaps]);

  const getEncryptedKeyForChannel = useCallback(async (channelId: string) => {
    if (!currentChannel || currentChannel.id.id !== channelId) {
      const channel = await getChannelById(channelId);
      if (!channel) return null;
    }

    const channel = currentChannel || (await getChannelById(channelId));
    if (!channel) return null;

    let rawEncryptedKeyBytes = channel.encryption_key_history.latest;
    let keyVersion = channel.encryption_key_history.latest_version;

    if (!rawEncryptedKeyBytes || (Array.isArray(rawEncryptedKeyBytes) && rawEncryptedKeyBytes.length === 0)) {
      await fetchChannels();
      const refreshed = await getChannelById(channelId);
      if (!refreshed) return null;
      rawEncryptedKeyBytes = refreshed.encryption_key_history.latest;
      keyVersion = refreshed.encryption_key_history.latest_version;
      if (!rawEncryptedKeyBytes || (Array.isArray(rawEncryptedKeyBytes) && rawEncryptedKeyBytes.length === 0)) {
        console.warn(
          `[getEncryptedKeyForChannel] Channel ${channelId} still has no encrypted session key after refresh.`,
        );
        return null;
      }
    }

    const encryptedKeyBytes = Array.isArray(rawEncryptedKeyBytes)
      ? new Uint8Array(rawEncryptedKeyBytes)
      : new Uint8Array(rawEncryptedKeyBytes as ArrayLike<number>);

    return {
      $kind: 'Encrypted' as const,
      encryptedBytes: encryptedKeyBytes,
      version: keyVersion,
    } as ChannelMessagesDecryptedRequest['encryptedKey'];
  }, [currentChannel, getChannelById, fetchChannels]);

  const getCreatorCapForChannel = useCallback(async (channelId: string) => {
    if (!currentAccount?.address) {
      return null;
    }

    try {
      const creatorCapType = `${MESSAGING_PACKAGE_ID}::creator_cap::CreatorCap`;
      const { data } = await suiClient.getOwnedObjects({
        owner: currentAccount.address,
        filter: { StructType: creatorCapType },
        options: { showContent: true, showType: true },
      });

      for (const item of data ?? []) {
        const objectId = item.data?.objectId;
        const fields = (item.data?.content as any)?.fields;
        const typeString = item.data?.type;
        if (fields?.channel_id === channelId && typeof typeString === 'string' && typeString.startsWith(creatorCapType)) {
          return objectId ?? null;
        }
      }
    } catch (err) {
      console.error('Error getting creator cap:', err);
    }

    return null;
  }, [currentAccount?.address, suiClient]);

  const sendMessage = useCallback(async (channelId: string, message: string, attachments?: File[]) => {
    if (!messagingClient || !currentAccount) {
      setChannelError('[sendMessage] Messaging client or account not available');
      return null;
    }

    setIsSendingMessage(true);
    setChannelError(null);

    try {
      const memberCapId = await getMemberCapForChannel(channelId);
      if (!memberCapId) {
        throw new Error('No member cap found for channel');
      }

      const encryptedKey = await getEncryptedKeyForChannel(channelId);
      if (!encryptedKey) {
        throw new Error('Channel not initialized with a session key. Please sign the session key before sending messages.');
      }

      const tx = new Transaction();
      const sendMessageTxBuilder = await messagingClient.sendMessage(
        channelId,
        memberCapId,
        currentAccount.address,
        message,
        encryptedKey,
        attachments,
      );
      await sendMessageTxBuilder(tx);

      const { digest } = await signAndExecute({ transaction: tx });

      await suiClient.waitForTransaction({
        digest,
        options: { showEffects: true },
      });

      await fetchMessages(channelId);

      return { digest };
    } catch (err) {
      const errorMsg = err instanceof Error ? `[sendMessage] ${err.message}` : '[sendMessage] Failed to send message';
      setChannelError(errorMsg);
      console.error('Error sending message:', err);
      return null;
    } finally {
      setIsSendingMessage(false);
    }
  }, [messagingClient, currentAccount, signAndExecute, suiClient, getMemberCapForChannel, getEncryptedKeyForChannel, fetchMessages]);

  const setChannelGroupName = useCallback(async (channelId: string, nftId: string) => {
    if (!messagingClient || !currentAccount) {
      setChannelError('[setChannelGroupName] Messaging client or account not available');
      return null;
    }

    setChannelError(null);

    try {
      const creatorCapId = await getCreatorCapForChannel(channelId);
      if (!creatorCapId) {
        throw new Error('Creator cap not found for this channel');
      }

      const tx = new Transaction();
      tx.moveCall({
        target: `${MESSAGING_PACKAGE_ID}::channel::set_group_name`,
        arguments: [
          tx.object(channelId),
          tx.object(creatorCapId),
          tx.pure.address(nftId),
          tx.object(SUI_CLOCK_OBJECT_ID),
        ],
      });

      const { digest } = await signAndExecute({ transaction: tx });
      await suiClient.waitForTransaction({
        digest,
        options: { showEffects: true },
      });

      await getChannelById(channelId);
      return { digest };
    } catch (err) {
      const errorMsg = err instanceof Error ? `[setChannelGroupName] ${err.message}` : '[setChannelGroupName] Failed to set group name';
      setChannelError(errorMsg);
      console.error('Error setting channel group name:', err);
      return null;
    }
  }, [messagingClient, currentAccount, getCreatorCapForChannel, signAndExecute, suiClient, getChannelById]);

  useEffect(() => {
    if (messagingClient && currentAccount) {
      fetchChannels();
      const interval = setInterval(fetchChannels, 10000);
      return () => clearInterval(interval);
    }
  }, [messagingClient, currentAccount, sessionKey, fetchChannels]);

  return {
    client: messagingClient,
    sessionKey,
    isInitializing,
    error,
    isReady: !!messagingClient && !!sessionKey,

    channels,
    createChannel,
    fetchChannels,
    isCreatingChannel,
    isFetchingChannels,
    channelError,

    currentChannel,
    messages,
    getChannelById,
    fetchMessages,
    sendMessage,
    setChannelGroupName,
    getCreatorCapForChannel,
    isFetchingMessages,
    isSendingMessage,
    messagesCursor,
    hasMoreMessages,
  };
};
