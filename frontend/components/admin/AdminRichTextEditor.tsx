"use client";

import { useRef, useState } from "react";

type Props = {
  name: string;
  defaultValue?: string;
  placeholder?: string;
};

export default function AdminRichTextEditor({ name, defaultValue = "", placeholder = "Write the product description..." }: Props) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [html, setHtml] = useState(defaultValue);

  function run(command: string, value?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    setHtml(editorRef.current?.innerHTML || "");
  }

  function addLink() {
    const url = window.prompt("Link URL");
    if (url) run("createLink", url);
  }

  return (
    <div className="admin-rich-editor">
      <div className="admin-rich-toolbar" aria-label="Description formatting">
        <button type="button" onClick={() => run("bold")}><b>B</b></button>
        <button type="button" onClick={() => run("italic")}><i>I</i></button>
        <button type="button" onClick={() => run("formatBlock", "H2")}>H2</button>
        <button type="button" onClick={() => run("formatBlock", "H3")}>H3</button>
        <button type="button" onClick={() => run("insertUnorderedList")}>• List</button>
        <button type="button" onClick={() => run("insertOrderedList")}>1. List</button>
        <button type="button" onClick={addLink}>Link</button>
        <button type="button" onClick={() => run("removeFormat")}>Clear</button>
      </div>
      <div
        ref={editorRef}
        className="admin-rich-surface"
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        dangerouslySetInnerHTML={{ __html: defaultValue }}
        onInput={(event) => setHtml(event.currentTarget.innerHTML)}
      />
      <textarea name={name} value={html} readOnly hidden />
    </div>
  );
}
