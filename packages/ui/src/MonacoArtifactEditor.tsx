import { Editor as MonacoEditor, type OnChange, type OnMount } from "@monaco-editor/react";
import { useCallback, useRef } from "react";

export type MonacoArtifactEditorProps = {
  /** Current JSON document being edited. */
  value: string;
  /** Called whenever the editor contents change. */
  onChange: (next: string) => void;
  /** Optional accessible label forwarded to the editor host. */
  ariaLabel?: string;
  /**
   * Called when the user invokes the editor's `formatDocument` action (e.g.
   * Cmd/Ctrl+S binds to format-and-save). Defaults to a no-op.
   */
  onSave?: (next: string) => void;
};

/**
 * Monaco-backed JSON editor with format-on-save and JSON validation enabled.
 *
 * Lazy-loaded by `WorkbenchShell` via `React.lazy` so consumers that don't opt
 * into Monaco never pay its bundle cost. SSR is not supported by
 * @monaco-editor/react out of the box; consumers rendering this component on
 * the server should wrap it in their own client-only boundary (the
 * `useMonacoEditor` prop on `WorkbenchShell` already handles this through
 * `<Suspense>`, but the parent route must still be a client component).
 */
export function MonacoArtifactEditor(props: MonacoArtifactEditorProps) {
  const { value, onChange, ariaLabel, onSave } = props;
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);

  const handleChange = useCallback<OnChange>(
    (next) => {
      onChange(next ?? "");
    },
    [onChange],
  );

  const handleMount = useCallback<OnMount>(
    (editor, monaco) => {
      editorRef.current = editor;
      monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
        validate: true,
        allowComments: false,
        schemas: [],
      });
      editor.addAction({
        id: "lwb.formatAndSave",
        label: "Format and save",
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
        run: async (ed) => {
          await ed.getAction("editor.action.formatDocument")?.run();
          onSave?.(ed.getValue());
        },
      });
    },
    [onSave],
  );

  return (
    <div className="lwb-monaco-host" aria-label={ariaLabel}>
      <MonacoEditor
        height="320px"
        defaultLanguage="json"
        language="json"
        value={value}
        theme="vs-dark"
        onChange={handleChange}
        onMount={handleMount}
        options={{
          minimap: { enabled: false },
          formatOnPaste: true,
          formatOnType: true,
          tabSize: 2,
          scrollBeyondLastLine: false,
          fontSize: 12,
          fontFamily:
            "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
          automaticLayout: true,
          ariaLabel: ariaLabel ?? "JSON editor",
        }}
        loading={<div className="lwb-monaco-fallback">Loading editor…</div>}
      />
    </div>
  );
}

export default MonacoArtifactEditor;
