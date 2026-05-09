import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkStringify from 'remark-stringify';
import { unified } from 'unified';

type MarkdownNode = {
  type: string;
  identifier?: string;
  value?: string;
  children?: MarkdownNode[];
};

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm, {
    tablePipeAlign: false,
  })
  .use(remarkStringify, {
    bullet: '-',
    fences: true,
  });

/**
 * READMEをAI要約とDB保存に使いやすいMarkdownへ正規化します。
 */
export function normalizeReadmeMarkdown(readme: string): string {
  const tree = processor.parse(readme);
  const usedImageReferences = new Set<string>();
  const usedLinkReferences = new Set<string>();

  collectReferences({
    node: tree as MarkdownNode,
    usedImageReferences,
    usedLinkReferences,
  });
  removeUnwantedNodes({
    node: tree as MarkdownNode,
    usedImageReferences,
    usedLinkReferences,
  });

  return processor.stringify(tree).trim();
}

function collectReferences({
  node,
  usedImageReferences,
  usedLinkReferences,
}: {
  node: MarkdownNode;
  usedImageReferences: Set<string>;
  usedLinkReferences: Set<string>;
}): void {
  if (node.type === 'imageReference' && node.identifier) {
    usedImageReferences.add(normalizeIdentifier(node.identifier));
  }

  if (node.type === 'linkReference' && node.identifier) {
    usedLinkReferences.add(normalizeIdentifier(node.identifier));
  }

  for (const child of node.children ?? []) {
    collectReferences({ node: child, usedImageReferences, usedLinkReferences });
  }
}

function removeUnwantedNodes({
  node,
  usedImageReferences,
  usedLinkReferences,
}: {
  node: MarkdownNode;
  usedImageReferences: Set<string>;
  usedLinkReferences: Set<string>;
}): boolean {
  if (isRemovableNode(node)) {
    return false;
  }

  if (
    node.type === 'definition' &&
    node.identifier &&
    usedImageReferences.has(normalizeIdentifier(node.identifier)) &&
    !usedLinkReferences.has(normalizeIdentifier(node.identifier))
  ) {
    return false;
  }

  if (node.children) {
    node.children = node.children.filter((child) =>
      removeUnwantedNodes({
        node: child,
        usedImageReferences,
        usedLinkReferences,
      }),
    );
  }

  return !isEmptyContainer(node);
}

function isEmptyContainer(node: MarkdownNode): boolean {
  if (
    !['paragraph', 'heading', 'listItem', 'link', 'linkReference'].includes(
      node.type,
    )
  ) {
    return false;
  }

  return (node.children ?? []).every((child) => {
    if (child.children) {
      return isEmptyContainer(child);
    }

    return typeof child.value === 'string' && child.value.trim() === '';
  });
}

function isRemovableNode(node: MarkdownNode): boolean {
  return (
    node.type === 'html' ||
    node.type === 'image' ||
    node.type === 'imageReference' ||
    node.type === 'thematicBreak'
  );
}

function normalizeIdentifier(identifier: string): string {
  return identifier.toUpperCase();
}
