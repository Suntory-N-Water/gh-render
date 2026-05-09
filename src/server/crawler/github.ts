/**
 * リポジトリのREADMEを取得します。
 * mainブランチから取得を試み、失敗した場合はmasterブランチを試します。
 */
export async function fetchRepositoryReadme({
  owner,
  repo,
}: {
  owner: string;
  repo: string;
}): Promise<string | null> {
  // まずmainブランチを試す
  const mainUrl = `https://raw.githubusercontent.com/${owner}/${repo}/main/README.md`;
  const mainResp = await fetch(mainUrl);
  if (mainResp.ok) {
    return await mainResp.text();
  }

  // 失敗したらmasterブランチを試す
  const masterUrl = `https://raw.githubusercontent.com/${owner}/${repo}/master/README.md`;
  const masterResp = await fetch(masterUrl);
  if (masterResp.ok) {
    return await masterResp.text();
  }

  return null;
}
