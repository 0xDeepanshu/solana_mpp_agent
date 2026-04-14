---
created: 2026-04-14
updated: 2026-04-14
status: active
tags: [guide, unity, integration, stakestack, api, mpp, x402]
---

# StakeStack Unity Integration Guide

> Complete guide for implementing the Unity WebGL side of the StakeStack agent training system.

---

## Overview

The Unity game needs to communicate with the Next.js web app in four ways:

1. **Receive game commands** via SSE (Server-Sent Events)
2. **Send wallet info** to the web bridge
3. **Send live game state** during gameplay
4. **Send training telemetry** when a match ends

All communication goes through the `/api/game` and `/api/training/record` endpoints.

---

## Architecture

```
┌──────────────────────────────────────────────────────┐
│  Unity WebGL (iframe)                                │
│                                                      │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐     │
│  │ SSE        │  │ Game       │  │ Training   │     │
│  │ Listener   │  │ State      │  │ Reporter   │     │
│  │            │  │ Reporter   │  │            │     │
│  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘     │
│        │               │               │             │
└────────┼───────────────┼───────────────┼─────────────┘
         │               │               │
    GET /api/game    POST /api/game   POST /api/training/record
    (SSE stream)     (state + cmds)   (match telemetry)
         │               │               │
         ▼               ▼               ▼
┌──────────────────────────────────────────────────────┐
│  Next.js Web App (localhost:3000)                    │
│                                                      │
│  /api/game         → SSE bridge + command queue      │
│  /api/training/*   → Training data store + profiles  │
│  /api/agent        → AI agent (reads training data)  │
└──────────────────────────────────────────────────────┘
```

---

## 1. SSE Listener — Receiving Game Commands

### What it does
The web app's AI agent sends game commands (StartBotMode, StartPracticeMode, etc.) via the SSE bridge. Unity needs to listen for these and execute them.

### Endpoint
```
GET http://localhost:3000/api/game
Content-Type: text/event-stream
```

### Events received

Each event is a JSON object in the `data:` field:

```json
{
  "action": "StartBotMode",
  "wallet": "GrtjuV...zuX",
  "id": "uuid-here",
  "ts": 1712345678901
}
```

```json
{
  "type": "connected",
  "state": {
    "status": "idle",
    "mode": null,
    "score": 0,
    "level": 1,
    "wallet": "GrtjuV...zuX"
  }
}
```

### Valid actions to handle

| Action | What Unity should do |
|---|---|
| `StartBotMode` | Start a bot/AI match (agent plays using trained profile) |
| `StartPracticeMode` | Start a practice/solo match (human plays) |
| `StartMultiplayerMode` | (Disabled for now — ignore) |
| `ExitToMainMenu` | Exit current match, go to main menu |
| `GetPracticeStatus` | Return practice stats via game state update |

### Unity C# Implementation

