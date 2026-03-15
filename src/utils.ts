import type { Annotation, Selection } from "./types";
import { normalizeSelection } from "./layout";

export function makeId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function selectionEquals(a: Selection, b: Selection): boolean {
  const left = normalizeSelection(a);
  const right = normalizeSelection(b);
  return (
    left.startSequence === right.startSequence &&
    left.endSequence === right.endSequence &&
    left.startColumn === right.startColumn &&
    left.endColumn === right.endColumn
  );
}

export function annotationBounds(annotation: Annotation): Selection {
  if (!("selection" in annotation)) {
    return normalizeSelection({
      startSequence: Math.min(annotation.from.sequenceIndex, annotation.to.sequenceIndex),
      endSequence: Math.max(annotation.from.sequenceIndex, annotation.to.sequenceIndex),
      startColumn: Math.min(annotation.from.column, annotation.to.column),
      endColumn: Math.max(annotation.from.column, annotation.to.column),
    });
  }
  return normalizeSelection(annotation.selection);
}

export function downloadBlob(filename: string, mimeType: string, content: BlobPart): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
