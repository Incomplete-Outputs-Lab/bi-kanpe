# Bi-Kanpe (BiDirectional Kanban Paper System) 実装仕様書

## 1. プロジェクト概要

### プロジェクト名
**Bi-Kanpe** (BiDirectional Kanban Paper System)

### 目的
イベント現場でディレクターから演者へのカンペ表示と、双方向フィードバックを実現するオフライン動作可能なデスクトップアプリケーション

### 技術スタック
- **デスクトップアプリ**: Tauri (Rust + Web技術)
- **通信**: WebSocket (ローカルネットワーク)
- **Stream Deck連携**: streamdeck-rs
- **フロントエンド**: React/Vue/Svelte (任意選択)

---

## 2. システムアーキテクチャ

### 2.1 動作モード

#### サーバーモード（ディレクター用）
- WebSocketサーバーを起動（デフォルトポート: 9876）
- 複数のクライアント接続を管理
- 仮想モニターの状態管理
- メッセージ配信制御
- Stream Deckからのコマンド受信

#### クライアントモード（モニター表示用）
- WebSocketクライアントとしてサーバーに接続
- 自身に割り当てられた仮想モニターIDを設定
- 指定されたモニターID宛のメッセージのみ表示
- 演者からのフィードバック送信
- Stream Deckからのフィードバック送信

### 2.2 ネットワーク構成

```
┌─────────────────────────────────────┐
│      ディレクター (サーバーモード)    │
│      Port: 9876                     │
│                                     │
│  セッション内の仮想モニター:         │
│  - Monitor ID: 1 (演者A)            │
│  - Monitor ID: 2 (演者B)            │
│  - Monitor ID: 3 (司会)             │
│  - Monitor ID: 4 (スタッフ)         │
└────────┬────────────────────────────┘
         │ WebSocket (全モニターのメッセージを配信)
    ┌────┴─────┬─────────┬──────────┐
    │          │         │          │
┌───┴────┐ ┌──┴───┐ ┌───┴────┐ ┌──┴───┐
│Client A│ │Client│ │Client C│ │Client│
│        │ │  B   │ │        │ │  D   │
│表示:   │ │表示: │ │表示:   │ │表示: │
│Mon 1   │ │Mon 2 │ │Mon 1   │ │全Mon │
│        │ │      │ │Mon 3   │ │      │
└────────┘ └──────┘ └────────┘ └──────┘
```

**重要な概念**:
- **セッション**: ディレクターが管理する1つの配信セッション
- **仮想モニター**: セッション内に存在する論理的な表示先（演者やスタッフごとに割り当て）
- **クライアント**: 物理的なデバイス・ウィンドウ
- **クライアントとモニターの関係**: 
  - クライアントは全モニター宛のメッセージをWebSocketで受信
  - クライアント側の設定で「どのモニターIDを表示するか」を選択
  - 1クライアントで複数モニターを同時表示可能
  - 同じモニターIDを複数クライアントで表示可能（例: 同じPCで3画面同じ内容）

### 2.3 仮想モニターの設計

**仮想モニターとは**:
- セッション内に存在する論理的な「カンペの宛先」
- 物理デバイスとは独立した概念
- ディレクター側でモニターID 1, 2, 3... を定義

**クライアント側の表示制御**:
- クライアントは全メッセージを受信（WebSocket経由）
- クライアント設定で「表示対象モニターID」を指定
- 指定したIDのメッセージのみをUIに表示
- 表示対象IDは複数選択可能

**ユースケース例**:
1. **基本パターン**: Client A → Monitor 1のみ表示
2. **マルチロール**: Client B → Monitor 2 と Monitor 5 を表示（1人で2役）
3. **バックアップ**: Client C → Monitor 1 を表示（Client Aと同じ内容）
4. **モニタリング**: Client D → 全モニター表示（スタッフ用監視画面）
5. **複数ウィンドウ**: 同じPC上で3ウィンドウ、全て Monitor 1 を表示

---

## 3. 通信プロトコル仕様

### 3.1 WebSocket接続

**サーバー**:
- アドレス: `ws://[サーバーIP]:9876`
- JSONテキストフレームを使用（バイナリは使用しない）

**接続フロー**:
1. クライアントが接続
2. クライアントが自己紹介メッセージ送信
3. サーバーが接続確認を返信
4. 以降、双方向メッセージング

### 3.2 メッセージフォーマット

#### 基本メッセージ構造（JSON）

