import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SuiClientProvider, WalletProvider } from "@mysten/dapp-kit";
import RegisterEnokiWallets from "./components/RegisterEnokiWallets";
import App from "./App.tsx";
import { networkConfig } from "./networkConfig.ts";
import { SuiClient } from "@mysten/sui/client";
import "@mysten/dapp-kit/dist/index.css";
import "./index.css";

const queryClient = new QueryClient();

const createClient = () => {
  return new SuiClient({
    //url: "https://fullnode.testnet.sui.io:443",
    url: "https://fullnode.testnet.sui.io:443",
    mvr: {
      overrides: {
        packages: {
          '@local-pkg/sui-stack-messaging': "0xdf7ed29b942c2bf66c544bd2cf9714a7c90198ef552d74dd79ff2b8bba3af290", // Or provide your own package ID
        },
      },
    },
  })
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider createClient={createClient} networks={networkConfig} defaultNetwork="testnet">
        <RegisterEnokiWallets />
        <WalletProvider autoConnect>
          <App />
        </WalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