```csharp
using UnityEngine;
using UnityEngine.Networking;
using System.Collections;
using System;

public class SSEListener : MonoBehaviour
{
    private string sseUrl = "http://localhost:3000/api/game";
    private Coroutine sseCoroutine;
    
    // Events
    public event Action<string, string> OnGameCommand; // action, wallet
    public event Action<string> OnConnected;           // wallet
    
    public void StartListening()
    {
        sseCoroutine = StartCoroutine(ListenSSE());
    }
    
    public void StopListening()
    {
        if (sseCoroutine != null)
            StopCoroutine(sseCoroutine);
    }
    
    private IEnumerator ListenSSE()
    {
        using (UnityWebRequest request = UnityWebRequest.Get(sseUrl))
        {
            // Important: SSE requires chunked transfer
            request.SetRequestHeader("Accept", "text/event-stream");
            request.SetRequestHeader("Cache-Control", "no-cache");
            
            // Send request
            var operation = request.SendWebRequest();
            
            // Read chunks as they arrive
            while (!operation.isDone)
            {
                if (request.responseCode == 200)
                {
                    string chunk = request.downloadHandler.text;
                    if (!string.IsNullOrEmpty(chunk))
                    {
                        ProcessSSEChunk(chunk);
                    }
                }
                yield return null;
            }
        }
    }
    
    private void ProcessSSEChunk(string chunk)
    {
        // SSE format: "data: {json}\n\n"
        string[] lines = chunk.Split('\n');
        foreach (string line in lines)
        {
            if (line.StartsWith("data: "))
            {
                string json = line.Substring(6).Trim();
                if (json == ": heartbeat") continue; // Skip heartbeats
                
                try
                {
                    SSEMessage msg = JsonUtility.FromJson<SSEMessage>(json);
                    
                    if (msg.type == "connected" && OnConnected != null)
                    {
                        OnConnected(msg.state?.wallet);
                    }
                    else if (!string.IsNullOrEmpty(msg.action) && OnGameCommand != null)
                    {
                        OnGameCommand(msg.action, msg.wallet);
                    }
                }
                catch (Exception e)
                {
                    Debug.LogWarning($"SSE parse error: {e.Message}");
                }
            }
        }
    }
}

[System.Serializable]
public class SSEMessage
{
    public string action;
    public string wallet;
    public string id;
    public long ts;
    public string type;
    public GameState state;
}

[System.Serializable]
public class GameState
{
    public string status;
    public string mode;
    public int score;
    public int level;
    public int moves;
    public float accuracy;
    public string wallet;
    public string matchId;
}
```

---

## 2. Registering the Wallet

### What it does
When the player connects their wallet in the web UI, Unity needs to know which wallet is active. The web app registers it automatically, but Unity should also send it to ensure the game bridge knows the wallet for training data.

### Endpoint
```
POST http://localhost:3000/api/game
Content-Type: application/json

{
  "type": "registerWallet",
  "wallet": "GrtjuV...zuX"
}
```

### Response
```json
{ "ok": true, "wallet": "GrtjuV...zuX" }
```

### Unity C# Implementation

```csharp
public IEnumerator RegisterWallet(string walletAddress)
{
    string json = JsonUtility.ToJson(new RegisterWalletRequest
    {
        type = "registerWallet",
        wallet = walletAddress
    });
    
    using (UnityWebRequest request = new UnityWebRequest("http://localhost:3000/api/game", "POST"))
    {
        byte[] bodyRaw = System.Text.Encoding.UTF8.GetBytes(json);
        request.uploadHandler = new UploadHandlerRaw(bodyRaw);
        request.downloadHandler = new DownloadHandlerBuffer();
        request.SetRequestHeader("Content-Type", "application/json");
        
        yield return request.SendWebRequest();
        
        if (request.result == UnityWebRequest.Result.Success)
        {
            Debug.Log($"Wallet registered: {walletAddress}");
        }
        else
        {
            Debug.LogError($"Wallet registration failed: {request.error}");
        }
    }
}

[System.Serializable]
public class RegisterWalletRequest
{
    public string type;
    public string wallet;
}
```

### How to get the wallet from the web page

The wallet is available from the web page's connected state. From Unity, you can read it via JavaScript interop:

```csharp
// Call this from Unity to get the wallet from the parent web page
[DllImport("__Internal")]
private static extern string GetWalletAddress();

// Or read it from the URL params / page context
public string GetWalletFromPage()
{
    #if UNITY_WEBGL && !UNITY_EDITOR
        return GetWalletAddress(); // JS plugin returns wallet
    #else
        return PlayerPrefs.GetString("testWallet", "");
    #endif
}
```

You'll need a small JS plugin in your Unity WebGL template:

