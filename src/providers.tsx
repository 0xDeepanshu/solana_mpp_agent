"use client"
import { AppProvider } from '@solana/connector/react';
import { getDefaultConfig } from '@solana/connector/headless';

export default function Providers({ children }: { children: React.ReactNode }) {
    const config = getDefaultConfig({ appName: 'My App' });

    return (
        <AppProvider connectorConfig={config}>
            {children}
        </AppProvider>
    );
}