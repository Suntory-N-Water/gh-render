# サーバーサイド テストケース

## 分類

| ファイル | 分類 | テスト種別 |
|--|--|--|
| `src/server/lib/repository.ts`(書き直し後) | コントローラ | 統合テスト |
| FTS5 同期処理(新規実装) | コントローラ | 統合テスト |
| Hono API ルート(新規実装) | コントローラ | 統合テスト |

---

## `repository.ts`

```ts
describe("リポジトリの保存", () => {
  describe("正常系", () => {
    describe("新規リポジトリ", () => {
      it.todo("保存したとき、repositories テーブルにレコードが存在すること")
      it.todo("要約ありで保存したとき、repository_summaries にレコードが存在すること")
      it.todo("詳細要約ありで保存したとき、repository_detailed_summaries にレコードが存在すること")
      it.todo("要約なしで保存したとき、summary が NULL のままであること")
      it.todo("保存したとき、first_notified_at と last_updated_at が設定されること")
    })
    describe("既存リポジトリの再保存", () => {
      it.todo("同じ URL で再保存したとき、update_count が1増加すること")
      it.todo("同じ URL で再保存したとき、last_updated_at が更新されること")
      it.todo("同じ URL で再保存したとき、first_notified_at が変わらないこと")
      it.todo("要約がある状態で要約なしの再保存をしたとき、既存の要約が保持されること")
    })
  })
})

describe("リポジトリの一括取得", () => {
  describe("正常系", () => {
    it.todo("複数 URL を指定したとき、存在する URL のレコードのみ返ること")
    it.todo("存在しない URL を含む配列を渡したとき、存在する URL のみ返ること")
  })
  describe("異常系", () => {
    it.todo("空の URL 配列を渡したとき、空の Map が返ること")
  })
})
```

---

## FTS5 同期処理

```ts
describe("FTS5 同期", () => {
  describe("正常系", () => {
    describe("挿入時の同期", () => {
      it.todo("リポジトリを保存したとき、URL で FTS5 検索にヒットすること")
      it.todo("リポジトリを保存したとき、説明文で FTS5 検索にヒットすること")
    })
    describe("更新時の同期", () => {
      it.todo("要約を更新したとき、新しい要約テキストで FTS5 検索にヒットすること")
      it.todo("詳細要約を更新したとき、新しい詳細要約テキストで FTS5 検索にヒットすること")
    })
    describe("検索の精度", () => {
      it.todo("別のリポジトリのキーワードで検索したとき、対象外のリポジトリがヒットしないこと")
    })
  })
})
```

---

## Hono API ルート

```ts
describe("リポジトリ一覧取得 API", () => {
  describe("正常系", () => {
    describe("ページネーション", () => {
      it.todo("cursor なしのとき、先頭からデータが返ること")
      it.todo("cursor を渡したとき、続きのデータが返ること")
      it.todo("limit を超えるデータが存在するとき、limit 件数のデータが返ること")
    })
    describe("言語フィルタ", () => {
      it.todo("言語を指定したとき、その言語のリポジトリのみ返ること")
      it.todo("存在しない言語を指定したとき、空の結果が返ること")
    })
  })
  describe("異常系", () => {
    it.todo("不正な cursor 値を渡したとき、適切なエラーが返ること")
  })
})

describe("全文検索 API", () => {
  describe("正常系", () => {
    it.todo("検索キーワードに一致するリポジトリが存在するとき、該当リポジトリが返ること")
    it.todo("どのリポジトリにも一致しないキーワードで検索したとき、空の結果が返ること")
  })
})
```
