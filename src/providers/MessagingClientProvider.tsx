import { createContext, ReactNode, useMemo, useContext } from 'react';
import { useSuiClient } from '@mysten/dapp-kit';
import { SealClient } from '@mysten/seal';
import { SuiStackMessagingClient, WalrusStorageAdapter } from '@mysten/messaging';
import { useSessionKey } from './SessionKeyProvider';
import { SuiClient } from '@mysten/sui/client';
import { normalizeSuinsName } from '../lib/utils';

// still hard-coded server configs
const SEAL_SERVERS = [
  '0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75',
  '0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8',
];

const MessagingClientContext = createContext<SuiStackMessagingClient | null>(null);

const GROUP_NAME_CACHE_TTL_MS = 300_000;
type ChannelGroupNameCacheEntry = {
  address: string | null;
  label: string | null;
  normalized: string | null;
  expiresAt: number;
  expiresAtMs?: number;
};

const channelGroupNameCache = new Map<string, ChannelGroupNameCacheEntry>();

const unwrapOptionAddress = (value: unknown): string | null => {
  if (!value) {
    return null;
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (typeof record.Some === 'string') {
      return record.Some;
    }
    if (typeof record.some === 'string') {
      return record.some;
    }
    if (record.fields && typeof record.fields === 'object') {
      const fields = record.fields as Record<string, unknown>;
      if (typeof fields.some === 'string') {
        return fields.some;
      }
      if (
        Array.isArray(fields.vec) &&
        fields.vec.length > 0 &&
        typeof fields.vec[0] === 'string'
      ) {
        return fields.vec[0] as string;
      }
    }
  }
  return null;
};

const extractGroupNameAddressFromChannel = (channel: any): string | null => {
  if (!channel) {
    return null;
  }
  const direct = unwrapOptionAddress(channel.group_name);
  if (direct) {
    return direct.toLowerCase();
  }
  if (typeof channel.group_name_nft === 'string') {
    return channel.group_name_nft.toLowerCase();
  }
  const maybeMetadata = channel.metadata ?? channel.data?.metadata;
  if (maybeMetadata) {
    const fromMeta =
      unwrapOptionAddress(maybeMetadata.group_name) ??
      unwrapOptionAddress(maybeMetadata.groupName) ??
      (typeof maybeMetadata.group_name_nft === 'string'
        ? maybeMetadata.group_name_nft
        : null);
    if (fromMeta) {
      return fromMeta.toLowerCase();
    }
  }
  const fields = channel.content?.fields ?? channel.data?.content?.fields;
  if (fields) {
    const fromFields =
      unwrapOptionAddress(fields.group_name) ??
      (typeof fields.group_name_nft === 'string' ? fields.group_name_nft : null);
    if (fromFields) {
      return (fromFields as string).toLowerCase();
    }
  }
  return null;
};

const resolveChannelGroupName = async (
  client: SuiClient,
  channelId: string,
): Promise<ChannelGroupNameCacheEntry | null> => {
  const cacheKey = channelId.toLowerCase();
  const cached = channelGroupNameCache.get(cacheKey);
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    return cached;
  }

  try {
    const response = await client.getObject({
      id: channelId,
      options: { showContent: true },
    });
    const fields = (response.data?.content as any)?.fields;
    const optionValue = fields?.group_name;
    const address = unwrapOptionAddress(optionValue);
    const label =
      typeof fields?.domain_name === 'string' ? fields.domain_name : null;
    const normalized =
      label && label.includes('.sui') ? normalizeSuinsName(label) : null;
    const expiresAtMs = fields?.expiration_timestamp_ms
      ? Number(fields.expiration_timestamp_ms)
      : undefined;
    const entry: ChannelGroupNameCacheEntry = {
      address: address ?? null,
      label,
      normalized,
      expiresAt: now + GROUP_NAME_CACHE_TTL_MS,
      expiresAtMs,
    };
    channelGroupNameCache.set(cacheKey, entry);
    return entry;
  } catch (error) {
    console.warn('[MessagingClientProvider] Failed to fetch group name for channel', channelId, error);
    const entry: ChannelGroupNameCacheEntry = {
      address: null,
      label: null,
      normalized: null,
      expiresAt: now + GROUP_NAME_CACHE_TTL_MS,
    };
    channelGroupNameCache.set(cacheKey, entry);
    return entry;
  }
};