```javascript
// In your Unity WebGL template's .js file
mergeInto(LibraryManager.library, {
    GetWalletAddress: function() {
        // Read from the parent page's React state or localStorage
        var wallet = localStorage.getItem('connectedWallet') || '';
        var bufferSize = lengthBytesUTF8(wallet) + 1;
        var buffer = _malloc(bufferSize);
        stringToUTF8(wallet, buffer, bufferSize);
        return buffer;
    }
});
```

---

## 3. Sending Game State (Live Updates)

### What it does
During gameplay, Unity sends real-time state updates so the web UI can display score, level, moves, and accuracy in an overlay on top of the iframe.

### When to send
- After every move (tile placement)
- When level changes
- When game starts/ends
- Every 1-2 seconds during active play

### Endpoint
```
POST http://localhost:3000/api/game
Content-Type: application/json

{
  "gameState": {
    "status": "playing",
    "mode": "practice",
    "score": 1250,
    "level": 3,
    "moves": 47,
    "accuracy": 87.2,
    "matchId": "match-uuid-here",
    "startedAt": 1712345678901
  }
}
```

### Game state fields

| Field | Type | Required | Description |
|---|---|---|---|
| `status` | string | Yes | `"idle"` / `"playing"` / `"paused"` / `"finished"` |
| `mode` | string | No | `"practice"` / `"bot"` / `"multiplayer"` |
| `score` | int | Yes | Current score |
| `level` | int | Yes | Current level (1-based) |
| `moves` | int | Yes | Total moves made this match |
| `accuracy` | float | Yes | Current accuracy percentage (0-100) |
| `matchId` | string | No | Unique match identifier (for linking to training data) |
| `startedAt` | long | No | Match start timestamp (ms since epoch) |
| `wallet` | string | No | Player wallet (if not already registered) |

### Response
```json
{ "ok": true, "state": { ... } }
```

### Unity C# Implementation

```csharp
public class GameStateReporter : MonoBehaviour
{
    private float reportInterval = 1.0f; // Send every 1 second
    private float lastReportTime;
    
    // Current match state
    private string currentMatchId;
    private long matchStartTime;
    private int totalMoves;
    private int correctMoves;
    
    void Update()
    {
        if (Time.time - lastReportTime >= reportInterval && IsPlaying())
        {
            lastReportTime = Time.time;
            StartCoroutine(SendGameState());
        }
    }
    
    public void OnMatchStart(string matchId, string mode)
    {
        currentMatchId = matchId;
        matchStartTime = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        totalMoves = 0;
        correctMoves = 0;
    }
    
    public void OnTilePlaced(bool correct)
    {
        totalMoves++;
        if (correct) correctMoves++;
    }
    
    private IEnumerator SendGameState()
    {
        float accuracy = totalMoves > 0 ? (correctMoves * 100f / totalMoves) : 100f;
        
        var state = new GameStateUpdate
        {
            gameState = new GameStateData
            {
                status = "playing",
                mode = GameManager.Instance.currentMode,
                score = GameManager.Instance.score,
                level = GameManager.Instance.currentLevel,
                moves = totalMoves,
                accuracy = accuracy,
                matchId = currentMatchId,
                startedAt = matchStartTime
            }
        };
        
        string json = JsonUtility.ToJson(state);
        
        using (UnityWebRequest request = new UnityWebRequest("http://localhost:3000/api/game", "POST"))
        {
            byte[] bodyRaw = System.Text.Encoding.UTF8.GetBytes(json);
            request.uploadHandler = new UploadHandlerRaw(bodyRaw);
            request.downloadHandler = new DownloadHandlerBuffer();
            request.SetRequestHeader("Content-Type", "application/json");
            
            yield return request.SendWebRequest();
            // Fire and forget — don't block gameplay on this
        }
    }
}

[System.Serializable]
public class GameStateUpdate
{
    public GameStateData gameState;
}

[System.Serializable]
public class GameStateData
{
    public string status;
    public string mode;
    public int score;
    public int level;
    public int moves;
    public float accuracy;
    public string matchId;
    public long startedAt;
}
```