```json
{
  "type": "message_type",
  "id": "unique_message_id",
  "timestamp": 1234567890123,
  "payload": {}
}
```

#### メッセージタイプ一覧

##### 1. クライアント接続通知 (`client_hello`)
**送信**: Client → Server
```json
{
  "type": "client_hello",
  "id": "msg_001",
  "timestamp": 1234567890123,
  "payload": {
    "client_id": "client_uuid_001",
    "client_name": "演者Aモニター",
    "display_monitor_ids": [1, 3]
  }
}
```
**説明**:
- `display_monitor_ids`: このクライアントが画面表示するモニターIDのリスト
- クライアントは全メッセージを受信するが、このIDリストに含まれるメッセージのみUIに表示

##### 2. サーバー接続確認 (`server_welcome`)
**送信**: Server → Client
```json
{
  "type": "server_welcome",
  "id": "msg_002",
  "timestamp": 1234567890124,
  "payload": {
    "server_id": "server_uuid",
    "connected_clients": 5,
    "message": "接続しました"
  }
}
```

##### 3. カンペメッセージ (`kanpe_message`)
**送信**: Server → Client(s)
```json
{
  "type": "kanpe_message",
  "id": "msg_003",
  "timestamp": 1234567890125,
  "payload": {
    "target_monitor_ids": [1, 2],  // 0 = 全モニター
    "content": "伸ばしてください",
    "template_id": "template_001",
    "priority": "normal",  // "low" | "normal" | "high" | "urgent"
    "display_duration": null,  // null = 手動消去まで表示, 数値 = 秒数
    "style": {
      "font_size": "large",
      "color": "#FFFFFF",
      "background": "#000000"
    }
  }
}
```

##### 4. フィードバックメッセージ (`feedback_message`)
**送信**: Client → Server
```json
{
  "type": "feedback_message",
  "id": "msg_004",
  "timestamp": 1234567890126,
  "payload": {
    "client_id": "client_uuid_001",
    "source_monitor_id": 1,
    "reply_to_message_id": "msg_003",  // 返信対象のメッセージID
    "feedback_type": "acknowledged",  // "acknowledged" | "request" | "alert"
    "content": "了解です",
    "template_id": "feedback_template_001"
  }
}
```
**説明**:
- `source_monitor_id`: フィードバックを送信している仮想モニターのID（複数モニター表示時の識別用）

##### 5. メッセージ既読通知 (`message_read`)
**送信**: Client → Server
```json
{
  "type": "message_read",
  "id": "msg_005",
  "timestamp": 1234567890127,
  "payload": {
    "client_id": "client_uuid_001",
    "read_message_id": "msg_003"
  }
}
```

##### 6. クライアント一覧要求 (`get_clients`)
**送信**: Server内部 or 管理UI → Server
```json
{
  "type": "get_clients",
  "id": "msg_006",
  "timestamp": 1234567890128,
  "payload": {}
}
```

**応答**: Server → Requester
```json
{
  "type": "clients_list",
  "id": "msg_007",
  "timestamp": 1234567890129,
  "payload": {
    "clients": [
      {
        "client_id": "client_uuid_001",
        "display_monitor_ids": [1, 3],
        "client_name": "演者Aモニター",
        "connected_at": 1234567890000,
        "last_seen": 1234567890129
      }
    ]
  }
}
```

##### 7. Ping/Pong（接続維持）
**送信**: Server ⇄ Client
```json
{
  "type": "ping",
  "id": "msg_008",
  "timestamp": 1234567890130,
  "payload": {}
}
```

---

## 4. データモデル

### 4.1 テンプレートメッセージ

#### ディレクター側テンプレート
```json
{
  "templates": [
    {
      "id": "template_001",
      "category": "direction",
      "content": "伸ばしてください",
      "priority": "normal",
      "shortcut_key": "F1",
      "stream_deck_button": 1
    },
    {
      "id": "template_002",
      "category": "direction",
      "content": "押してます",
      "priority": "high",
      "shortcut_key": "F2",
      "stream_deck_button": 2
    },
    {
      "id": "template_003",
      "category": "alert",
      "content": "トラブルです",
      "priority": "urgent",
      "shortcut_key": "F3",
      "stream_deck_button": 3
    }
  ]
}
```

#### 演者側テンプレート
```json
{
  "templates": [
    {
      "id": "feedback_template_001",
      "category": "feedback",
      "content": "了解です",
      "feedback_type": "acknowledged",
      "stream_deck_button": 1
    },
    {
      "id": "feedback_template_002",
      "category": "request",
      "content": "お水ください",
      "feedback_type": "request",
      "stream_deck_button": 2
    }
  ]
}
```

