'use client';

import { Collapsible } from '@base-ui/react/collapsible';
import { BalanceElement, ClusterElement, TokenListElement, TransactionHistoryElement, DisconnectElement } from '@solana/connector/react';
import { Wallet, Copy, Globe, ChevronDown, Check, RefreshCw, Coins, History, LogOut } from 'lucide-react';
import { useState } from 'react';

export function WalletDropdownContentBaseUI({ selectedAccount, walletIcon, walletName }: { selectedAccount: string; walletIcon?: string; walletName: string }) {
    const [copied, setCopied] = useState(false);
    const [isTokensOpen, setIsTokensOpen] = useState(false);
    const [isTransactionsOpen, setIsTransactionsOpen] = useState(false);
    const shortAddress = `${selectedAccount.slice(0, 4)}...${selectedAccount.slice(-4)}`;

    const handleCopy = () => {
        navigator.clipboard.writeText(selectedAccount);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="w-[360px] p-4 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <img src={walletIcon} className="h-12 w-12 rounded-full" />
                    <div>
                        <div className="font-semibold text-lg">{shortAddress}</div>
                        <div className="text-xs text-muted-foreground">{walletName}</div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={handleCopy} className="h-9 w-9 rounded-full border flex items-center justify-center hover:bg-accent">
                        {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                    </button>
                    <ClusterElement
                        render={({ cluster }) => (
                            <button className="h-9 w-9 rounded-full border flex items-center justify-center hover:bg-accent relative">
                                <Globe className="h-4 w-4" />
                                <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-green-500 border-2 border-background" />
                            </button>
                        )}
                    />
                </div>
            </div>

            {/* Balance */}
            <BalanceElement
                render={({ solBalance, isLoading, refetch }) => (
                    <div className="rounded-[12px] border bg-muted/50 p-4">
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-sm text-muted-foreground">Balance</span>
                            <button onClick={() => refetch()} className="p-1 hover:bg-accent rounded">
                                <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                            </button>
                        </div>
                        <div className="text-2xl font-bold">{solBalance?.toFixed(4)} SOL</div>
                    </div>
                )}
            />

            {/* Tokens - Base UI Collapsible */}
            <Collapsible.Root open={isTokensOpen} onOpenChange={setIsTokensOpen} className="border rounded-[12px] px-3">
                <Collapsible.Trigger className="w-full flex items-center justify-between py-3 cursor-pointer">
                    <div className="flex items-center gap-2">
                        <Coins className="h-4 w-4" />
                        <span className="font-medium">Tokens</span>
                    </div>
                    <ChevronDown className={`h-4 w-4 transition-transform ${isTokensOpen ? 'rotate-180' : ''}`} />
                </Collapsible.Trigger>
                <Collapsible.Panel className="overflow-hidden">
                    <TokenListElement limit={5} render={({ tokens }) => (
                        <div className="space-y-2 pb-2">
                            {tokens.map(token => (
                                <div key={token.mint} className="flex items-center gap-3 py-1">
                                    <img src={token.logo} className="h-8 w-8 rounded-full" />
                                    <div className="flex-1">
                                        <p className="font-medium text-sm">{token.symbol}</p>
                                        <p className="text-xs text-muted-foreground">{token.name}</p>
                                    </div>
                                    <p className="font-mono text-sm">{token.formatted}</p>
                                </div>
                            ))}
                        </div>
                    )} />
                </Collapsible.Panel>
            </Collapsible.Root>

            {/* Transactions - Base UI Collapsible */}
            <Collapsible.Root open={isTransactionsOpen} onOpenChange={setIsTransactionsOpen} className="border rounded-[12px] px-3">
                <Collapsible.Trigger className="w-full flex items-center justify-between py-3 cursor-pointer">
                    <div className="flex items-center gap-2">
                        <History className="h-4 w-4" />
                        <span className="font-medium">Recent Activity</span>
                    </div>
                    <ChevronDown className={`h-4 w-4 transition-transform ${isTransactionsOpen ? 'rotate-180' : ''}`} />
                </Collapsible.Trigger>
                <Collapsible.Panel className="overflow-hidden">
                    <TransactionHistoryElement limit={5} render={({ transactions }) => (
                        <div className="space-y-2 pb-2">
                            {transactions.map(tx => (
                                <a key={tx.signature} href={tx.explorerUrl} target="_blank" className="flex items-center gap-3 py-1 hover:bg-muted/50 rounded-lg px-1 -mx-1">
                                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                                        <History className="h-4 w-4" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-medium text-sm">{tx.type}</p>
                                        <p className="text-xs text-muted-foreground">{tx.formattedTime}</p>
                                    </div>
                                </a>
                            ))}
                        </div>
                    )} />
                </Collapsible.Panel>
            </Collapsible.Root>

            {/* Disconnect */}
            <DisconnectElement
                render={({ disconnect, disconnecting }) => (
                    <button onClick={disconnect} disabled={disconnecting} className="w-full h-11 rounded-[12px] bg-destructive text-destructive-foreground hover:bg-destructive/90 flex items-center justify-center gap-2">
                        <LogOut className="h-4 w-4" />
                        {disconnecting ? 'Disconnecting...' : 'Disconnect'}
                    </button>
                )}
            />
        </div>
    );
}