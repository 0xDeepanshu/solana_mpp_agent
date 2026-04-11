UNITY API CALLS (JS -> Unity)
------------------------------
Object Name in Hierarchy: "ApiManager"

Start Bot Match:
myUnityInstance.SendMessage('ApiManager', 'StartBotMode');

Start Practice Match:
myUnityInstance.SendMessage('ApiManager', 'StartPracticeMode');

Start Multiplayer Search:
myUnityInstance.SendMessage('ApiManager', 'StartMultiplayerMode');

Exit to Main Menu:
myUnityInstance.SendMessage('ApiManager', 'ExitToMainMenu');

Get Practice Stats:
myUnityInstance.SendMessage('ApiManager', 'GetPracticeStatus');
