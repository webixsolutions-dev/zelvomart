"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  name: string;
  defaultValue?: string;
  placeholder?: string;
};

type EditorCommand =
  | "undo"
  | "redo"
  | "bold"
  | "italic"
  | "underline"
  | "strikeThrough"
  | "justifyLeft"
  | "justifyCenter"
  | "justifyRight"
  | "justifyFull"
  | "insertUnorderedList"
  | "insertOrderedList"
  | "unlink"
  | "removeFormat";

export default function AdminRichTextEditor({
  name,
  defaultValue = "",
  placeholder = "Write the full product description...",
}: Props) {
  const editorRef = useRef<HTMLDivElement>(null);
  const savedRangeRef = useRef<Range | null>(null);
  const [html, setHtml] = useState(defaultValue);
  const [blockType, setBlockType] = useState("p");

  useEffect(() => {
    setHtml(defaultValue);
    if (editorRef.current && editorRef.current.innerHTML !== defaultValue) {
      editorRef.current.innerHTML = defaultValue;
    }
  }, [defaultValue]);

  function syncHtml() {
    setHtml(editorRef.current?.innerHTML || "");
  }

  function saveSelection() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    if (editorRef.current?.contains(range.commonAncestorContainer)) {
      savedRangeRef.current = range.cloneRange();
    }
  }

  function restoreSelection() {
    const range = savedRangeRef.current;
    if (!range) return;
    const selection = window.getSelection();
    if (!selection) return;
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function run(command: EditorCommand, value?: string) {
    editorRef.current?.focus();
    restoreSelection();
    document.execCommand(command, false, value);
    saveSelection();
    syncHtml();
  }

  function changeBlock(value: string) {
    setBlockType(value);
    editorRef.current?.focus();
    restoreSelection();
    document.execCommand("formatBlock", false, value);
    saveSelection();
    syncHtml();
  }

  function addLink() {
    saveSelection();
    const url = window.prompt("Enter link URL", "https://");
    if (!url) return;
    editorRef.current?.focus();
    restoreSelection();
    document.execCommand("createLink", false, url.trim());
    saveSelection();
    syncHtml();
  }

  function clearFormatting() {
    run("removeFormat");
    document.execCommand("formatBlock", false, "p");
    setBlockType("p");
    syncHtml();
  }

  return (
    <div className="admin-rich-editor admin-rich-editor-pro">
      <div className="admin-rich-toolbar" aria-label="Main description formatting toolbar">
        <div className="admin-rich-toolbar-row">
          <div className="admin-rich-toolbar-group">
            <button type="button" className="admin-rich-text-action" onMouseDown={(event) => event.preventDefault()} onClick={() => run("undo")} title="Undo">
              Undo
            </button>
            <button type="button" className="admin-rich-text-action" onMouseDown={(event) => event.preventDefault()} onClick={() => run("redo")} title="Redo">
              Redo
            </button>
          </div>

          <span className="admin-rich-separator" aria-hidden="true" />

          <select
            className="admin-rich-format-select"
            value={blockType}
            onMouseDown={saveSelection}
            onChange={(event) => changeBlock(event.target.value)}
            aria-label="Text style"
          >
            <option value="p">Paragraph</option>
            <option value="h2">Heading 2</option>
            <option value="h3">Heading 3</option>
            <option value="h4">Heading 4</option>
            <option value="blockquote">Quote</option>
          </select>

          <span className="admin-rich-separator" aria-hidden="true" />

          <div className="admin-rich-toolbar-group admin-rich-icon-group">
            <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => run("bold")} title="Bold" aria-label="Bold"><strong>B</strong></button>
            <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => run("italic")} title="Italic" aria-label="Italic"><em>I</em></button>
            <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => run("underline")} title="Underline" aria-label="Underline"><u>U</u></button>
            <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => run("strikeThrough")} title="Strikethrough" aria-label="Strikethrough"><s>S</s></button>
          </div>
        </div>

        <div className="admin-rich-toolbar-row admin-rich-toolbar-row-secondary">
          <div className="admin-rich-toolbar-group">
            <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => run("justifyLeft")} title="Align left">Left</button>
            <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => run("justifyCenter")} title="Align center">Center</button>
            <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => run("justifyRight")} title="Align right">Right</button>
            <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => run("justifyFull")} title="Justify">Justify</button>
          </div>

          <span className="admin-rich-separator" aria-hidden="true" />

          <div className="admin-rich-toolbar-group">
            <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => run("insertUnorderedList")} title="Bulleted list">Bullets</button>
            <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => run("insertOrderedList")} title="Numbered list">1.</button>
          </div>

          <span className="admin-rich-separator" aria-hidden="true" />

          <div className="admin-rich-toolbar-group">
            <button type="button" onMouseDown={saveSelection} onClick={addLink} title="Insert link">Link</button>
            <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => run("unlink")} title="Remove link">Unlink</button>
            <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={clearFormatting} title="Clear formatting" aria-label="Clear formatting">Tx</button>
          </div>
        </div>
      </div>

      <div
        ref={editorRef}
        className="admin-rich-surface"
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        dangerouslySetInnerHTML={{ __html: defaultValue }}
        onInput={syncHtml}
        onKeyUp={saveSelection}
        onMouseUp={saveSelection}
        onFocus={saveSelection}
      />
      <textarea name={name} value={html} readOnly hidden />
    </div>
  );
}