---

## 4. Sending Training Telemetry (Match End)

### What it does
When a match finishes, Unity sends the complete move history. This is the **core of the training system** — the web app analyzes these moves to build the player's agent profile.

### When to send
- **Exactly once** when a match ends (win, loss, or abandoned)
- Include ALL moves from the match

### Endpoint
```
POST http://localhost:3000/api/training/record
Content-Type: application/json
```

### Request Body

```json
{
  "wallet": "GrtjuV...zuX",
  "matchId": "match-uuid-here",
  "startedAt": 1712345678901,
  "endedAt": 1712345789012,
  "finalScore": 2450,
  "maxLevel": 5,
  "result": "win",
  "moves": [
    {
      "ts": 1712345679000,
      "tileType": "blue",
      "targetColumn": 2,
      "actualColumn": 2,
      "correct": true,
      "responseTimeMs": 350,
      "score": 50,
      "level": 1,
      "stackHeight": 3
    },
    {
      "ts": 1712345680500,
      "tileType": "red",
      "targetColumn": 4,
      "actualColumn": 3,
      "correct": false,
      "responseTimeMs": 420,
      "score": 50,
      "level": 1,
      "stackHeight": 2
    }
  ]
}
```

### Request Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `wallet` | string | Yes | Player's Solana wallet pubkey |
| `matchId` | string | Yes | Unique identifier for this match (UUID) |
| `startedAt` | long | Yes | Match start timestamp (ms since epoch) |
| `endedAt` | long | Yes | Match end timestamp (ms since epoch) |
| `finalScore` | int | Yes | Final score at match end |
| `maxLevel` | int | Yes | Highest level reached |
| `result` | string | Yes | `"win"` / `"loss"` / `"abandoned"` |
| `moves` | array | Yes | Array of individual move records |

### Move Record Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `ts` | long | Yes | Move timestamp (ms since epoch) |
| `tileType` | string | Yes | Tile identifier (color, shape, etc.) |
| `targetColumn` | int | Yes | Column where tile SHOULD go (optimal) |
| `actualColumn` | int | Yes | Column where player PLACED it |
| `correct` | bool | Yes | Was placement correct? |
| `responseTimeMs` | int | Yes | Time from tile appearing to placement (ms) |
| `score` | int | Yes | Score at moment of this move |
| `level` | int | Yes | Current level when move was made |
| `stackHeight` | int | Yes | Stack height at actualColumn after placement |

### Response

```json
{
  "ok": true,
  "matchId": "match-uuid-here",
  "matchesPlayed": 5,
  "matchesRequired": 5,
  "trainingReady": true,
  "profile": {
    "skillTier": "intermediate",
    "overallAccuracy": 82.5,
    "speedTier": "quick",
    "stackingStyle": "center-first",
    "strategySummary": "Player skill: intermediate (82.5% accuracy)..."
  }
}
```

### Unity C# Implementation

