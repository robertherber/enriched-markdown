import type { MouseEvent } from 'react';
import type { ASTNode, RendererProps, RendererMap } from '../types';
import { extractNodeText } from '../utils';
import { KaTeXRenderer } from './KaTeXRenderer';
import {
  linkPillIconStyle,
  linkPillLabelStyle,
  linkPillStyle,
  linkStyleForUrl,
  linkVariantForUrl,
} from '../styles';

// Same rule as native: links holding these stay ordinary links.
const NON_PILL_CONTENT = new Set<ASTNode['type']>([
  'Image',
  'LatexMathInline',
  'LineBreak',
  'Spoiler',
]);

function canBePill(node: ASTNode): boolean {
  return (node.children ?? []).every(
    (child) => !NON_PILL_CONTENT.has(child.type) && canBePill(child)
  );
}

function TextRenderer({ node }: RendererProps) {
  return <>{node.content ?? ''}</>;
}

function LineBreakRenderer(_props: RendererProps) {
  return <br />;
}

function SoftBreakRenderer(_props: RendererProps) {
  return <> </>;
}

function StrongRenderer({ node, styles, renderChildren }: RendererProps) {
  return <strong style={styles.strong}>{renderChildren(node)}</strong>;
}

function EmphasisRenderer({ node, styles, renderChildren }: RendererProps) {
  return <em style={styles.emphasis}>{renderChildren(node)}</em>;
}

function StrikethroughRenderer({
  node,
  styles,
  renderChildren,
}: RendererProps) {
  return <s style={styles.strikethrough}>{renderChildren(node)}</s>;
}

function UnderlineRenderer({ node, styles, renderChildren }: RendererProps) {
  return <u style={styles.underline}>{renderChildren(node)}</u>;
}

function SuperscriptRenderer({ node, styles, renderChildren }: RendererProps) {
  return <sup style={styles.superscript}>{renderChildren(node)}</sup>;
}

function SubscriptRenderer({ node, styles, renderChildren }: RendererProps) {
  return <sub style={styles.subscript}>{renderChildren(node)}</sub>;
}

function HighlightRenderer({ node, styles, renderChildren }: RendererProps) {
  return <mark style={styles.highlight}>{renderChildren(node)}</mark>;
}

function CodeRenderer({ node, styles, renderChildren }: RendererProps) {
  return (
    <code style={styles.code}>{node.content ?? renderChildren(node)}</code>
  );
}

function LinkRenderer({
  node,
  style,
  callbacks,
  capabilities,
  renderChildren,
}: RendererProps) {
  const url = node.attributes?.url;

  if (!url) return <>{renderChildren(node)}</>;

  const handleClick = (event: MouseEvent) => {
    if (callbacks.onLinkPress) {
      event.preventDefault();
      callbacks.onLinkPress({ url });
    }
  };

  const handleContextMenu = (event: MouseEvent) => {
    if (callbacks.onLinkLongPress) {
      event.preventDefault();
      callbacks.onLinkLongPress({ url });
    }
  };

  const variant = linkVariantForUrl(style, url);
  if (variant?.pill.enabled && canBePill(node)) {
    const { pill } = variant;
    const content = capabilities.linkPillContent?.[url];
    const originalText = extractNodeText(node);
    const label = content?.label || pill.label || undefined;
    const iconUri = content?.iconUri || pill.iconUri;
    // A per-link icon keeps its colors unless its own entry tints it.
    const iconTintColor =
      content?.iconTintColor ??
      (content?.iconUri ? undefined : pill.iconTintColor);
    const accessibleName =
      label && label !== originalText ? `${label}, ${originalText}` : undefined;

    return (
      <a
        href={url}
        style={{
          ...linkStyleForUrl(style, url),
          ...linkPillStyle(pill, variant.backgroundColor),
        }}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={accessibleName}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
      >
        {iconUri ? (
          iconTintColor ? (
            <span
              aria-hidden
              style={linkPillIconStyle(iconUri, String(iconTintColor))}
            />
          ) : (
            <img
              alt=""
              src={iconUri}
              style={linkPillIconStyle(iconUri, undefined)}
              onError={(event) => {
                event.currentTarget.style.display = 'none';
              }}
            />
          )
        ) : null}
        <span style={linkPillLabelStyle}>{label ?? renderChildren(node)}</span>
      </a>
    );
  }

  return (
    <a
      href={url}
      style={linkStyleForUrl(style, url)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      onContextMenu={handleContextMenu}
    >
      {renderChildren(node)}
    </a>
  );
}

function LatexMathInlineRenderer({
  node,
  styles,
  capabilities,
}: RendererProps) {
  const content = extractNodeText(node);

  return (
    <KaTeXRenderer
      content={content}
      katex={capabilities.katex}
      displayMode={false}
      style={styles.mathInline}
    />
  );
}

export const inlineRenderers: RendererMap = {
  Text: TextRenderer,
  LineBreak: LineBreakRenderer,
  SoftBreak: SoftBreakRenderer,
  Strong: StrongRenderer,
  Emphasis: EmphasisRenderer,
  Strikethrough: StrikethroughRenderer,
  Underline: UnderlineRenderer,
  Superscript: SuperscriptRenderer,
  Subscript: SubscriptRenderer,
  Highlight: HighlightRenderer,
  Code: CodeRenderer,
  Link: LinkRenderer,
  LatexMathInline: LatexMathInlineRenderer,
};
