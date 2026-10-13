"use client";

import { useEffect, useRef, useState } from "react";
import type { ClipboardEvent, KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent } from "react";

type HeadingTag = "p" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6";

type Props = {
  name: string;
  defaultValue?: string;
  placeholder?: string;
  onChange?: (value: string) => void;
  compact?: boolean;
  tickBullets?: boolean;
};

function showEditorError(message: string) {
  window.alert(message);
}

function normalizeLeadingBareUrlLink(html: string): string {
  if (!html.trim() || typeof document === "undefined") return html;

  const container = document.createElement("div");
  container.innerHTML = html;

  const contextualLinks = Array.from(container.querySelectorAll("a[href]"));
  const contextualLink = contextualLinks.find((link) => {
    const text = link.textContent?.trim() ?? "";
    return Boolean(text) && !/^\/?https?:\/\//i.test(text);
  });

  if (!contextualLink) return html;

  const scope =
    contextualLink.closest("p,div,h1,h2,h3,h4,h5,h6,blockquote,li") ??
    container;

  const prefixRange = document.createRange();
  prefixRange.setStart(scope, 0);
  prefixRange.setEndBefore(contextualLink);

  const prefixText = prefixRange.cloneContents().textContent?.trim() ?? "";

  // Older editor behavior could leave the entered URL visible immediately
  // before the correctly linked words. Delete only that accidental URL prefix;
  // never touch normal copy that appears before a link.
  if (/^\/?https?:\/\/\S+\/?$/i.test(prefixText)) {
    prefixRange.deleteContents();

    Array.from(scope.querySelectorAll("a,span,strong,em,b,i,u")).forEach(
      (element) => {
        if (!element.textContent?.trim() && element.children.length === 0) {
          element.parentNode?.removeChild(element);
        }
      },
    );

    return container.innerHTML;
  }

  return html;
}

