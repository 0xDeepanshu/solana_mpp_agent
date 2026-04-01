'use client';

import { useConnector, type WalletConnectorId, type WalletConnectorMetadata } from '@solana/connector/react';
import { Dialog } from '@base-ui/react/dialog';
import { Collapsible } from '@base-ui/react/collapsible';
import { Wallet, ExternalLink, ChevronDown, X } from 'lucide-react';
import { useState, useEffect } from 'react';

export function WalletModalBaseUI({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
    const { walletStatus, isConnecting, connectorId, connectors, connectWallet, disconnectWallet } = useConnector();
    const status = walletStatus.status;
    const [connectingConnectorId, setConnectingConnectorId] = useState<WalletConnectorId | null>(null);
    const [isOtherWalletsOpen, setIsOtherWalletsOpen] = useState(false);
    const [recentlyConnectedConnectorId, setRecentlyConnectedConnectorId] = useState<WalletConnectorId | null>(null);

    useEffect(() => {
        const recent = localStorage.getItem('recentlyConnectedConnectorId');
        if (recent) setRecentlyConnectedConnectorId(recent as WalletConnectorId);
    }, []);

    useEffect(() => {
        if (status !== 'connected') return;
        if (!connectorId) return;
        localStorage.setItem('recentlyConnectedConnectorId', connectorId);
        setRecentlyConnectedConnectorId(connectorId);
    }, [status, connectorId]);

    const handleSelectWallet = async (connector: WalletConnectorMetadata) => {
        setConnectingConnectorId(connector.id);
        try {
            await connectWallet(connector.id);
            localStorage.setItem('recentlyConnectedConnectorId', connector.id);
            setRecentlyConnectedConnectorId(connector.id);
            onOpenChange(false);
        } catch (error) {
            console.error('Failed to connect:', error);
        } finally {
            setConnectingConnectorId(null);
        }
    };

    const readyConnectors = connectors.filter(c => c.ready);
    const primaryWallets = readyConnectors.slice(0, 3);
    const otherWallets = readyConnectors.slice(3);

    return (
        <Dialog.Root open={open} onOpenChange={onOpenChange}>
            <Dialog.Portal>
                <Dialog.Backdrop className="fixed inset-0 bg-black/80 transition-opacity" />
                <Dialog.Popup className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md rounded-[24px] bg-background p-6 shadow-lg">
                    <div className="flex items-center justify-between mb-4">
                        <Dialog.Title className="text-lg font-semibold">Connect your wallet</Dialog.Title>
                        <Dialog.Close className="rounded-[16px] h-8 w-8 p-2 border hover:bg-accent cursor-pointer">
                            <X className="h-3 w-3" />
                        </Dialog.Close>
                    </div>
                    <div className="space-y-4">
                        {primaryWallets.map(connector => (
                            <button
                                key={connector.id}
                                className="w-full flex justify-between items-center p-4 rounded-[16px] border hover:bg-accent"
                                onClick={() => handleSelectWallet(connector)}
                                disabled={isConnecting}
                            >
                                <span className="font-semibold">{connector.name}</span>
                                <img src={connector.icon} className="h-10 w-10 rounded-full" />
                            </button>
                        ))}
                        {otherWallets.length > 0 && (
                            <Collapsible.Root open={isOtherWalletsOpen} onOpenChange={setIsOtherWalletsOpen}>
                                <Collapsible.Trigger className="w-full flex justify-between items-center px-4 py-3 rounded-[16px] border cursor-pointer">
                                    <span>Other Wallets</span>
                                    <ChevronDown className={`h-4 w-4 transition-transform ${isOtherWalletsOpen ? 'rotate-180' : ''}`} />
                                </Collapsible.Trigger>
                                <Collapsible.Panel className="overflow-hidden">
                                    <div className="grid gap-2 pt-2">
                                        {otherWallets.map(connector => (
                                            <button
                                                key={connector.id}
                                                className="w-full flex justify-between items-center p-4 rounded-[16px] border"
                                                onClick={() => handleSelectWallet(connector)}
                                            >
                                                <span>{connector.name}</span>
                                                <img src={connector.icon} className="h-8 w-8 rounded-full" />
                                            </button>
                                        ))}
                                    </div>
                                </Collapsible.Panel>
                            </Collapsible.Root>
                        )}
                    </div>
                </Dialog.Popup>
            </Dialog.Portal>
        </Dialog.Root>
    );
}