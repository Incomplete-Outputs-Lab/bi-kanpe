# Bi-Kanpe StreamDeck Plugin

StreamDeck plugin for integrating with Bi-Kanpe caster mode. This plugin allows you to send feedback messages and react to incoming messages directly from your StreamDeck.

## Features

- **Send Feedback**: Send custom feedback messages to the director with configurable content and type
- **React to Latest**: Quickly react to the most recent message with a single button press
- Real-time connection status indication
- Support for multiple feedback types (Ack, Question, Issue, Info)

## Requirements

- Elgato StreamDeck software version 6.0 or higher
- Bi-Kanpe application running in caster mode
- StreamDeck server enabled in Bi-Kanpe caster app

## Installation

### Building from Source

1. Install dependencies:
   ```bash
   cd streamdeck-plugin
   bun install
   ```

2. Build the plugin:
   ```bash
   bun run build
   ```

3. Install the plugin:
   - Locate the built plugin at `com.misei.bi-kanpe.sdPlugin`
   - Double-click the folder or drag it into the StreamDeck application
   - The plugin will be installed and available in the actions list

### Installing Pre-built Plugin

1. Download the `.streamDeckPlugin` file from releases
2. Double-click the file to install
3. The plugin will appear in your StreamDeck actions list

## Setup

### 1. Enable StreamDeck Server in Bi-Kanpe

1. Open Bi-Kanpe and select "キャスターモード" (Caster Mode)
2. Connect to your director's server
3. In the StreamDeck Integration section, click "起動" (Start)
4. Note the port number (default: 9877)

### 2. Configure StreamDeck Actions

#### Send Feedback Action

1. Drag "Send Feedback" action to a button
2. Configure settings:
   - **Server Address**: Enter the address shown in Bi-Kanpe (e.g., `localhost:9877`)
   - **Feedback Type**: Choose the type of feedback (Ack, Question, Issue, Info)
   - **Message Content**: Enter the message you want to send
3. Press the button to send the feedback

#### React to Latest Action

1. Drag "React to Latest" action to a button
2. Configure settings:
   - **Server Address**: Enter the address shown in Bi-Kanpe (e.g., `localhost:9877`)
   - **Reaction Type**: Choose the type of reaction (Ack, Question, Issue, Info)
3. The button will change appearance when a new message is received
4. Press the button to send a quick reaction to the latest message

## Feedback Types

- **Ack (了解)**: Acknowledgment - "I understand"
- **Question (質問)**: Question - "I have a question"
- **Issue (問題)**: Issue - "There's a problem"
- **Info (情報)**: Information - "I want to share information"

## Troubleshooting

### ⚠️ プラグインがロードされない / ボタンが反応しない

**主な原因:**
1. **アイコンファイルが不足** - 全ての画像ファイルが `imgs/` フォルダに存在することを確認
2. **plugin.jsが生成されていない** - `bun run build` を実行してプラグインをビルド
3. **StreamDeckアプリの再起動が必要** - 変更後はStreamDeckアプリを完全に再起動

**確認手順:**
1. `com.misei.bi-kanpe.sdPlugin/bin/plugin.js` が存在するか確認
2. `com.misei.bi-kanpe.sdPlugin/imgs/` に画像ファイルが存在するか確認
3. StreamDeckアプリを完全に終了して再起動
4. ログファイルでプラグインが正常に初期化されたことを確認

### 📋 ログの確認方法

StreamDeckのログは以下の場所にあります：

**Windows:**
```
%APPDATA%\Elgato\StreamDeck\logs\StreamDeck.log
```

**Mac:**
```
~/Library/Logs/StreamDeck/StreamDeck.log
```

**確認すべきログ:**
- プラグインの初期化ログ
- アクションのボタン押下ログ
- WebSocket接続成功ログ
- メッセージ送信成功ログ

### Connection Issues

- Ensure Bi-Kanpe caster app is running and connected to a server
- Verify StreamDeck server is started in Bi-Kanpe (green status indicator)
- Check that the server address matches the one shown in Bi-Kanpe
- Try using `localhost:9877` or `127.0.0.1:9877`
- ログで `[BiKanpeClient] WebSocket error` を確認

### Actions Not Working

- Check StreamDeck console for error messages (right-click StreamDeck icon → "Show Logs")
- Verify all settings are configured correctly
- Try reconnecting to the server by toggling StreamDeck server in Bi-Kanpe
- ログで `[SendFeedbackAction] Button pressed!` が出力されているか確認

### Button Not Updating

- Ensure you're connected to the caster app
- The "React to Latest" button updates every 5 seconds - wait a moment after a new message arrives
- ログで `[ReactToLatestAction] New message detected` を確認

### 詳細なトラブルシューティング

詳細な手順については `INSTALLATION.md` を参照してください。

## Development

### Project Structure

```
streamdeck-plugin/
├── src/
│   ├── plugin.ts                 # Main plugin entry point
│   ├── ws-client.ts              # WebSocket client implementation
│   └── actions/
│       ├── send-feedback.ts      # Send Feedback action
│       └── react-to-latest.ts    # React to Latest action
├── com.misei.bi-kanpe.sdPlugin/
│   ├── manifest.json             # Plugin manifest
│   ├── bin/                      # Compiled plugin code
│   ├── imgs/                     # Action icons
│   │   ├── actions/
│   │   │   ├── send-feedback/
│   │   │   └── react-to-latest/
│   │   └── plugin/
│   └── ui/                       # Property Inspector HTML
│       ├── send-feedback.html
│       └── react-to-latest.html
├── package.json
├── tsconfig.json
└── rollup.config.mjs
```

### Building

```bash
# Install dependencies
bun install

# Build once
bun run build

# Watch mode (rebuild on changes)
bun run watch

# Clean build artifacts
bun run clean
```

### Adding Icons

Icon images are located in `com.misei.bi-kanpe.sdPlugin/imgs/`:
- `actions/send-feedback/` - Send Feedback action icons
- `actions/react-to-latest/` - React to Latest action icons (including alert state)
- `plugin/` - Plugin and category icons

Required icons for each action:
- `icon.png` & `icon@2x.png` - Action list icon
- `key.png` & `key@2x.png` - Button appearance

For React to Latest action:
- `key-alert.png` & `key-alert@2x.png` - Alert state when new message arrives

Recommended sizes:
- Action icons: 144x144 pixels (288x288 for @2x)
- Key images: 72x72 pixels (144x144 for @2x)

## License

MIT

## Support

For issues and feature requests, please visit the [bi-kanpe repository](https://github.com/your-org/bi-kanpe).
