/**
 * trainingStore.ts
 *
 * Persistent file-based store for training data.
 * Stores raw match data and computed profiles per wallet.
 * Uses JSON files in .data/training/ directory.
 */

import fs from 'fs'
import path from 'path'
import type { MatchSummary, TrainingProfile, MoveRecord } from './types/training'

const DATA_DIR = path.join(process.cwd(), '.data', 'training')
const MATCHES_DIR = path.join(DATA_DIR, 'matches')
const PROFILES_DIR = path.join(DATA_DIR, 'profiles')

// ── Ensure directories exist ────────────────────────────────────────────────

function ensureDirs() {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
    if (!fs.existsSync(MATCHES_DIR)) fs.mkdirSync(MATCHES_DIR, { recursive: true })
    if (!fs.existsSync(PROFILES_DIR)) fs.mkdirSync(PROFILES_DIR, { recursive: true })
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function walletDir(wallet: string): string {
    // Use first 8 chars of wallet as subfolder to avoid too many files in one dir
    const prefix = wallet.slice(0, 8)
    const dir = path.join(MATCHES_DIR, prefix)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    return dir
}

function matchFilePath(wallet: string, matchId: string): string {
    return path.join(walletDir(wallet), `${matchId}.json`)
}

function profileFilePath(wallet: string): string {
    const prefix = wallet.slice(0, 8)
    const dir = path.join(PROFILES_DIR, prefix)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    return path.join(dir, `${wallet}.json`)
}

function matchIndexPath(wallet: string): string {
    return path.join(walletDir(wallet), '_index.json')
}

// ── Match index (list of match IDs per wallet) ──────────────────────────────

function readMatchIndex(wallet: string): string[] {
    const indexPath = matchIndexPath(wallet)
    if (!fs.existsSync(indexPath)) return []
    try {
        return JSON.parse(fs.readFileSync(indexPath, 'utf-8'))
    } catch {
        return []
    }
}

function addToMatchIndex(wallet: string, matchId: string) {
    const indexPath = matchIndexPath(wallet)
    const index = readMatchIndex(wallet)
    if (!index.includes(matchId)) {
        index.push(matchId)
        fs.writeFileSync(indexPath, JSON.stringify(index, null, 2))
    }
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Save a completed match with all its move data
 */
export function saveMatch(match: MatchSummary): void {
    ensureDirs()
    const filePath = matchFilePath(match.wallet, match.matchId)
    fs.writeFileSync(filePath, JSON.stringify(match, null, 2))
    addToMatchIndex(match.wallet, match.matchId)
    console.log(`[training] Saved match ${match.matchId} for ${match.wallet.slice(0, 8)}…`)
}

/**
 * Load all matches for a wallet, sorted by start time
 */
export function loadMatches(wallet: string): MatchSummary[] {
    ensureDirs()
    const matchIds = readMatchIndex(wallet)
    const matches: MatchSummary[] = []

    for (const matchId of matchIds) {
        const filePath = matchFilePath(wallet, matchId)
        if (fs.existsSync(filePath)) {
            try {
                const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
                matches.push(data)
            } catch {
                console.warn(`[training] Corrupt match file: ${filePath}`)
            }
        }
    }

    return matches.sort((a, b) => a.startedAt - b.startedAt)
}

/**
 * Load a specific match by ID
 */
export function loadMatch(wallet: string, matchId: string): MatchSummary | null {
    ensureDirs()
    const filePath = matchFilePath(wallet, matchId)
    if (!fs.existsSync(filePath)) return null
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
    } catch {
        return null
    }
}

/**
 * Get the number of matches for a wallet
 */
export function getMatchCount(wallet: string): number {
    return readMatchIndex(wallet).length
}

/**
 * Save a computed training profile
 */
export function saveProfile(profile: TrainingProfile): void {
    ensureDirs()
    const filePath = profileFilePath(profile.wallet)
    fs.writeFileSync(filePath, JSON.stringify(profile, null, 2))
    console.log(`[training] Saved profile for ${profile.wallet.slice(0, 8)}…`)
}

/**
 * Load a training profile for a wallet
 */
export function loadProfile(wallet: string): TrainingProfile | null {
    ensureDirs()
    const filePath = profileFilePath(wallet)
    if (!fs.existsSync(filePath)) return null
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
    } catch {
        return null
    }
}

/**
 * Delete all training data for a wallet (GDPR / reset)
 */
export function deleteTrainingData(wallet: string): void {
    ensureDirs()
    // Delete matches
    const dir = walletDir(wallet)
    if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true })
    }
    // Delete profile
    const profilePath = profileFilePath(wallet)
    if (fs.existsSync(profilePath)) {
        fs.unlinkSync(profilePath)
    }
    console.log(`[training] Deleted all training data for ${wallet.slice(0, 8)}…`)
}
