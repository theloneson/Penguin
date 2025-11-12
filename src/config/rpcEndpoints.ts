export const TESTNET_RPC_ENDPOINTS = [
  'https://sui-testnet-rpc.publicnode.com',
  'https://testnet-rpc.sui.chainbase.online/',
  'https://sui-testnet.nodeinfra.com',
  'https://endpoints.omniatech.io/v1/sui/testnet/public',
  'https://sui-testnet.api.onfinality.io/public',
  'https://fullnode.testnet.sui.io:443',
  'https://sui-api.rpcpool.com',
  'https://sui-rpc.testnet.lgns.net',
  'https://rpc-sui-testnet.cosmostation.io',
  'https://testnet.artifact.systems/sui',
  'https://sui-testnet-rpc.bartestnet.com/',
  'https://sui-testnet-rpc.allthatnode.com',
  'https://sui-rpc-pt.testnet-pride.com/',
  'https://rpc-testnet.suiscan.xyz/',
  'https://sui-testnet.brightlystake.com/',
  'https://sui-testnet-rpc-germany.allthatnode.com/',
  'https://sui-testnet-rpc-korea.allthatnode.com/',
  'https://sui-testnet-endpoint.blockvision.org/',
] as const;

let testnetEndpointIndex = 0;

export const getNextTestnetEndpoint = (): string => {
  if (TESTNET_RPC_ENDPOINTS.length === 0) {
    throw new Error('No testnet RPC endpoints configured.');
  }
  const endpoint = TESTNET_RPC_ENDPOINTS[testnetEndpointIndex];
  testnetEndpointIndex = (testnetEndpointIndex + 1) % TESTNET_RPC_ENDPOINTS.length;
  return endpoint;
};

export const getDefaultTestnetEndpoint = (): string => {
  if (TESTNET_RPC_ENDPOINTS.length === 0) {
    throw new Error('No testnet RPC endpoints configured.');
  }
  return TESTNET_RPC_ENDPOINTS[0];
};