```csharp
public class TrainingReporter : MonoBehaviour
{
    // Record every move during the match
    private List<MoveData> moveBuffer = new List<MoveData>();
    private string matchId;
    private long matchStartTime;
    private int maxLevelReached;
    private string playerWallet;
    
    public void StartMatch(string wallet)
    {
        playerWallet = wallet;
        matchId = Guid.NewGuid().ToString();
        matchStartTime = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        moveBuffer.Clear();
        maxLevelReached = 1;
    }
    
    /// <summary>
    /// Call this EVERY time a tile is placed (correct or incorrect)
    /// </summary>
    public void RecordMove(
        string tileType,
        int targetColumn,
        int actualColumn,
        bool correct,
        int responseTimeMs,
        int currentScore,
        int currentLevel,
        int stackHeight)
    {
        maxLevelReached = Mathf.Max(maxLevelReached, currentLevel);
        
        moveBuffer.Add(new MoveData
        {
            ts = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
            tileType = tileType,
            targetColumn = targetColumn,
            actualColumn = actualColumn,
            correct = correct,
            responseTimeMs = responseTimeMs,
            score = currentScore,
            level = currentLevel,
            stackHeight = stackHeight
        });
    }
    
    /// <summary>
    /// Call this when the match ends (win, loss, or quit)
    /// </summary>
    public void SubmitMatch(string result, int finalScore)
    {
        StartCoroutine(SubmitTrainingData(result, finalScore));
    }
    
    private IEnumerator SubmitTrainingData(string result, int finalScore)
    {
        long now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        
        var payload = new TrainingPayload
        {
            wallet = playerWallet,
            matchId = matchId,
            startedAt = matchStartTime,
            endedAt = now,
            finalScore = finalScore,
            maxLevel = maxLevelReached,
            result = result,
            moves = moveBuffer.ToArray()
        };
        
        string json = JsonUtility.ToJson(payload);
        
        using (UnityWebRequest request = new UnityWebRequest(
            "http://localhost:3000/api/training/record", "POST"))
        {
            byte[] bodyRaw = System.Text.Encoding.UTF8.GetBytes(json);
            request.uploadHandler = new UploadHandlerRaw(bodyRaw);
            request.downloadHandler = new DownloadHandlerBuffer();
            request.SetRequestHeader("Content-Type", "application/json");
            
            yield return request.SendWebRequest();
            
            if (request.result == UnityWebRequest.Result.Success)
            {
                Debug.Log($"Training data submitted: {request.downloadHandler.text}");
                
                // Parse response to check if agent is now trained
                var response = JsonUtility.FromJson<TrainingResponse>(
                    request.downloadHandler.text);
                
                if (response.trainingReady)
                {
                    Debug.Log("🎉 Agent is now trained and ready!");
                    // Optionally show UI notification
                }
            }
            else
            {
                Debug.LogError($"Training submission failed: {request.error}");
            }
        }
    }
}

// Data classes
[System.Serializable]
public class MoveData
{
    public long ts;
    public string tileType;
    public int targetColumn;
    public int actualColumn;
    public bool correct;
    public int responseTimeMs;
    public int score;
    public int level;
    public int stackHeight;
}

[System.Serializable]
public class TrainingPayload
{
    public string wallet;
    public string matchId;
    public long startedAt;
    public long endedAt;
    public int finalScore;
    public int maxLevel;
    public string result;
    public MoveData[] moves;
}

[System.Serializable]
public class TrainingResponse
{
    public bool ok;
    public string matchId;
    public int matchesPlayed;
    public int matchesRequired;
    public bool trainingReady;
}
```

---

## 5. Complete Game Manager Integration

Here's how all the pieces fit together in a game manager:

