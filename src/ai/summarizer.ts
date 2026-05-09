import { getLogger } from '../lib/logger';

const logger = getLogger('summarizer');

/**
 * Cloudflare Workers AIを使用してリポジトリの要約を生成します。
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
    // READMEが長すぎる場合は切り詰める(トークン制限対策)
    const truncatedReadme = readme.slice(0, 3000);

    // コグニティブ・デザイン原則に基づく構造化プロンプト
    const prompt = [
      '# 思考のレンズ',
      '',
      '## 前提 (Premise)',
      '- あなたはGitHubリポジトリの本質を正確に捉え、簡潔に伝える専門家です',
      '- 良い要約とは「読者がリポジトリの核心を一瞬で理解できる」ものです',
      '- 機能の羅列ではなく、プロジェクトの存在意義・本質を伝えることが最重要です',
      '- 「これは何であるか」が明確でなければ、機能を列挙しても価値がありません',
      '',
      '## 状況 (Situation)',
      '- GitHubトレンドに掲載されたリポジトリ情報が与えられています',
      '- 読者は多数のリポジトリを短時間でスクリーニングしています',
      '- 要約は通知として配信され、読者の興味喚起が目的です',
      '- 読者はエンジニアであり、技術的な正確性を求めています',
      '',
      '## 目的 (Purpose)',
      '- リポジトリの「本質」を最初の一文で明確に伝える',
      '- 読者が「これは何か」を即座に理解できる要約を生成する',
      '- 技術的特徴より「何を解決するか」「何であるか」を優先する',
      '',
      '## 動機 (Motive)',
      '- 開発者の情報収集効率を最大化する',
      '- トレンドリポジトリの価値を正確に伝達する',
      '- 読者が「これは自分に関係あるか」を瞬時に判断できるようにする',
      '',
      '## 制約 (Constraint)',
      '- 日本語で150文字以内',
      '- 最初の一文は必ず「〇〇は、△△である」または「△△するための□□」の形式で本質を述べる',
      '- 機能の羅列は禁止(本質 → 特徴の順序を厳守)',
      '- 余計な前置き・挨拶・解説は一切出力しない',
      '- 要約のみを出力する',
      '',
      '## 実行指示',
      '以下のリポジトリ情報に基づき、上記の思考レンズに従って要約を作成してください。',
      '',
      '### リポジトリ情報',
      `- Name: ${name}`,
      `- Description: ${description}`,
      '',
      '### README (抜粋)',
      truncatedReadme,
      '',
      '要約のみを出力してください。',
    ].join('\n');

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
    const err =
      error instanceof Error
        ? {
            name: error.name,
            message: error.message,
            stack: error.stack,
            cause: error.cause,
          }
        : error;

    logger.error(
      {
        repo: name,
        descriptionLength: description.length,
        readmeLength: readme.length,
        err,
      },
      'AI summary generation failed',
    );
    // 失敗時はシステムを止めず、元の説明文を返す(フォールバック)
    return description;
  }
}
