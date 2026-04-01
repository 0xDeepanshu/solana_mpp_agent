'use client'

import { useAccount, useKitTransactionSigner } from '@solana/connector'
import { ConnectButtonBaseUI } from '@/components/WalletConnect'
import { useState } from 'react'
import { Mppx, solana } from '@solana/mpp/client'

export default function Home() {
  const { address } = useAccount()           // wallet address
  const { signer, ready } = useKitTransactionSigner()  // ✅ kit-compatible signer for MPP
  const [data, setData] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handlePay() {
    if (!signer || !ready) return

    setLoading(true)
    setError(null)

    try {
      const mppx = Mppx.create({
        methods: [solana.charge({
          signer,
          broadcast: true,  // client broadcasts tx itself, sends signature to server
          rpcUrl: 'https://api.devnet.solana.com',
        })],
      })

      const response = await mppx.fetch('/api/paid-data')
      const result = await response.json()
      setData(result.message)

    } catch (err) {
      setError('Payment failed or rejected.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main style={{ padding: '2rem' }}>

      {/* ConnectorKit's built-in button — handles Phantom, Solflare, Backpack */}
      <ConnectButtonBaseUI />

      {address ? (
        <div style={{ marginTop: '2rem' }}>
          <p>✅ Connected: {address}</p>
          <button
            onClick={handlePay}
            disabled={loading || !ready}
            style={{ marginTop: '1rem' }}
          >
            {loading ? 'Processing...' : 'Pay 1 USDC to get data'}
          </button>
        </div>
      ) : (
        <p style={{ marginTop: '1rem' }}>👆 Connect your wallet first</p>
      )}

      {data && <p style={{ marginTop: '1rem' }}>🎉 {data}</p>}
      {error && <p style={{ marginTop: '1rem' }}>❌ {error}</p>}

    </main>
  )
}