### 4.2 アプリケーション設定

```json
{
  "app_config": {
    "mode": "server",  // "server" | "client"
    "server": {
      "port": 9876,
      "bind_address": "0.0.0.0",
      "max_clients": 50
    },
    "client": {
      "server_address": "192.168.1.100:9876",
      "display_monitor_ids": [1],
      "client_name": "演者Aモニター",
      "auto_reconnect": true,
      "reconnect_interval": 5000
    },
    "display": {
      "font_family": "Noto Sans JP",
      "default_font_size": "48px",
      "fullscreen": true,
      "theme": "dark"
    },
    "stream_deck": {
      "enabled": true,
      "api_port": 9877
    }
  }
}
```

---

## 5. Tauri実装詳細

### 5.1 プロジェクト構造

```
bi-kanpe/
├── src/                     # Rustバックエンド
│   ├── main.rs             # Tauriエントリーポイント
│   ├── server.rs           # WebSocketサーバー実装
│   ├── client.rs           # WebSocketクライアント実装
│   ├── message.rs          # メッセージ型定義
│   ├── state.rs            # アプリケーション状態管理
│   └── streamdeck_api.rs   # Stream Deck API実装
├── src-tauri/
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── icons/
├── ui/                      # フロントエンド（React/Vue/Svelte）
│   ├── src/
│   │   ├── components/
│   │   │   ├── ServerView.tsx      # サーバーモードUI
│   │   │   ├── ClientView.tsx      # クライアントモードUI
│   │   │   ├── MessageInput.tsx    # メッセージ入力
│   │   │   ├── KanpeDisplay.tsx    # カンペ表示
│   │   │   └── Settings.tsx        # 設定画面
│   │   ├── App.tsx
│   │   └── main.tsx
│   └── package.json
└── README.md
```

### 5.2 Cargo.toml 依存関係

```toml
[dependencies]
tauri = { version = "2.x", features = ["protocol-asset"] }
tokio = { version = "1", features = ["full"] }
tokio-tungstenite = "0.21"
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
uuid = { version = "1.0", features = ["v4", "serde"] }
chrono = "0.4"
futures-util = "0.3"
```

### 5.3 主要なTauriコマンド

Tauri側で実装するコマンドインターフェース：

#### サーバーモード用コマンド
- `start_server(port: u16)` - WebSocketサーバー起動
- `send_kanpe_message(target_monitor_ids: Vec<u32>, content: String, priority: String)` - カンペメッセージ送信
- `get_connected_clients()` - 接続中のクライアント一覧取得
- `stop_server()` - サーバー停止

#### クライアントモード用コマンド
- `connect_to_server(address: String, display_monitor_ids: Vec<u32>)` - サーバーに接続
- `send_feedback(reply_to_message_id: String, content: String, source_monitor_id: u32)` - フィードバック送信
- `disconnect_from_server()` - サーバーから切断

#### 共通コマンド
- `get_app_config()` - アプリ設定取得
- `save_app_config(config: AppConfig)` - アプリ設定保存
- `get_templates()` - テンプレート一覧取得

### 5.4 メッセージ型定義

Rust側で定義する主要な型：

```rust
// メッセージの基本列挙型
enum Message {
    ClientHello { id: String, timestamp: i64, payload: ClientHelloPayload },
    ServerWelcome { id: String, timestamp: i64, payload: ServerWelcomePayload },
    KanpeMessage { id: String, timestamp: i64, payload: KanpeMessagePayload },
    FeedbackMessage { id: String, timestamp: i64, payload: FeedbackMessagePayload },
    MessageRead { id: String, timestamp: i64, payload: MessageReadPayload },
    Ping { id: String, timestamp: i64 },
    Pong { id: String, timestamp: i64 },
}

// 優先度
enum Priority {
    Low,
    Normal,
    High,
    Urgent,
}

// フィードバックタイプ
enum FeedbackType {
    Acknowledged,
    Request,
    Alert,
}
```

### 5.5 WebSocket実装の要件

#### サーバー側
- `tokio-tungstenite` を使用したWebSocketサーバー
- 複数クライアント同時接続管理（HashMap等で管理）
- 全クライアントへのブロードキャスト機能
- クライアント接続/切断イベントハンドリング
- Ping/Pongによる接続維持

