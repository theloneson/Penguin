import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { SuiClient } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";
import { SuinsClient, SuinsTransaction } from "@mysten/suins";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type SuinsSupportedNetwork = "mainnet" | "testnet";

export type SuinsAvailabilityStatus =
  | "available"
  | "owned-by-user"
  | "owned-by-other";

export interface SuinsAvailabilityResult {
  status: SuinsAvailabilityStatus;
  name: string;
  normalizedName: string;
  nftId?: string;
  targetAddress?: string;
  expirationTimestampMs?: number;
}

export interface BuildSuinsRegistrationTransactionArgs {
  client: SuiClient;
  network: SuinsSupportedNetwork;
  name: string;
  recipientAddress: string;
  years?: number;
}

export interface BuildSuinsRegistrationTransactionResult {
  transaction: Transaction;
  normalizedName: string;
  price: number;
}

type BasicCoinConfig = {
  type: string;
  feed: string;
};

const DEFAULT_SUI_COIN_CONFIG: Record<SuinsSupportedNetwork, BasicCoinConfig> =
  {
    mainnet: {
      type:
        "0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI",
      feed:
        "0x23d7315113f5b1d3ba7a83604c44b94d79f4fd69af77f804fc7f920a6dc65744",
    },
    testnet: {
      type:
        "0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI",
      feed:
        "0x50c67b3fd225db8912a424dd4baed60ffdde625ed2feaaf283724f9608fea266",
    },
  };

export const normalizeSuinsName = (value: string): string => {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) {
    return "";
  }
  const base = trimmed.endsWith(".sui")
    ? trimmed.slice(0, -4)
    : trimmed;
  return `${base}.sui`;
};

export type OwnedSuinsEntry = {
  owner: string;
  normalizedName: string;
  objectId: string;
  expiresAt?: number;
};

let ownedSuinsCache: OwnedSuinsEntry[] = [];
let ownedSuinsOwner: string | null = null;
let ownedSuinsMapCache: Record<string, OwnedSuinsEntry> = {};
let ownedSuinsByIdCache: Record<string, OwnedSuinsEntry> = {};

export const setOwnedSuinsCache = (
  ownerAddress: string,
  entries: OwnedSuinsEntry[],
) => {
  ownedSuinsOwner = ownerAddress.toLowerCase();
  ownedSuinsCache = entries.map((entry) => ({
    ...entry,
    owner: ownedSuinsOwner!,
    normalizedName: normalizeSuinsName(entry.normalizedName),
  }));
  ownedSuinsMapCache = ownedSuinsCache.reduce<Record<string, OwnedSuinsEntry>>((acc, entry) => {
    acc[entry.normalizedName] = entry;
    return acc;
  }, {});
  ownedSuinsByIdCache = ownedSuinsCache.reduce<Record<string, OwnedSuinsEntry>>((acc, entry) => {
    acc[entry.objectId.toLowerCase()] = entry;
    return acc;
  }, {});
};

export const clearOwnedSuinsCache = () => {
  ownedSuinsOwner = null;
  ownedSuinsCache = [];
  ownedSuinsMapCache = {};
  ownedSuinsByIdCache = {};
};

export const getOwnedSuinsNames = () => ownedSuinsCache;

export const getOwnedSuinsMap = (ownerAddress?: string) => {
  if (!ownedSuinsOwner) {
    return {};
  }
  if (ownerAddress && ownedSuinsOwner !== ownerAddress.toLowerCase()) {
    return {};
  }
  return { ...ownedSuinsMapCache };
};

export const getOwnedSuinsByObjectId = (objectId: string) => {
  if (!objectId) {
    return null;
  }
  return ownedSuinsByIdCache[objectId.toLowerCase()] ?? null;
};

export const isValidSuinsLabel = (value: string): boolean => {
  if (!value) {
    return false;
  }
  if (value.startsWith("-") || value.endsWith("-")) {
    return false;
  }
  return /^[a-z0-9-]+$/.test(value);
};

