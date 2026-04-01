'use client';

import { useConnector } from '@solana/connector/react';
import { Menu } from '@base-ui/react/menu';
import { useState } from 'react';
import { WalletModalBaseUI } from './WalletModal';
import { WalletDropdownContentBaseUI } from './WalletDropdown'
import { Wallet, ChevronDown } from 'lucide-react';

// Custom Avatar component for Base UI
function Avatar({ src, alt, fallback, className }: { src?: string; alt?: string; fallback?: React.ReactNode; className?: string }) {
    const [hasError, setHasError] = useState(false);
    return (
        <div className={`relative flex shrink-0 overflow-hidden rounded-full ${className}`}>
            {src && !hasError ? (
                <img src={src} alt={alt} className="aspect-square h-full w-full object-cover" onError={() => setHasError(true)} />
            ) : (
                <div className="flex h-full w-full items-center justify-center bg-muted">{fallback}</div>
            )}
        </div>
    );
}

export function ConnectButtonBaseUI({ className }: { className?: string }) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const { isConnected, isConnecting, account, connector } = useConnector();

    if (isConnecting) {
        return (
            <button disabled className="inline-flex items-center gap-2 h-8 px-3 rounded-md border bg-background opacity-50">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                <span className="text-xs">Connecting...</span>
            </button>
        );
    }

    if (isConnected && account && connector) {
        const shortAddress = `${account.slice(0, 4)}...${account.slice(-4)}`;
        const walletIcon = connector.icon || undefined;

        return (
            <Menu.Root>
                <Menu.Trigger className="inline-flex items-center gap-2 h-8 px-3 rounded-md border bg-background hover:bg-accent">
                    <Avatar
                        src={walletIcon}
                        alt={connector.name}
                        fallback={<Wallet className="h-3 w-3" />}
                        className="h-5 w-5"
                    />
                    <span className="text-xs">{shortAddress}</span>
                    <ChevronDown className="h-4 w-4 opacity-50" />
                </Menu.Trigger>
                <Menu.Portal>
                    <Menu.Positioner sideOffset={8} align="end">
                        <Menu.Popup className="rounded-[20px] bg-background p-0 shadow-lg outline outline-1 outline-gray-200">
                            <WalletDropdownContentBaseUI
                                selectedAccount={String(account)}
                                walletIcon={walletIcon}
                                walletName={connector.name}
                            />
                        </Menu.Popup>
                    </Menu.Positioner>
                </Menu.Portal>
            </Menu.Root>
        );
    }

    return (
        <>
            <button onClick={() => setIsModalOpen(true)} className="inline-flex items-center h-8 px-3 rounded-md border bg-background hover:bg-accent">
                Connect Wallet
            </button>
            <WalletModalBaseUI open={isModalOpen} onOpenChange={setIsModalOpen} />
        </>
    );
}