function ReferenceRichTextEditor({
  value,
  onChange,
  placeholder = "Write the full product description...",
  compact = false,
  tickBullets = false,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  compact?: boolean;
  tickBullets?: boolean;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const savedRangeRef = useRef<Range | null>(null);
  const selectionBookmarkRef = useRef<{
    start: number;
    end: number;
    selectedText: string;
  } | null>(null);
  const [blockType, setBlockType] = useState("p");

  function createTextBookmark(editor: HTMLDivElement, range: Range) {
    try {
      const startProbe = document.createRange();
      startProbe.selectNodeContents(editor);
      startProbe.setEnd(range.startContainer, range.startOffset);

      const endProbe = document.createRange();
      endProbe.selectNodeContents(editor);
      endProbe.setEnd(range.endContainer, range.endOffset);

      return {
        start: startProbe.cloneContents().textContent?.length ?? 0,
        end: endProbe.cloneContents().textContent?.length ?? 0,
        selectedText: range.toString(),
      };
    } catch {
      return null;
    }
  }

  function restoreRangeFromTextBookmark(
    editor: HTMLDivElement,
    bookmark: { start: number; end: number; selectedText: string },
  ): Range | null {
    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
    let currentOffset = 0;
    let startNode: Text | null = null;
    let endNode: Text | null = null;
    let startOffset = 0;
    let endOffset = 0;

    while (walker.nextNode()) {
      const node = walker.currentNode as Text;
      const length = node.data.length;
      const nextOffset = currentOffset + length;

      if (!startNode && bookmark.start >= currentOffset && bookmark.start <= nextOffset) {
        startNode = node;
        startOffset = Math.min(bookmark.start - currentOffset, length);
      }

      if (bookmark.end >= currentOffset && bookmark.end <= nextOffset) {
        endNode = node;
        endOffset = Math.min(bookmark.end - currentOffset, length);
        break;
      }

      currentOffset = nextOffset;
    }

    if (!startNode || !endNode) return null;

    try {
      const range = document.createRange();
      range.setStart(startNode, startOffset);
      range.setEnd(endNode, endOffset);

      if (range.collapsed) return null;

      // The editor may re-render while the URL dialog is open. The text-offset
      // bookmark survives that re-render, but we still verify that the restored
      // range points to the same selected words before applying the link.
      const restoredText = range.toString();
      if (bookmark.selectedText && restoredText !== bookmark.selectedText) {
        return null;
      }

      return range;
    } catch {
      return null;
    }
  }

  useEffect(() => {
    const editor = editorRef.current;
    const normalizedValue = normalizeLeadingBareUrlLink(value || "");

    if (
      editor &&
      editor.innerHTML !== normalizedValue &&
      document.activeElement !== editor
    ) {
      editor.innerHTML = normalizedValue;
    }

    if (normalizedValue !== value) {
      onChange(normalizedValue);
    }
  }, [value, onChange]);

  function syncValue() {
    const editor = editorRef.current;
    if (!editor) return;

    const normalizedValue = normalizeLeadingBareUrlLink(editor.innerHTML);
    if (normalizedValue !== editor.innerHTML) {
      editor.innerHTML = normalizedValue;
    }
    onChange(normalizedValue);
  }

  function saveSelection() {
    const selection = window.getSelection();

    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);

    if (
      editorRef.current &&
      editorRef.current.contains(range.commonAncestorContainer)
    ) {
      savedRangeRef.current = range.cloneRange();
    }
  }

  function restoreSelection() {
    const editor = editorRef.current;
    if (!editor) return;

    editor.focus();

    if (!savedRangeRef.current) return;

    const selection = window.getSelection();
    if (!selection) return;

    selection.removeAllRanges();
    selection.addRange(savedRangeRef.current);
  }

  function runCommand(command: string, commandValue?: string) {
    restoreSelection();
    document.execCommand(command, false, commandValue);
    saveSelection();
    syncValue();
  }

  function currentBlockTag(): HeadingTag {
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount || !editorRef.current) return "p";
    const block = closestEditableBlock(selection.getRangeAt(0).startContainer);
    const tag = block?.tagName.toLowerCase();
    if (tag === "h1" || tag === "h2" || tag === "h3" || tag === "h4" || tag === "h5" || tag === "h6") return tag;
    return "p";
  }

  function syncBlockType() {
    setBlockType(currentBlockTag());
  }

  function applyBlock(tag: string) {
    restoreSelection();
    const editor = editorRef.current;
    if (editor) editor.focus();

    const wrapped = `<${tag}>`;
    const applied =
      document.execCommand("formatBlock", false, wrapped) ||
      document.execCommand("formatBlock", false, tag);

    if (!applied && (tag === "h1" || tag === "h2" || tag === "h3" || tag === "h4" || tag === "h5" || tag === "h6" || tag === "p")) {
      applyHeadingShortcut(tag);
      return;
    }

    const selection = window.getSelection();
    const block = selection?.rangeCount ? closestEditableBlock(selection.getRangeAt(0).startContainer) : null;
    if (block && block.tagName.toLowerCase() !== tag) {
      const replacement = document.createElement(tag);
      replacement.innerHTML = block.innerHTML || "<br>";
      block.replaceWith(replacement);
    }

    setBlockType(tag);
    saveSelection();
    syncValue();
  }

  function insertTickList() {
    restoreSelection();
    const editor = editorRef.current;
    if (editor) editor.focus();
    document.execCommand("insertUnorderedList");
    editor?.querySelectorAll("ul").forEach((list) => {
      list.classList.add("tick-list");
      list.querySelectorAll("li").forEach((item) => {
        if (!item.textContent?.replace(/[✓\s]/g, "").trim() && !item.querySelector("img,br")) {
          item.textContent = "";
        }
      });
    });
    saveSelection();
    syncValue();
  }

  async function addLink() {
    restoreSelection();

    const selection = window.getSelection();
    const editor = editorRef.current;

    if (
      !editor ||
      !selection ||
      selection.rangeCount === 0 ||
      selection.isCollapsed
    ) {
      showEditorError("Please select the text you want to link.");
      return;
    }

    const selectedRange = selection.getRangeAt(0).cloneRange();

    if (
      !editor.contains(selectedRange.startContainer) ||
      !editor.contains(selectedRange.endContainer)
    ) {
      showEditorError("Please select text inside the product description.");
      return;
    }

    savedRangeRef.current = selectedRange.cloneRange();
    selectionBookmarkRef.current = createTextBookmark(editor, selectedRange);

    if (!selectionBookmarkRef.current) {
      showEditorError("Unable to preserve the selected text. Please select the words again.");
      return;
    }

    const enteredUrl = window.prompt("Enter internal or external link", "");

    if (!enteredUrl?.trim()) return;

    let url = enteredUrl.trim();

    // Guard against the old prompt's leading slash being pasted together with
    // a full external URL, e.g. /https://example.com.
    url = url.replace(/^\/+(?=https?:\/\/)/i, "");

    const isRelativeInternal =
      (url.startsWith("/") && !url.startsWith("//")) ||
      url.startsWith("./") ||
      url.startsWith("../");

    const alreadyAbsoluteOrSpecial =
      url.startsWith("http://") ||
      url.startsWith("https://") ||
      url.startsWith("mailto:") ||
      url.startsWith("tel:") ||
      url.startsWith("#");

    if (!isRelativeInternal && !alreadyAbsoluteOrSpecial) {
      url = `https://${url}`;
    }

    // The styled admin prompt moves focus away from the contentEditable and can
    // cause React/browser DOM updates to invalidate the original Range object.
    // Rebuild the selection from stable text offsets instead of relying on the
    // pre-dialog DOM nodes.
    const bookmark = selectionBookmarkRef.current;
    const range = bookmark
      ? restoreRangeFromTextBookmark(editor, bookmark)
      : null;

    if (!range) {
      showEditorError("The selected words changed while the link dialog was open. Please select them again.");
      return;
    }

    const fragment = range.extractContents();
    const fragmentContainer = document.createElement("span");
    fragmentContainer.appendChild(fragment);

    // Avoid nested anchors when re-linking text that already contains a link.
    Array.from(fragmentContainer.querySelectorAll("a")).forEach((existingLink) => {
      existingLink.replaceWith(...Array.from(existingLink.childNodes));
    });

    const anchor = document.createElement("a");
    anchor.setAttribute("href", url);

    while (fragmentContainer.firstChild) {
      anchor.appendChild(fragmentContainer.firstChild);
    }

    const isInternal =
      (url.startsWith("/") && !url.startsWith("//")) ||
      url.startsWith("./") ||
      url.startsWith("../") ||
      url.includes("zelvomart.com") ||
      url.startsWith("#");

    if (!isInternal && !url.startsWith("mailto:") && !url.startsWith("tel:")) {
      anchor.setAttribute("target", "_blank");
      anchor.setAttribute("rel", "noopener noreferrer");
    }

    range.insertNode(anchor);

    const linkedRange = document.createRange();
    linkedRange.selectNodeContents(anchor);

    const currentSelection = window.getSelection();
    if (currentSelection) {
      currentSelection.removeAllRanges();
      currentSelection.addRange(linkedRange);
    }
    savedRangeRef.current = linkedRange.cloneRange();
    selectionBookmarkRef.current = createTextBookmark(editor, linkedRange);

    syncValue();
  }

  function handleEditorLinkClick(event: ReactMouseEvent<HTMLDivElement>) {
    const clickedElement =
      event.target instanceof Element ? event.target : null;
    const link = clickedElement?.closest("a");

    if (!link || !editorRef.current?.contains(link)) return;

    const href = link.getAttribute("href")?.trim();
    if (!href) return;

    // contentEditable normally places the caret inside an anchor instead of
    // following it. Open editor links explicitly so admins can test them.
    event.preventDefault();
    event.stopPropagation();

    if (href.startsWith("mailto:") || href.startsWith("tel:")) {
      window.location.href = href;
      return;
    }

    const destination = link.href || href;
    const openedWindow = window.open(
      destination,
      "_blank",
      "noopener,noreferrer",
    );

    if (openedWindow) {
      openedWindow.opener = null;
    }
  }

  function removeLink() {
    restoreSelection();

    document.execCommand("unlink", false);
    document.execCommand("foreColor", false, "#000000");

    saveSelection();
    syncValue();
  }

  function handlePaste(_event: ClipboardEvent<HTMLDivElement>) {
    // Keep the pasted content and formatting exactly as the browser inserts it.
    // Sync after the native paste has updated the contentEditable DOM.
    window.requestAnimationFrame(() => {
      saveSelection();
      syncValue();
    });
  }

  function closestEditableBlock(node: Node): HTMLElement | null {
    const editor = editorRef.current;
    if (!editor) return null;

    let current: Node | null =
      node.nodeType === Node.ELEMENT_NODE ? node : node.parentNode;

    while (current && current !== editor) {
      if (current instanceof HTMLElement) {
        const tag = current.tagName.toLowerCase();

        if (
          tag === "p" ||
          tag === "div" ||
          tag === "h1" ||
          tag === "h2" ||
          tag === "h3" ||
          tag === "h4" ||
          tag === "h5" ||
          tag === "h6" ||
          tag === "blockquote"
        ) {
          return current;
        }
      }

      current = current.parentNode;
    }

    return null;
  }

  function fragmentHasContent(fragment: DocumentFragment) {
    const text = fragment.textContent?.replace(/\u200B/g, "").trim() || "";

    if (text) return true;

    return Boolean(
      fragment.querySelector(
        "img,video,audio,iframe,table,ul,ol,pre,code,br",
      ),
    );
  }

  function makeBlockFromFragment(
    sourceBlock: HTMLElement,
    fragment: DocumentFragment,
  ) {
    const sourceTag = sourceBlock.tagName.toLowerCase();
    const safeTag =
      sourceTag === "div" ||
      sourceTag === "p" ||
      sourceTag === "h1" ||
      sourceTag === "h2" ||
      sourceTag === "h3" ||
      sourceTag === "h4" ||
      sourceTag === "h5" ||
      sourceTag === "h6" ||
      sourceTag === "blockquote"
        ? sourceTag
        : "p";

    const block = document.createElement(safeTag);
    block.appendChild(fragment);
    return block;
  }

  function applyHeadingShortcut(tag: HeadingTag) {
    restoreSelection();

    const editor = editorRef.current;
    const selection = window.getSelection();

    if (!editor || !selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);

    if (
      !editor.contains(range.startContainer) ||
      !editor.contains(range.endContainer)
    ) {
      return;
    }

    /*
     * Shortcut headings are selection-based.
     *
     * Native formatBlock changes the entire paragraph/block. That is useful
     * for the toolbar dropdown, but it is too aggressive for Ctrl+Alt+1/2/3.
     * The shortcut therefore promotes only the selected text into its own
     * heading block and leaves the text before/after it untouched.
     */
    if (range.collapsed) {
      showEditorError("Select the heading text first, then use Ctrl+Alt+1 to 6.");
      return;
    }

    const startBlock = closestEditableBlock(range.startContainer);
    const endBlock = closestEditableBlock(range.endContainer);

    // If the selection is direct text under the editor, wrap only that exact
    // selection without changing neighbouring content.
    if (!startBlock && !endBlock) {
      const heading = document.createElement(tag);
      heading.appendChild(range.extractContents());
      range.insertNode(heading);

      const headingRange = document.createRange();
      headingRange.selectNodeContents(heading);

      selection.removeAllRanges();
      selection.addRange(headingRange);
      savedRangeRef.current = headingRange.cloneRange();

      setBlockType(tag);
      syncValue();
      return;
    }

    // Keep shortcut behaviour predictable: one selected heading at a time.
    if (!startBlock || !endBlock || startBlock !== endBlock) {
      showEditorError("Select heading text inside one paragraph or line.");
      return;
    }

    const sourceBlock = startBlock;
    const parent = sourceBlock.parentNode;

    if (!parent) return;

    const beforeRange = document.createRange();
    beforeRange.selectNodeContents(sourceBlock);
    beforeRange.setEnd(range.startContainer, range.startOffset);

    const afterRange = document.createRange();
    afterRange.selectNodeContents(sourceBlock);
    afterRange.setStart(range.endContainer, range.endOffset);

    const beforeFragment = beforeRange.cloneContents();
    const selectedFragment = range.cloneContents();
    const afterFragment = afterRange.cloneContents();

    const heading = document.createElement(tag);
    heading.appendChild(selectedFragment);

    if (fragmentHasContent(beforeFragment)) {
      parent.insertBefore(
        makeBlockFromFragment(sourceBlock, beforeFragment),
        sourceBlock,
      );
    }

    parent.insertBefore(heading, sourceBlock);

    if (fragmentHasContent(afterFragment)) {
      parent.insertBefore(
        makeBlockFromFragment(sourceBlock, afterFragment),
        sourceBlock,
      );
    }

    parent.removeChild(sourceBlock);

    const headingRange = document.createRange();
    headingRange.selectNodeContents(heading);

    selection.removeAllRanges();
    selection.addRange(headingRange);
    savedRangeRef.current = headingRange.cloneRange();

    setBlockType(tag);
    syncValue();
  }

  function handleEditorKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const headingShortcut =
      (event.ctrlKey || event.metaKey) &&
      event.altKey;

    if (!headingShortcut) return;

    const headingMap: Record<string, HeadingTag> = {
      Digit1: "h1",
      Digit2: "h2",
      Digit3: "h3",
      Digit4: "h4",
      Digit5: "h5",
      Digit6: "h6",
    };
    const heading = headingMap[event.code];
    if (!heading) return;
    event.preventDefault();
    applyHeadingShortcut(heading);
  }

  const buttonClass =
    "grid h-9 min-w-9 place-items-center rounded-md border border-transparent bg-white px-2 text-[13px] font-semibold text-navy transition hover:border-border-strong hover:bg-offwhite hover:text-teal active:bg-teal/10";

  const dividerClass = "mx-1 hidden h-7 w-px bg-border sm:block";

  return (
    <div className="relative max-h-[640px] overflow-y-auto rounded-lg border border-border-strong bg-white shadow-sm transition focus-within:border-teal focus-within:ring-2 focus-within:ring-teal/10 [scrollbar-gutter:stable]">
      <div className="sticky top-0 z-30 flex flex-wrap items-center gap-1 border-b border-border bg-offwhite/95 p-2 shadow-sm backdrop-blur">
        <div className="flex items-center gap-1">
          <button
            type="button"
            title="Undo"
            aria-label="Undo"
            className={buttonClass}
            onMouseDown={(event) => {
              event.preventDefault();
              runCommand("undo");
            }}
          >
            Undo
          </button>
          <button
            type="button"
            title="Redo"
            aria-label="Redo"
            className={buttonClass}
            onMouseDown={(event) => {
              event.preventDefault();
              runCommand("redo");
            }}
          >
            Redo
          </button>
        </div>

        <div className={dividerClass} />

        <select
          value={blockType}
          title="Paragraph style - Ctrl+Alt+1 to 6 for Heading 1 to 6"
          aria-label="Paragraph style"
          className="h-9 min-w-[145px] rounded-md border border-border-strong bg-white px-3 text-[13px] font-semibold text-navy outline-none transition hover:border-teal focus:border-teal"
          onMouseDown={saveSelection}
          onChange={(event) => applyBlock(event.target.value)}
        >
          <option value="p">Paragraph</option>
          <option value="h1">Heading 1</option>
          <option value="h2">Heading 2</option>
          <option value="h3">Heading 3</option>
          <option value="h4">Heading 4</option>
          <option value="h5">Heading 5</option>
          <option value="h6">Heading 6</option>
        </select>

        <div className={dividerClass} />

        <div className="flex items-center gap-1">
          <button
            type="button"
            title="Bold"
            aria-label="Bold"
            className={`${buttonClass} font-black`}
            onMouseDown={(event) => {
              event.preventDefault();
              runCommand("bold");
            }}
          >
            B
          </button>
          <button
            type="button"
            title="Italic"
            aria-label="Italic"
            className={`${buttonClass} font-serif italic`}
            onMouseDown={(event) => {
              event.preventDefault();
              runCommand("italic");
            }}
          >
            I
          </button>
          <button
            type="button"
            title="Underline"
            aria-label="Underline"
            className={`${buttonClass} underline`}
            onMouseDown={(event) => {
              event.preventDefault();
              runCommand("underline");
            }}
          >
            U
          </button>
          <button
            type="button"
            title="Strikethrough"
            aria-label="Strikethrough"
            className={`${buttonClass} line-through`}
            onMouseDown={(event) => {
              event.preventDefault();
              runCommand("strikeThrough");
            }}
          >
            S
          </button>
        </div>

        <div className={dividerClass} />

        <div className="flex items-center gap-1">
          <button
            type="button"
            title="Align Left"
            aria-label="Align Left"
            className={buttonClass}
            onMouseDown={(event) => {
              event.preventDefault();
              runCommand("justifyLeft");
            }}
          >
            Left
          </button>
          <button
            type="button"
            title="Align Center"
            aria-label="Align Center"
            className={buttonClass}
            onMouseDown={(event) => {
              event.preventDefault();
              runCommand("justifyCenter");
            }}
          >
            Center
          </button>
          <button
            type="button"
            title="Align Right"
            aria-label="Align Right"
            className={buttonClass}
            onMouseDown={(event) => {
              event.preventDefault();
              runCommand("justifyRight");
            }}
          >
            Right
          </button>
          <button
            type="button"
            title="Justify"
            aria-label="Justify"
            className={buttonClass}
            onMouseDown={(event) => {
              event.preventDefault();
              runCommand("justifyFull");
            }}
          >
            Justify
          </button>
        </div>

        <div className={dividerClass} />

        <div className="flex items-center gap-1">
          <button
            type="button"
            title={tickBullets ? "Tick bullet list" : "Bulleted List"}
            aria-label={tickBullets ? "Tick bullet list" : "Bulleted List"}
            className={buttonClass}
            onMouseDown={(event) => {
              event.preventDefault();
              if (tickBullets) insertTickList();
              else runCommand("insertUnorderedList");
            }}
          >
            {tickBullets ? "✓" : "Bullets"}
          </button>
          <button
            type="button"
            title="Numbered List"
            aria-label="Numbered List"
            className={buttonClass}
            onMouseDown={(event) => {
              event.preventDefault();
              runCommand("insertOrderedList");
            }}
          >
            1.
          </button>
        </div>

        <div className={dividerClass} />

        <div className="flex items-center gap-1">
          <button
            type="button"
            title="Insert Link"
            aria-label="Insert Link"
            className={buttonClass}
            onMouseDown={(event) => {
              event.preventDefault();
              saveSelection();
              addLink();
            }}
          >
            Link
          </button>
          <button
            type="button"
            title="Remove Link"
            aria-label="Remove Link"
            className={buttonClass}
            onMouseDown={(event) => {
              event.preventDefault();
              removeLink();
            }}
          >
            Unlink
          </button>
          <button
            type="button"
            title="Clear Formatting"
            aria-label="Clear Formatting"
            className={buttonClass}
            onMouseDown={(event) => {
              event.preventDefault();
              runCommand("removeFormat");
            }}
          >
            Tx
          </button>
        </div>
      </div>

      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onInput={() => {
          saveSelection();
          syncValue();
        }}
        onBlur={() => {
          saveSelection();
          syncValue();
        }}
        onMouseUp={() => {
          saveSelection();
          syncBlockType();
        }}
        onClick={handleEditorLinkClick}
        onKeyDown={handleEditorKeyDown}
        onKeyUp={() => {
          saveSelection();
          syncBlockType();
        }}
        onFocus={saveSelection}
        onPaste={handlePaste}
        className={`${compact ? "min-h-[92px] max-h-[168px] overflow-y-auto px-4 py-3" : "min-h-[300px] px-5 py-4"} bg-white text-[13px] leading-7 text-charcoal outline-none empty:before:pointer-events-none empty:before:text-slate/60 empty:before:content-[attr(data-placeholder)] [&_p]:my-3 [&_h1]:mb-4 [&_h1]:mt-6 [&_h1]:text-3xl [&_h1]:font-bold [&_h1]:leading-tight [&_h1]:text-navy [&_h2]:mb-3 [&_h2]:mt-5 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:leading-tight [&_h2]:text-navy [&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:text-xl [&_h3]:font-bold [&_h3]:leading-snug [&_h3]:text-navy [&_h4]:mb-2 [&_h4]:mt-3 [&_h4]:text-lg [&_h4]:font-bold [&_h4]:text-navy [&_h5]:mb-1 [&_h5]:mt-3 [&_h5]:text-base [&_h5]:font-bold [&_h5]:text-navy [&_h6]:mb-1 [&_h6]:mt-2 [&_h6]:text-sm [&_h6]:font-bold [&_h6]:uppercase [&_h6]:tracking-wide [&_h6]:text-navy [&_ul]:my-3 [&_ul]:ml-7 [&_ul]:list-disc [&_ul.tick-list]:ml-0 [&_ul.tick-list]:list-none [&_ul.tick-list_li]:relative [&_ul.tick-list_li]:pl-6 [&_ul.tick-list_li]:before:absolute [&_ul.tick-list_li]:before:left-0 [&_ul.tick-list_li]:before:font-bold [&_ul.tick-list_li]:before:text-emerald-600 [&_ul.tick-list_li]:before:content-['✓'] [&_ol]:my-3 [&_ol]:ml-7 [&_ol]:list-decimal [&_li]:my-1 [&_a]:cursor-pointer [&_a]:font-medium [&_a]:text-teal [&_a]:underline [&_a]:underline-offset-2 [&_a]:transition-colors [&_a:hover]:text-navy [&_strong]:font-bold`}
      />
    </div>
  );
}

export default function AdminRichTextEditor({
  name,
  defaultValue = "",
  placeholder,
  onChange,
  compact = false,
  tickBullets = false,
}: Props) {
  const [html, setHtml] = useState(defaultValue);

  useEffect(() => {
    setHtml(defaultValue);
  }, [defaultValue]);

  function update(value: string) {
    setHtml(value);
    onChange?.(value);
  }

  return (
    <>
      <ReferenceRichTextEditor value={html} onChange={update} placeholder={placeholder} compact={compact} tickBullets={tickBullets} />
      <textarea name={name} value={html} readOnly hidden aria-hidden="true" />
    </>
  );
}
