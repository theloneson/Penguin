import { useMessagingClient } from '../providers/MessagingClientProvider';
import { useSessionKey } from '../providers/SessionKeyProvider';
import { useSignAndExecuteTransaction, useCurrentAccount, useSuiClient, useSuiClientContext } from '@mysten/dapp-kit';
import { useState, useCallback, useEffect, useRef } from 'react';
import { Transaction } from '@mysten/sui/transactions';
import { MESSAGING_PACKAGE_ID, SUI_CLOCK_OBJECT_ID } from '../config/messaging';
import { DecryptedChannelObject, DecryptMessageResult, ChannelMessagesDecryptedRequest } from '@mysten/messaging';
import { clearOwnedSuinsCache, getOwnedSuinsByObjectId, normalizeSuinsName, OwnedSuinsEntry, setOwnedSuinsCache } from '../lib/utils';

export const useMessaging = () => {
  const messagingClient = useMessagingClient();
  const { sessionKey, isInitializing, error } = useSessionKey();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  const currentAccount = useCurrentAccount();
  const suiClient = useSuiClient();
  const { network: clientNetwork } = useSuiClientContext();

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
  const memberCapsCacheRef = useRef<{
    data: Array<{ channelId: string; memberCapId: string }>;
    timestamp: number;
  } | null>(null);
  const memberCapsPendingRef = useRef<Promise<Array<{ channelId: string; memberCapId: string }>> | null>(null);

  const MEMBER_CAP_CACHE_TTL_MS = 30_000;
  const MEMBER_CAP_MAX_RETRIES = 4;
  const MEMBER_CAP_RETRY_BASE_DELAY_MS = 1_000;

  const sleep = useCallback((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)), []);

  const unwrapAddressOption = useCallback((value: unknown): string | null => {
    if (!value) {
      return null;
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed.startsWith('0x') ? trimmed : null;
    }
    if (typeof value === 'object') {
      const record = value as Record<string, unknown>;
      if (typeof record.Some === 'string') {
        return record.Some.trim();
      }
      if (typeof record.some === 'string') {
        return record.some.trim();
      }
      if (record.fields && typeof record.fields === 'object') {
        const fields = record.fields as Record<string, unknown>;
        if (typeof fields.some === 'string') {
          return fields.some.trim();
        }
        if (typeof fields.value === 'string') {
          return fields.value.trim();
        }
        if (Array.isArray(fields.vec) && typeof fields.vec[0] === 'string') {
          return (fields.vec[0] as string).trim();
        }
      }
      if (typeof record.value === 'string') {
        return record.value.trim();
      }
    }
    return null;
  }, []);

  const getGroupNameObjectId = useCallback((channel: any): string | null => {
    const rawChannel = channel?.data ?? channel;
    const candidates: Array<unknown> = [
      (rawChannel as any)?.group_name_nft,
      rawChannel?.group_name,
      rawChannel?.groupName,
      (rawChannel as any)?.content?.fields?.group_name,
    ];
    for (const candidate of candidates) {
      const address = unwrapAddressOption(candidate);
      if (address) {
        return address.toLowerCase();
      }
    }
    return null;
  }, [unwrapAddressOption]);

  const augmentChannelWithGroupMetadata = useCallback(async (channel: any) => {
    if (!channel) {
      return channel;
    }

    const groupNameObjectId = getGroupNameObjectId(channel);
    if (!groupNameObjectId) {
      return channel;
    }

    const rawChannel = channel?.data ?? channel;
    const metadata = (rawChannel?.metadata ?? rawChannel?.data?.metadata) as Record<string, unknown> | undefined;
    const metadataNameCandidates: Array<unknown> = [
      metadata?.group_name,
      metadata?.groupName,
      metadata?.name,
      metadata?.display_name,
      rawChannel?.group_name,
      rawChannel?.groupName,
      (channel as any)?.group_name_label,
    ];

    const metadataName = metadataNameCandidates.find(
      (value): value is string => typeof value === 'string' && value.trim().length > 0,
    );
    const normalizedFromMetadata =
      metadataName && metadataName.includes('.sui') ? normalizeSuinsName(metadataName) : null;

    const ownedEntry = getOwnedSuinsByObjectId(groupNameObjectId);
    const normalizedFromCache =
      typeof (channel as any)?.group_name_normalized === 'string'
        ? normalizeSuinsName((channel as any).group_name_normalized)
        : null;

    const nameCandidates: Array<string | null | undefined> = [
      ownedEntry?.normalizedName,
      normalizedFromCache,
      normalizedFromMetadata,
      metadataName,
      (channel as any)?.group_name_label,
    ];

    const resolvedName = nameCandidates.find(
      (value): value is string => typeof value === 'string' && value.trim().length > 0,
    );

    return {
      ...channel,
      groupMetadata: {
        name: resolvedName ?? groupNameObjectId,
        normalizedName:
          (resolvedName && resolvedName.includes('.sui')
            ? normalizeSuinsName(resolvedName)
            : null) ?? ownedEntry?.normalizedName ?? normalizedFromMetadata ?? undefined,
        nftId: groupNameObjectId,
        expiresAt: ownedEntry?.expiresAt ?? (channel as any)?.group_name_expires_at,
        address: groupNameObjectId,
      },
    };
  }, [getGroupNameObjectId]);

  const fetchOwnedMemberCaps = useCallback(async (): Promise<Array<{ channelId: string; memberCapId: string }>> => {
    if (!currentAccount?.address) {
      clearOwnedSuinsCache();
      memberCapsCacheRef.current = null;
      memberCapsPendingRef.current = null;
      return [];
    }

    const cached = memberCapsCacheRef.current;
    const now = Date.now();
    if (cached && now - cached.timestamp < MEMBER_CAP_CACHE_TTL_MS) {
      return cached.data;
    }

    if (memberCapsPendingRef.current) {
      return memberCapsPendingRef.current;
    }

    const memberCapType = `${MESSAGING_PACKAGE_ID}::member_cap::MemberCap`;
    const fetchPromise = (async () => {
      for (let attempt = 0; attempt < MEMBER_CAP_MAX_RETRIES; attempt++) {
        try {
          const ownedCaps: Array<{ channelId: string; memberCapId: string }> = [];
          const ownedSuinsMap = new Map<string, OwnedSuinsEntry>();
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

          const suinsStructTypes =
            clientNetwork === 'mainnet'
              ? [
                  '0xd22b24490e0bae52676651b4f56660a5ff8022a2576e0089f79b3c88d44e08f0::suins_registration::SuinsRegistration',
                ]
              : clientNetwork === 'testnet'
              ? [
                  '0x22fa05f21b1ad71442491220bb9338f7b7095fe35000ef88d5400d28523bdd93::suins_registration::SuinsRegistration',
                ]
              : [];

          for (const structType of suinsStructTypes) {
            let suinsCursor: string | null = null;
            do {
              const response = await suiClient.getOwnedObjects({
                owner: currentAccount.address,
                filter: { StructType: structType },
                cursor: suinsCursor,
                limit: 50,
                options: { showContent: true },
              });

              for (const item of response.data ?? []) {
                const objectId = item.data?.objectId;
                const fields = (item.data?.content as any)?.fields;
                const domainName = fields?.domain_name as string | undefined;
                if (objectId && domainName) {
                  const normalized = normalizeSuinsName(domainName);
                  if (!ownedSuinsMap.has(normalized)) {
                    ownedSuinsMap.set(normalized, {
                      owner: currentAccount.address.toLowerCase(),
                      normalizedName: normalized,
                      objectId,
                      expiresAt: fields?.expiration_timestamp_ms
                        ? Number(fields.expiration_timestamp_ms)
                        : undefined,
                    });
                  }
                }
              }

              suinsCursor = response.hasNextPage ? response.nextCursor ?? null : null;
            } while (suinsCursor);
          }

          const result = ownedCaps;
          memberCapsCacheRef.current = { data: result, timestamp: Date.now() };
          setOwnedSuinsCache(
            currentAccount.address,
            Array.from(ownedSuinsMap.values()),
          );
          return result;
        } catch (err) {
          const status =
            (err as any)?.response?.status ??
            (err as any)?.status ??
            (err as any)?.cause?.response?.status;
          if (status === 429 && attempt < MEMBER_CAP_MAX_RETRIES - 1) {
            const delay =
              MEMBER_CAP_RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
            await sleep(delay);
            continue;
          }
          console.error('Failed to fetch owned member caps:', err);
          break;
        }
      }

      if (cached) {
        return cached.data;
      }

      return [];
    })();

    memberCapsPendingRef.current = fetchPromise;
    try {
      return await fetchPromise;
    } finally {
      memberCapsPendingRef.current = null;
    }
  }, [clientNetwork, currentAccount?.address, memberCapsCacheRef, memberCapsPendingRef, sleep, suiClient]);

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

      const augmented = await Promise.all(
        filtered.map((channel: any) => augmentChannelWithGroupMetadata(channel)),
      );

      setChannels(augmented as DecryptedChannelObject[]);
    } catch (err) {
      const errorMsg = err instanceof Error ? `[fetchChannels] ${err.message}` : '[fetchChannels] Failed to fetch channels';
      setChannelError(errorMsg);
      console.error('Error fetching channels:', err);
    } finally {
      setIsFetchingChannels(false);
    }
  }, [messagingClient, currentAccount, fetchOwnedMemberCaps, augmentChannelWithGroupMetadata]);

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
        const channel = filtered[0];
        const augmentedChannel = await augmentChannelWithGroupMetadata(channel);
        setCurrentChannel(augmentedChannel as DecryptedChannelObject);
        return augmentedChannel as DecryptedChannelObject;
      }
      return null;
    } catch (err) {
      const errorMsg = err instanceof Error ? `[getChannelById] ${err.message}` : '[getChannelById] Failed to fetch channel';
      setChannelError(errorMsg);
      console.error('Error fetching channel:', err);
      return null;
    }
  }, [messagingClient, currentAccount, augmentChannelWithGroupMetadata]);

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
