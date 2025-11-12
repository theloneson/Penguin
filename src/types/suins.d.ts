declare module '@mysten/suins' {
  import type { SuiClient } from '@mysten/sui/client';
  import type { Transaction } from '@mysten/sui/transactions';

  export type Network = 'mainnet' | 'testnet' | 'custom';

  export type SuinsPriceList = {
    threeLetters: number;
    fourLetters: number;
    fivePlusLetters: number;
  };

  export type NameRecord = {
    name: string;
    nftId: string;
    targetAddress: string;
    expirationTimestampMs: number;
    data: Record<string, string>;
    avatar?: string;
    contentHash?: string;
  };

  export interface SuinsClientConfig {
    client: SuiClient;
    network?: Network;
    packageIds?: Record<string, unknown>;
  }

  export class SuinsClient {
    constructor(config: SuinsClientConfig);
    constants: Record<string, unknown>;
    getPriceList(): Promise<SuinsPriceList>;
    getRenewalPriceList(): Promise<SuinsPriceList>;
    getNameRecord(name: string): Promise<NameRecord>;
    calculatePrice(params: {
      name: string;
      years: number;
      priceList: SuinsPriceList;
    }): number;
  }

  export class SuinsTransaction {
    constructor(client: SuinsClient, transaction: Transaction);
    register(params: { name: string; price: number; years: number }): any;
    setTargetAddress(params: { nft: any; address?: string; isSubname?: boolean }): void;
    setDefault(name: string): void;
  }
}

