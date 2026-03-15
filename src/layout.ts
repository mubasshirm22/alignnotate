import type { AlignmentData, BlockLayout, LayoutMetrics, RenderMode, Selection } from "./types";

const FALLBACK_EDITOR: LayoutMetrics = {
  nameWidth: 170,
  cellWidth: 14,
  cellHeight: 20,
  blockColumns: 60,
  groupSize: 10,
  blockGap: 38,
  headerHeight: 58,
  consensusHeight: 0,
  rowGap: 2,
  padding: 24,
  labelOffset: 24,
};

const FALLBACK_EXPORT: LayoutMetrics = {
  nameWidth: 150,
  cellWidth: 12.6,
  cellHeight: 16.8,
  blockColumns: 60,
  groupSize: 10,
  blockGap: 24,
  headerHeight: 44,
  consensusHeight: 0,
  rowGap: 1.2,
  padding: 16,
  labelOffset: 14,
};

export const defaultMetrics = FALLBACK_EDITOR;

export function createLayoutMetrics(alignment: AlignmentData, renderMode: RenderMode): LayoutMetrics {
  const base = renderMode === "export" ? FALLBACK_EXPORT : FALLBACK_EDITOR;
  const residueFontSize = renderMode === "export" ? 11.2 : 13;
  const labelFontSize = renderMode === "export" ? 10.5 : 14;
  const numberFontSize = renderMode === "export" ? 9.8 : 12;

  const residueWidth = measureTextWidth("M", `${residueFontSize}px "Courier New", Courier, monospace`, base.cellWidth - 1.4);
  const longestName = alignment.sequences.reduce((max, sequence) => (sequence.id.length > max.length ? sequence.id : max), "");
  const maxEndNumber = Math.max(
    ...alignment.sequences.map((sequence) => sequence.startIndex + sequence.aligned.replace(/-/g, "").length - 1),
    0,
  );
  const numberWidth = measureTextWidth(String(maxEndNumber), `${numberFontSize}px "Times New Roman", Times, serif`, 28);
  const labelWidth = measureTextWidth(longestName || "Sequence", `${labelFontSize}px "Times New Roman", Times, serif`, 84);

  const cellWidth = round1(Math.max(base.cellWidth, residueWidth + (renderMode === "export" ? 1.6 : 2.2)));
  const cellHeight = round1(Math.max(base.cellHeight, residueFontSize * (renderMode === "export" ? 1.42 : 1.5)));
  const nameWidth = Math.ceil(labelWidth + numberWidth + (renderMode === "export" ? 34 : 44));

  return {
    ...base,
    nameWidth,
    cellWidth,
    cellHeight,
  };
}

export function buildBlocks(
  alignment: AlignmentData,
  metrics: LayoutMetrics,
  options?: { topLaneHeight?: number; bottomLaneHeight?: number },
): BlockLayout[] {
  const blocks: BlockLayout[] = [];
  const sequenceCount = alignment.sequences.length;
  const rowBand = metrics.cellHeight + metrics.rowGap;
  const topLaneHeight = options?.topLaneHeight ?? 0;
  const bottomLaneHeight = options?.bottomLaneHeight ?? 0;
  const blockHeight =
    metrics.headerHeight +
    topLaneHeight +
    sequenceCount * rowBand +
    bottomLaneHeight +
    8;

  for (let startColumn = 0, blockIndex = 0; startColumn < alignment.alignmentLength; startColumn += metrics.blockColumns, blockIndex += 1) {
    const endColumn = Math.min(startColumn + metrics.blockColumns - 1, alignment.alignmentLength - 1);
    const y = metrics.padding + blockIndex * (blockHeight + metrics.blockGap);
    const rowY = alignment.sequences.map(
      (_, sequenceIndex) => y + metrics.headerHeight + topLaneHeight + sequenceIndex * rowBand,
    );

    blocks.push({
      blockIndex,
      startColumn,
      endColumn,
      y,
      rowY,
      height: blockHeight,
    });
  }

  return blocks;
}

function measureTextWidth(text: string, font: string, fallback: number): number {
  if (typeof document === "undefined") {
    return fallback;
  }

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) {
    return fallback;
  }

  context.font = font;
  return context.measureText(text).width;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function normalizeSelection(selection: Selection): Selection {
  return {
    startSequence: Math.min(selection.startSequence, selection.endSequence),
    endSequence: Math.max(selection.startSequence, selection.endSequence),
    startColumn: Math.min(selection.startColumn, selection.endColumn),
    endColumn: Math.max(selection.startColumn, selection.endColumn),
  };
}

export function selectionIntersectsBlock(selection: Selection, block: BlockLayout): boolean {
  return selection.endColumn >= block.startColumn && selection.startColumn <= block.endColumn;
}

export function countResiduesUntil(sequence: string, column: number): number {
  let count = 0;
  for (let index = 0; index <= column && index < sequence.length; index += 1) {
    if (sequence[index] !== "-") {
      count += 1;
    }
  }
  return count;
}

export function consensusAt(alignment: AlignmentData, column: number): string {
  if (alignment.consensus) {
    return alignment.consensus[column] ?? " ";
  }

  const residues = alignment.sequences.map((sequence) => sequence.aligned[column]);
  const ungapped = residues.filter((residue) => residue && residue !== "-");
  if (ungapped.length === 0) {
    return " ";
  }

  const first = ungapped[0];
  if (ungapped.every((residue) => residue === first)) {
    return "*";
  }

  return " ";
}