const augmentChannelsWithGroupNames = async (
  client: SuiClient,
  channels: any[],
): Promise<any[]> => {
  if (!Array.isArray(channels) || channels.length === 0) {
    return channels;
  }

  const augmented = await Promise.all(
    channels.map(async (channel) => {
      const channelId = channel?.id?.id;
      if (!channelId) {
        return channel;
      }

      const existingAddress = extractGroupNameAddressFromChannel(channel);

      const cacheKey = channelId.toLowerCase();
      let cacheEntry: ChannelGroupNameCacheEntry | null =
        channelGroupNameCache.get(cacheKey) ?? null;

      if (
        existingAddress &&
        (!cacheEntry || cacheEntry.address !== existingAddress)
      ) {
        const labelCandidate =
          typeof channel.group_name_label === 'string'
            ? channel.group_name_label
            : undefined;
        cacheEntry = {
          address: existingAddress,
          label: labelCandidate ?? null,
          normalized:
            labelCandidate && labelCandidate.includes('.sui')
              ? normalizeSuinsName(labelCandidate)
              : null,
          expiresAt: Date.now() + GROUP_NAME_CACHE_TTL_MS,
          expiresAtMs:
            typeof channel.group_name_expires_at === 'number'
              ? channel.group_name_expires_at
              : undefined,
        };
        channelGroupNameCache.set(cacheKey, cacheEntry);
      }

      if (!cacheEntry) {
        cacheEntry = await resolveChannelGroupName(client, channelId);
        if (cacheEntry) {
          channelGroupNameCache.set(cacheKey, cacheEntry);
        }
      }

      const address = cacheEntry?.address ?? existingAddress;

      if (!address) {
        return channel;
      }

      return {
        ...channel,
        group_name: channel.group_name ?? { Some: address },
        group_name_nft: address,
        group_name_label:
          channel.group_name_label ??
          cacheEntry?.normalized ??
          cacheEntry?.label ??
          null,
        group_name_normalized:
          channel.group_name_normalized ??
          cacheEntry?.normalized ??
          (cacheEntry?.label && cacheEntry.label.includes('.sui')
            ? normalizeSuinsName(cacheEntry.label)
            : null) ??
          null,
        group_name_expires_at:
          channel.group_name_expires_at ?? cacheEntry?.expiresAtMs ?? null,
      };
    }),
  );

  return augmented;
};

export const useMessagingClient = (): SuiStackMessagingClient | null => {
  const ctx = useContext(MessagingClientContext);
  if (ctx === undefined) {
    throw new Error('useMessagingClient must be used within a MessagingClientProvider');
  }
  return ctx;
};

export const MessagingClientProvider = ({
  children,
}: {
  children: ReactNode | ReactNode[];
}) => {
  const suiClient = useSuiClient();
  const { sessionKey } = useSessionKey();

  const messagingClient = useMemo(() => {
    if (!sessionKey) return null;

    try {
      const extendedClient = new SuiClient({
        url: "https://fullnode.testnet.sui.io:443",
        mvr: {
          overrides: {
            packages: {
              '@local-pkg/sui-stack-messaging': "0x984960ebddd75c15c6d38355ac462621db0ffc7d6647214c802cd3b685e1af3d", // Or provide your own package ID
            },
          },
        },
      })
        .$extend(
          SealClient.asClientExtension({
            serverConfigs: SEAL_SERVERS.map((id) => ({
              objectId: id,
              weight: 1,
            })),
          })
        )
        .$extend(
          SuiStackMessagingClient.experimental_asClientExtension({
            storage: (client) =>
              new WalrusStorageAdapter(client, {
                //publisher: 'https://publisher.walrus-testnet.walrus.space',
                aggregator: 'https://aggregator.testnet.walrus.mirai.cloud',
                publisher: 'https://walrus-publisher.rubynodes.io',
                //aggregator: 'https://walrus-testnet-aggregator.nodes.guru',
                epochs: 10,
              }),
            sessionKey,
          })
        );

      const messagingClientInstance = extendedClient.messaging;

      if (messagingClientInstance) {
        const originalGetChannelObjectsByChannelIds =
          messagingClientInstance.getChannelObjectsByChannelIds?.bind(
            messagingClientInstance,
          );

        if (originalGetChannelObjectsByChannelIds) {
          messagingClientInstance.getChannelObjectsByChannelIds =
            (async (...args: Parameters<typeof originalGetChannelObjectsByChannelIds>) => {
              const result = await originalGetChannelObjectsByChannelIds(
                ...args,
              );
              if (!Array.isArray(result)) {
                return result;
              }
              return augmentChannelsWithGroupNames(extendedClient, result);
            }) as typeof messagingClientInstance.getChannelObjectsByChannelIds;
        }

        const originalGetChannelObjectsByChannelIdsPaginated =
          (messagingClientInstance as any).getChannelObjectsByChannelIdsPaginated?.bind(
            messagingClientInstance,
          );

        if (originalGetChannelObjectsByChannelIdsPaginated) {
          (messagingClientInstance as any).getChannelObjectsByChannelIdsPaginated =
            async (...args: any[]) => {
              const result =
                await originalGetChannelObjectsByChannelIdsPaginated(...args);
              if (!result || !Array.isArray(result.channels)) {
                return result;
              }
              const augmented = await augmentChannelsWithGroupNames(
                extendedClient,
                result.channels,
              );
              return { ...result, channels: augmented };
            };
        }
      }

      return messagingClientInstance;
    } catch (error) {
      console.error('Failed to create messaging client:', error);
      return null;
    }
  }, [suiClient, sessionKey]);

  return (
    <MessagingClientContext.Provider value={messagingClient}>
      {children}
    </MessagingClientContext.Provider>
  );
};