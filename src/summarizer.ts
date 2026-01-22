import { getLogger } from './logger';

const logger = getLogger('summarizer');

/**
 * Cloudflare Workers AIを使用してリポジトリの要約を生成します。
 * @param params パラメータオブジェクト
 * @param params.ai Cloudflare AIバインディング
 * @param params.name リポジトリ名
 * @param params.description 元の説明文
 * @param params.readme READMEコンテンツ
 * @returns 生成された要約（失敗時は元の説明文）
 */
export async function generateSummary({
  ai,
  name,
  description,
  readme,
}: {
  ai: Ai;
  name: string;
  description: string;
  readme: string;
}): Promise<string> {
  try {
    // READMEが長すぎる場合は切り詰める（トークン制限対策）
    const truncatedReadme = readme.slice(0, 3000);

    const prompt = `
あなたは技術的なGitHubリポジトリの内容を、エンジニア向けに簡潔な日本語で要約する厳格なアシスタントです。
余計な会話、前置き、挨拶（例：「はい、要約します」「以下は要約です」など）は一切出力しないでください。
出力は要約されたテキストのみにしてください。

# 制約事項
- **必ず日本語で出力すること**。元のアドバイスやテキストが英語でも、翻訳・要約して日本語にする。
- 3行以内の文章にまとめる。
- リポジトリの具体的な機能、解決する問題、技術的な特徴に焦点を当てる。
- 「このリポジトリは」のような主語は極力省略し、体言止めや動詞で終わる簡潔な文体にする。

# Repository Info
Name: ${name}
Original Description: ${description}

# README (Truncated)
${truncatedReadme}
`;

    const result = await ai.run('@cf/meta/llama-4-scout-17b-16e-instruct', {
      messages: [
        {
          role: 'system',
          content:
            'You are a strict summarization assistant. You strictly output ONLY the summary in Japanese. Do not output any introductory text.',
        },
        { role: 'user', content: prompt },
      ],
    });

    const summary = result.response;

    if (!summary) {
      logger.warn({ repo: name }, 'AI returned empty summary');
      return description;
    }

    return summary.trim();
  } catch (error) {
    logger.error({ repo: name, err: error }, 'AI summary generation failed');
    // 失敗時はシステムを止めず、元の説明文を返す（フォールバック）
    return description;
  }
}
