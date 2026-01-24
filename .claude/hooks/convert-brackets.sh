#!/bin/bash
# 全角カッコを半角カッコに変換するフック
# PostToolUse イベントで Edit/Write ツールの実行後に自動実行されます

# stdin から JSON を読み込み、file_path を抽出
file_path=$(jq -r '.tool_input.file_path // empty')

# ファイルパスが空の場合は終了
if [ -z "$file_path" ]; then
  exit 0
fi

# ファイルが存在しない場合は終了
if [ ! -f "$file_path" ]; then
  exit 0
fi

# 変換対象の拡張子かチェック
case "$file_path" in
  *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs|*.json|*.md|*.mdx|*.txt|*.yml|*.yaml|*.toml|*.sh|*.bash)
    # 全角カッコを半角カッコに変換
    # macOS の sed は -i '' が必要
    if sed -i '' \
      -e 's/(/((/g' \
      -e 's/)/)/g' \
      -e 's/[/[/g' \
      -e 's/]/]/g' \
      -e 's/{/{/g' \
      -e 's/}/}/g' \
      -e 's/</</g' \
      -e 's/>/>/g' \
      "$file_path"; then
      echo "✓ 全角カッコを半角カッコに変換: $file_path"
    fi
    ;;
  *)
    # 対象外の拡張子はスキップ
    exit 0
    ;;
esac

exit 0