#### クライアント側
- `tokio-tungstenite` を使用したWebSocketクライアント
- 全メッセージ受信（フィルタリングはUI層で実施）
- 自動再接続機能
- 接続状態のイベント通知（フロントエンドへ）

### 5.6 フロントエンド ⇄ Rust間のイベント

#### Rust → フロントエンド（emit）
- `client_connected` - 新規クライアント接続
- `client_disconnected` - クライアント切断
- `kanpe_message_received` - カンペメッセージ受信
- `feedback_received` - フィードバック受信
- `server_started` - サーバー起動完了
- `connection_established` - サーバーへの接続成功
- `connection_lost` - サーバーとの接続切断

#### フロントエンド → Rust（invoke）
- 5.3で定義したTauriコマンド群

---

## 6. Stream Deck連携仕様

### 6.1 概要

Stream Deckプラグインとして以下の機能を提供：

**ディレクター側機能**:
- テンプレートメッセージ送信ボタン
  - 「伸ばしてください」
  - 「押してます」
  - 「トラブルです」
  - など
- 送信先モニターID選択
- カスタムメッセージ送信

**演者側機能**:
- フィードバック送信ボタン
  - 「了解です」
  - 「お水ください」
  - など

### 6.2 使用ライブラリ

- **streamdeck-rs**: https://github.com/mdonoughe/streamdeck-rs
- Rustベースのプラグイン実装

### 6.3 Bi-Kanpe ⇄ Stream Deck プラグイン間の通信

**通信方式**: WebSocketまたはHTTP REST API

**推奨アーキテクチャ**:
1. Bi-Kanpeアプリが別ポート（例: 9877）でAPIサーバーを起動
2. Stream DeckプラグインがローカルホストのAPIにリクエスト送信
3. Bi-Kanpeアプリがメッセージを内部WebSocketで配信

**APIエンドポイント例**:
```
POST /api/send_message
Body: {
  "target_monitor_ids": [1, 2],
  "content": "伸ばしてください",
  "template_id": "template_001"
}

POST /api/send_feedback
Body: {
  "source_monitor_id": 1,
  "reply_to_message_id": "msg_003",
  "content": "了解です",
  "template_id": "feedback_template_001"
}

GET /api/status
Response: {
  "mode": "server",
  "connected_clients": 5,
  "active_monitors": [1, 2, 3]
}
```

### 6.4 プラグインマニフェスト構造

```json
{
  "Name": "Bi-Kanpe Controller",
  "Version": "1.0.0",
  "Author": "Your Name",
  "Actions": [
    {
      "UUID": "com.yourcompany.bikanpe.send-message",
      "Name": "カンペ送信",
      "Icon": "icons/send"
    },
    {
      "UUID": "com.yourcompany.bikanpe.feedback",
      "Name": "フィードバック",
      "Icon": "icons/feedback"
    }
  ]
}
```

### 6.5 ボタン設定

各Stream Deckボタンには以下の設定を保持：
- テンプレートID
- 送信先モニターID（ディレクター側のみ）
- カスタムメッセージ内容
- 優先度設定

---

## 7. UIコンポーネント設計

### 7.1 サーバーモード（ディレクター画面）

**機能**:
- 接続中クライアント一覧表示
  - クライアント名
  - 表示対象モニターID
  - 接続状態
- メッセージ送信インターフェース
  - テンプレート選択
  - カスタムメッセージ入力
  - 送信先モニターID選択（個別選択 or ID=0で全体）
  - 優先度設定
- 受信フィードバック表示
  - どのモニターから送信されたか
  - 元メッセージとの紐付け
- メッセージ履歴

**レイアウト例**:
```
┌─────────────────────────────────────────┐
│ Bi-Kanpe - サーバーモード                │
├─────────────┬───────────────────────────┤
│             │                           │
│ 接続中      │  メッセージ送信           │
│ クライアント │  ┌─────────────────┐    │
│ ───────     │  │送信先モニター    │    │
│ Client A    │  │ ☐ 全体 (ID:0)    │    │
│  表示: 1    │  │ ☐ 演者A (ID:1)   │    │
│ Client B    │  │ ☐ 演者B (ID:2)   │    │
│  表示: 2    │  │ ☐ 司会  (ID:3)   │    │
│ Client C    │  └─────────────────┘    │
│  表示: 1,3  │                           │
│             │  テンプレート:            │
│             │  [伸ばしてください]       │
│             │  [押してます]             │
│             │  [トラブルです]           │
│             │                           │
│             │  カスタム:                │
│             │  [________________]       │
│             │  優先度: [通常▼]         │
│             │  [送信]                   │
│             │                           │
├─────────────┴───────────────────────────┤
│ フィードバック受信                       │
│ 12:34 Monitor 1: 了解です (→msg_003)  │
│ 12:35 Monitor 2: お水ください           │
└─────────────────────────────────────────┘
```

