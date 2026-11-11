/** Snapshot of the current text selection's format state. Drives toolbar UI
 *  (active B/I/U highlights). */
export interface FormatState {
  bold: boolean;
  /** Font-weight at the caret is 500-600 (semi-bold face). */
  semibold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  align: "left" | "center" | "right" | "justify" | null;
  textColor: string | null;
  /** Computed CSS font-family of the text at the caret (raw stack). */
  fontFamily: string | null;
  /** Computed font size at the caret, in pt (rounded to 0.5). */
  fontSize: number | null;
  hasSelection: boolean;
  hasActiveEditor: boolean;
}

export const DEFAULT_FORMAT_STATE: FormatState = {
  bold: false,
  semibold: false,
  italic: false,
  underline: false,
  strike: false,
  align: null,
  textColor: null,
  fontFamily: null,
  fontSize: null,
  hasSelection: false,
  hasActiveEditor: false,
};

/** Format commands the toolbar sends to the active field editor (names kept
 *  from the former execCommand API). */
export type FormatCommand =
  | "bold" | "italic" | "underline" | "strikeThrough"
  | "foreColor" | "hiliteColor"
  | "createLink" | "unlink"
  | "justifyLeft" | "justifyCenter" | "justifyRight" | "justifyFull"
  | "removeFormat"
  | "insertUnorderedList" | "insertOrderedList";

/** What an active field editor exposes to the format provider. */
export interface RichEditorHandle {
  /** Editable root (the ProseMirror contentEditable). */
  readonly dom: HTMLElement;
  exec: (command: FormatCommand, value?: string) => boolean;
  /** Set several CSS properties on the selection (whole field if collapsed). */
  applyStyles: (styles: Record<string, string>) => boolean;
  readState: () => FormatState;
  /** Commit pending text and tear the editor down (another field takes over). */
  deactivate: () => void;
}