```csharp
public class GameManager : MonoBehaviour
{
    public static GameManager Instance;
    
    [Header("References")]
    public SSEListener sseListener;
    public GameStateReporter stateReporter;
    public TrainingReporter trainingReporter;
    
    [Header("Game State")]
    public string currentMode;    // "practice", "bot"
    public int score;
    public int currentLevel;
    public bool isPlaying;
    
    private string playerWallet;
    
    void Awake()
    {
        Instance = this;
    }
    
    void Start()
    {
        // 1. Start listening for commands from the web agent
        sseListener.StartListening();
        sseListener.OnGameCommand += HandleGameCommand;
        sseListener.OnConnected += HandleConnected;
    }
    
    void HandleConnected(string wallet)
    {
        if (!string.IsNullOrEmpty(wallet))
        {
            playerWallet = wallet;
            Debug.Log($"Wallet connected: {wallet}");
            StartCoroutine(RegisterWallet(wallet));
        }
    }
    
    void HandleGameCommand(string action, string wallet)
    {
        if (!string.IsNullOrEmpty(wallet))
            playerWallet = wallet;
            
        Debug.Log($"Game command: {action}");
        
        switch (action)
        {
            case "StartBotMode":
                StartMatch("bot");
                break;
            case "StartPracticeMode":
                StartMatch("practice");
                break;
            case "ExitToMainMenu":
                ReturnToMenu();
                break;
            case "GetPracticeStatus":
                SendPracticeStatus();
                break;
        }
    }
    
    void StartMatch(string mode)
    {
        currentMode = mode;
        score = 0;
        currentLevel = 1;
        isPlaying = true;
        
        string matchId = Guid.NewGuid().ToString();
        
        // Notify reporters
        stateReporter.OnMatchStart(matchId, mode);
        trainingReporter.StartMatch(playerWallet);
        
        // Start the actual game
        // ... your game logic here ...
    }
    
    /// <summary>
    /// Call this every time the player places a tile
    /// </summary>
    public void OnTilePlaced(
        string tileType,
        int targetColumn,
        int actualColumn,
        int responseTimeMs,
        int stackHeight)
    {
        bool correct = targetColumn == actualColumn;
        if (correct) score += 50;
        
        stateReporter.OnTilePlaced(correct);
        trainingReporter.RecordMove(
            tileType,
            targetColumn,
            actualColumn,
            correct,
            responseTimeMs,
            score,
            currentLevel,
            stackHeight
        );
    }
    
    void OnMatchEnd(string result)
    {
        isPlaying = false;
        trainingReporter.SubmitMatch(result, score);
    }
    
    void ReturnToMenu()
    {
        if (isPlaying)
        {
            OnMatchEnd("abandoned");
        }
        // ... show menu UI ...
    }
    
    // ... rest of game logic ...
}
```

---

## 6. CORS & Local Development

### Important: The web app runs on `localhost:3000`

Unity WebGL builds running in the same browser can make fetch requests to `localhost:3000` without CORS issues because they're on the same origin (the Unity iframe is served from the Next.js app).

### If running Unity Editor (not WebGL)

You'll need to make HTTP requests from Unity Editor to `localhost:3000`. This works fine for testing but won't work in production WebGL builds — the URL must be relative (`/api/game`) in WebGL.

```csharp
#if UNITY_EDITOR
    private string baseUrl = "http://localhost:3000";
#else
    private string baseUrl = ""; // Relative URL for WebGL
#endif
```

---

## 7. Debugging

### Check if SSE is working
```bash
curl -N http://localhost:3000/api/game
# Should stream heartbeats every 3 seconds
```

### Send a test command
```bash
curl -X POST http://localhost:3000/api/game \
  -H "Content-Type: application/json" \
  -d '{"action":"StartBotMode","wallet":"test123"}'
```

### Check game state
```bash
curl http://localhost:3000/api/game?mode=state
```

### Check training data
```bash
curl "http://localhost:3000/api/training/stats?wallet=YOUR_WALLET"
curl "http://localhost:3000/api/training/profile?wallet=YOUR_WALLET"
```

### Check player status
```bash
curl "http://localhost:3000/api/player/status?wallet=YOUR_WALLET"
```

---

## Checklist — What Unity Needs to Implement

- [ ] SSE Listener — connect to `/api/game` GET, parse events
- [ ] Command handler — switch on action types (StartBotMode, etc.)
- [ ] Wallet registration — POST wallet to `/api/game`
- [ ] Game state reporter — POST state updates during gameplay
- [ ] Move buffer — collect every tile placement with timing data
- [ ] Training reporter — POST match telemetry to `/api/training/record` on match end
- [ ] Match ID generation — unique UUID per match
- [ ] Response time tracking — measure time from tile spawn to placement
- [ ] Target column detection — know where the tile SHOULD go vs where it was placed
- [ ] WebGL URL handling — relative URLs in builds, absolute in editor

---

## Related

- [[StakeStack]] — Project overview
- [[Web3 Game Engine]] — Separate project (G3Engine)