export const checkSuinsAvailability = async ({
  client,
  network,
  name,
  ownerAddress,
}: {
  client: SuiClient;
  network: SuinsSupportedNetwork;
  name: string;
  ownerAddress?: string | null;
}): Promise<SuinsAvailabilityResult> => {
  const normalizedName = normalizeSuinsName(name);
  if (!normalizedName) {
    throw new Error("Enter a valid SuiNS name.");
  }

  const cachedOwner = ownedSuinsOwner;
  const cacheMatch = ownedSuinsCache.find(
    (entry) => entry.normalizedName === normalizedName,
  );
  if (
    cacheMatch &&
    ownerAddress &&
    cachedOwner &&
    cachedOwner === ownerAddress.toLowerCase()
  ) {
    return {
      status: "owned-by-user",
      name: normalizedName,
      normalizedName,
      nftId: cacheMatch.objectId,
      targetAddress: ownerAddress,
      expirationTimestampMs: cacheMatch.expiresAt,
    };
  }

  const suinsClient = new SuinsClient({ client, network });

  try {
    const record = await suinsClient.getNameRecord(normalizedName);
    if (!record) {
      return {
        status: "available",
        name: normalizedName,
        normalizedName,
      };
    }
    const normalizedOwner = ownerAddress?.toLowerCase() ?? null;
    const recordOwner = record.targetAddress?.toLowerCase() ?? null;
    const isOwnedByUser =
      normalizedOwner !== null && recordOwner === normalizedOwner;

    return {
      status: isOwnedByUser ? "owned-by-user" : "owned-by-other",
      name: record.name ?? normalizedName,
      normalizedName,
      nftId: record.nftId,
      targetAddress: record.targetAddress,
      expirationTimestampMs: record.expirationTimestampMs,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown SuiNS lookup error.";
    if (message.toLowerCase().includes("not registered")) {
      return {
        status: "available",
        name: normalizedName,
        normalizedName,
      };
    }
    throw error instanceof Error ? error : new Error(message);
  }
};

export const buildSuinsRegistrationTransaction = async ({
  client,
  network,
  name,
  recipientAddress,
  years = 1,
}: BuildSuinsRegistrationTransactionArgs): Promise<BuildSuinsRegistrationTransactionResult> => {
  if (years < 1 || years > 5) {
    throw new Error("Years must be between 1 and 5.");
  }

  const normalizedName = normalizeSuinsName(name);
  if (!normalizedName) {
    throw new Error("Enter a valid SuiNS name.");
  }

  if (!recipientAddress) {
    throw new Error("Recipient address is required.");
  }

  const suinsClient = new SuinsClient({ client, network });
  const packageInfo = (suinsClient as any).config;
  const coinConfig: BasicCoinConfig =
    packageInfo?.coins?.SUI ?? DEFAULT_SUI_COIN_CONFIG[network];

  const priceResult = (suinsClient as any).calculatePrice({
    name: normalizedName,
    years,
    isRegistration: true,
  });
  const estimatedPrice = BigInt(
    typeof priceResult === "number" ? Math.max(priceResult, 0) : await priceResult,
  );

  const fallbackAmount = BigInt(years) * 6n * 1_000_000_000n;
  const maxPaymentAmount =
    estimatedPrice > fallbackAmount ? estimatedPrice : fallbackAmount;

  const coinsResponse = await client.getCoins({
    owner: recipientAddress,
    coinType: coinConfig.type,
    limit: 200,
  });

  const sortedCoins = [...coinsResponse.data].sort((a, b) => {
    const diff = BigInt(b.balance) - BigInt(a.balance);
    return diff === 0n ? 0 : diff > 0n ? 1 : -1;
  });
  const gasCoin = sortedCoins[0];

  if (!gasCoin) {
    throw new Error("Not enough SUI balance to register this name.");
  }

  if (BigInt(gasCoin.balance) < maxPaymentAmount) {
    throw new Error("Not enough SUI balance to register this name.");
  }

  const transaction = new Transaction();
  transaction.setGasPayment([
    {
      objectId: gasCoin.coinObjectId,
      version: gasCoin.version,
      digest: gasCoin.digest,
    },
  ]);
  transaction.setGasBudget(1_000_000_000n);

  const [paymentCoinArg] = transaction.splitCoins(transaction.gas, [
    transaction.pure.u64(maxPaymentAmount),
  ]);

  let priceInfoObjectId: string | null = null;
  if (coinConfig.feed) {
    const getPriceInfoObject = (suinsClient as any).getPriceInfoObject?.bind(
      suinsClient,
    );
    if (getPriceInfoObject) {
      const priceInfoIds = await getPriceInfoObject(
        transaction,
        coinConfig.feed,
      );
      priceInfoObjectId = priceInfoIds?.[0] ?? null;
    }
  }

  const suinsTransaction = new SuinsTransaction(suinsClient, transaction);

  const registerParams: any = {
    domain: normalizedName,
    years,
    coinConfig,
    coin: paymentCoinArg,
    priceInfoObjectId,
  };
  registerParams.maxAmount = maxPaymentAmount;

  const nft = suinsTransaction.register(registerParams);

  transaction.transferObjects(
    [nft, paymentCoinArg],
    transaction.pure.address(recipientAddress),
  );

  return {
    transaction,
    normalizedName,
    price: Number(maxPaymentAmount),
  };
};