### 7.2 クライアントモード（モニター表示画面）

**機能**:
- カンペメッセージ全画面表示
  - WebSocketで全メッセージを受信
  - 設定した`display_monitor_ids`に一致するメッセージのみUI表示
  - target_monitor_ids に 0 が含まれる場合は全クライアントが表示
- 優先度に応じた色分け・フォントサイズ変更
- フィードバック送信ボタン（画面下部に小さく配置）
- 複数モニターID表示時は、どのIDのメッセージか識別可能に

**表示フィルタリングロジック**:
```
受信メッセージの target_monitor_ids に以下のいずれかが該当する場合に表示:
1. 0 が含まれる（全体宛）
2. 自分の display_monitor_ids と交差する
```

**レイアウト例（単一モニター表示）**:
```
┌─────────────────────────────────────────┐
│                                         │
│                                         │
│                                         │
│          伸ばしてください               │
│          (Monitor 1)                    │
│                                         │
│                                         │
│                                         │
│         [了解] [お水] [トラブル]        │
└─────────────────────────────────────────┘
```

**レイアウト例（複数モニター表示）**:
```
┌──────────────────┬──────────────────────┐
│  Monitor 1       │  Monitor 3           │
│                  │                      │
│ 伸ばしてください │ そろそろ締めて       │
│                  │                      │
│ [了解][お水]     │ [了解][次へ]         │
└──────────────────┴──────────────────────┘
```

---

## 8. 実装ステップ

### フェーズ1: 基本通信機能
1. Tauriプロジェクト作成
2. WebSocketサーバー/クライアント実装
3. 基本的なメッセージ送受信
4. モード切替機能

### フェーズ2: UI実装
1. サーバーモードUI
2. クライアントモードUI
3. 設定画面

### フェーズ3: テンプレート機能
1. テンプレートメッセージ管理
2. テンプレート送信/受信

### フェーズ4: Stream Deck連携
1. streamdeck-rsプラグイン実装
2. Tauri ⇄ Stream Deck通信
3. ボタンマッピング

### フェーズ5: 高度な機能
1. メッセージ履歴
2. 既読管理
3. 自動再接続
4. ログ機能

---

## 9. テスト計画

### 9.1 単体テスト
- メッセージシリアライズ/デシリアライズ
- WebSocket接続/切断
- モニターIDフィルタリング

### 9.2 統合テスト
- 1サーバー複数クライアント接続
- メッセージルーティング
- フィードバック受信

### 9.3 負荷テスト
- 同時接続数: 50クライアント
- メッセージスループット

---

## 10. セキュリティ考慮事項

- ローカルネットワーク限定使用
- 認証機能（オプション）
  - サーバー接続時のパスワード
  - クライアント接続許可リスト

---

## 11. 今後の拡張案

- mDNSによるサーバー自動検出
- メッセージの暗号化
- クラウド同期機能（オンライン環境）
- スマートフォンアプリ対応
- 複数言語対応

---

## 付録A: 設定ファイル例

**config.json**
```json
{
  "version": "1.0.0",
  "mode": "server",
  "server": {
    "port": 9876,
    "max_clients": 50
  },
  "client": {
    "server_address": "192.168.1.100:9876",
    "display_monitor_ids": [1],
    "client_name": "演者Aモニター"
  },
  "templates": {
    "director": [
      { "id": "t1", "content": "伸ばしてください", "key": "F1" },
      { "id": "t2", "content": "押してます", "key": "F2" },
      { "id": "t3", "content": "トラブルです", "key": "F3" }
    ],
    "performer": [
      { "id": "f1", "content": "了解です", "key": "1" },
      { "id": "f2", "content": "お水ください", "key": "2" }
    ]
  }
}
```

---

## 付録B: エラーハンドリング

### エラーコード
- `E001`: WebSocketサーバー起動失敗
- `E002`: クライアント接続失敗
- `E003`: メッセージ送信失敗
- `E004`: 不正なメッセージフォーマット
- `E005`: 認証失敗

### エラー時の動作
- 自動再接続（クライアント側）
- エラーログ記録
- ユーザーへの通知

---

以上
