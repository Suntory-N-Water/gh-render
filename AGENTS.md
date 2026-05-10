Cloudflare Workers 上で動作する GitHub のトレンドを定期的に収集するリポジトリ

- ログ・コメント・コミットメッセージは日本語で記載する
- 明示的に求められない限り、後方互換性を維持しない
- 不明な点は推測で断言せず、Context7 MCP・Web Search・公式ドキュメント・GitHub issue 等で調査してから回答する
- 調査しても根拠が得られない場合は「わからない」と明示する

| 目的 | コマンド |
|---|---|
| 静的解析 | `bun run ai-check`(Stop hook で自動実行) |

- Hono 関連の情報は`hono` コマンドを使用する
  - 使用方法は`hono --help` で確認する
- GitHub の情報取得には `gh` コマンドを使用する
- ライブラリの仕様は Context7 MCP サーバーを使用する
- `lint` エラー時は `unsafe-fix` を使用してから個別に修正する
