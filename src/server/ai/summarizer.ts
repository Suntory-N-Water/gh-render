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
      '- 良い要約とは「読者がリポジトリの核心を一瞬で理解できる」ものである',
      '- 機能の羅列ではなく、プロジェクトの存在意義・本質を伝えることが最重要である',
      '- 「これは何であるか」が明確でなければ、機能を列挙しても価値がない',
      '',
      '## 状況 (Situation)',
      '- GitHubトレンドに掲載されたリポジトリ情報が与えられている',
      '- 読者は多数のリポジトリを短時間でスクリーニングしている',
      '- 要約は通知として配信され、読者の興味喚起が目的である',
      '- 読者はエンジニアであり、技術的な正確性を求めている',
      '',
      '## 目的 (Purpose)',
      '- リポジトリの「本質」を最初の一文で明確に伝える',
      '- 読者が「これは何か」を即座に理解できる要約を生成する',
      '- 技術的特徴より「何を解決するか」「何であるか」を優先する',
      '',
      '## 動機 (Motive)',
      '- エンジニアの情報収集コストを削減し、本当に必要な情報だけを届ける',
      '- 読者が「これは自分に関係あるか」を瞬時に判断できるようにする',
      '',
      '## 制約 (Constraint)',
      '- 日本語で150文字以内',
      '- 最初の一文は必ず「〇〇は、△△である」または「△△するための□□」の形式で本質を述べる',
      '- 機能の羅列は禁止(本質 → 特徴の順序を厳守)',
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
            '指示された要約のみを出力せよ。前置き・確認・解説・挨拶は一切出力しない。',
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
    // 失敗時はシステムを止めず、元の説明文を返す
    return description;
  }
}

/**
 * Cloudflare Workers AIを使用してリポジトリの詳細要約を生成します。
 */
export async function generateDetailedSummary({
  ai,
  name,
  description,
  readme,
}: {
  ai: Ai;
  name: string;
  description: string;
  readme: string;
}): Promise<string | null> {
  try {
    // 詳細要約はより多くのコンテキストを使う
    const truncatedReadme = readme.slice(0, 8000);

    const prompt = [
      '# 思考のレンズ',
      '',
      '## 前提 (Premise)',
      '- 良い詳細要約とは「読者がリポジトリを実際に使うか判断できる」情報を提供するものである',
      '- 機能の羅列より「何を解決するか」「どう実現するか」が本質である',
      '',
      '## 状況 (Situation)',
      '- GitHubトレンドに掲載されたリポジトリの詳細情報が与えられている',
      '- 読者はすでにリポジトリの存在を知り、より深い内容を知りたいと思っている段階にある',
      '- 読者はエンジニアであり、技術的な深さと採用判断に必要な具体性を求めている',
      '',
      '## 目的 (Purpose)',
      '- リポジトリの概要・主な機能・技術的注目点を網羅的に伝える詳細要約を生成する',
      '- 読者が「このリポジトリを使うか・学ぶか」を判断できる情報を提供する',
      '',
      '## 動機 (Motive)',
      '- エンジニアの技術選定における意思決定を高速化する',
      '- 実際にリポジトリを調べるコストを削減し、必要な情報だけを効率的に届ける',
      '',
      '## 制約 (Constraint)',
      '- 日本語で400文字以内',
      '- 以下の構成で書く:',
      '  1. 概要: プロジェクトの目的・解決する課題(1〜2文)',
      '  2. 主な機能・特徴: 箇条書き3〜5点',
      '  3. 技術的な注目点: 実装上の工夫や特徴的な設計(1〜2文)',
      '- 詳細要約のみを出力する',
      '',
      '## 実行指示',
      '以下のリポジトリ情報に基づき、上記の思考レンズに従って詳細要約を作成してください。',
      '',
      '### リポジトリ情報',
      `- Name: ${name}`,
      `- Description: ${description}`,
      '',
      '### README (抜粋)',
      truncatedReadme,
      '',
      '詳細要約のみを出力してください。',
    ].join('\n');

    const result = await ai.run('@cf/meta/llama-4-scout-17b-16e-instruct', {
      messages: [
        {
          role: 'system',
          content:
            '指示された詳細要約のみを出力せよ。前置き・確認・解説・挨拶は一切出力しない。',
        },
        { role: 'user', content: prompt },
      ],
    });

    const detailedSummary = result.response;

    if (!detailedSummary) {
      logger.warn({ repo: name }, 'AI returned empty detailed summary');
      return null;
    }

    return detailedSummary.trim();
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
        err,
      },
      'AI detailed summary generation failed',
    );
    return null;
  }
}
