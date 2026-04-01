import { forwardRef, useMemo, useRef, type PointerEvent as ReactPointerEvent, type ReactElement } from "react";
import { buildColumnProfiles, conservationTrackColor, getResidueStyle } from "./conservation";
import { buildBlocks, countResiduesUntil, normalizeSelection, selectionIntersectsBlock } from "./layout";
import type {
  AlignmentData,
  Annotation,
  BlockLayout,
  ConservationColorOverrides,
  CustomLegendItem,
  EspriptPreset,
  LayoutMetrics,
  RenderMode,
  SecondaryStructureTrack,
  Selection,
  StructureRenderStyle,
  Tool,
  VisualizationMode,
} from "./types";

type DragState = {
  active: boolean;
  selection: Selection | null;
};

type Props = {
  alignment: AlignmentData;
  annotations: Annotation[];
  metrics: LayoutMetrics;
  renderMode: RenderMode;
  visualizationMode: VisualizationMode;
  espriptPreset: EspriptPreset;
  conservationColors: ConservationColorOverrides | null;
  showConservationStrip: boolean;
  showLegend: boolean;
  includeAutoLegend: boolean;
  customLegendItems: CustomLegendItem[];
  structureRenderStyle: StructureRenderStyle;
  secondaryStructureTrack: SecondaryStructureTrack | null;
  bottomStructureTrack: SecondaryStructureTrack | null;
  boxStrokeWidth: number;
  pendingBridgeAnchor: { sequenceIndex: number; column: number } | null;
  interactive: boolean;
  selection: Selection | null;
  activeTool: Tool;
  dragState: DragState;
  onCellPointerDown: (sequenceIndex: number, column: number) => void;
  onCellPointerEnter: (sequenceIndex: number, column: number) => void;
  onAnnotationPointerDown: (
    annotationId: string,
    clientX: number,
    clientY: number,
    handle?: "body" | "arrow-tail" | "arrow-head",
  ) => void;
  selectedAnnotationId: string | null;
};

const TRACK_OFFSET_EDITOR = 26;
const TRACK_OFFSET_EXPORT = 24;

function trackOffset(track: SecondaryStructureTrack | null, renderMode: RenderMode): number {
  return track ? (renderMode === "export" ? TRACK_OFFSET_EXPORT : TRACK_OFFSET_EDITOR) : 0;
}

export const AlignmentCanvas = forwardRef<SVGSVGElement, Props>(function AlignmentCanvas(
  {
    alignment,
    annotations,
    metrics,
    renderMode,
    visualizationMode,
    espriptPreset,
    conservationColors,
    showConservationStrip,
    showLegend,
    includeAutoLegend,
    customLegendItems,
    structureRenderStyle,
    secondaryStructureTrack,
    bottomStructureTrack,
    boxStrokeWidth,
    pendingBridgeAnchor,
    interactive,
    selection,
    activeTool,
    dragState,
    onCellPointerDown,
    onCellPointerEnter,
    onAnnotationPointerDown,
    selectedAnnotationId,
  },
  ref,
) {
  const topLaneHeight = trackOffset(secondaryStructureTrack, renderMode);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const lastHoverRef = useRef<string | null>(null);
  const bottomLaneHeight = trackOffset(bottomStructureTrack, renderMode);
  const blocks = useMemo(
    () => buildBlocks(alignment, metrics, { topLaneHeight, bottomLaneHeight }),
    [alignment, metrics, topLaneHeight, bottomLaneHeight],
  );
  const profiles = useMemo(() => buildColumnProfiles(alignment), [alignment]);
  const highlightColors = useMemo(() => buildHighlightColorMap(annotations), [annotations]);
  const width = metrics.padding * 2 + metrics.nameWidth + metrics.blockColumns * metrics.cellWidth + 64;
  const height =
    blocks.length > 0 ? blocks[blocks.length - 1].y + blocks[blocks.length - 1].height + metrics.padding : 300;
  const liveSelection = dragState.active ? dragState.selection : selection;

  function handleSvgPointerDown(event: ReactPointerEvent<SVGSVGElement>) {
    if (!interactive) {
      return;
    }
    const target = event.target;
    if (target instanceof Element && target.closest("[data-annotation-id]")) {
      return;
    }

    const cell = locateCell(event, svgRef.current, alignment, blocks, metrics);
    if (!cell) {
      return;
    }

    lastHoverRef.current = `${cell.sequenceIndex}:${cell.column}`;
    onCellPointerDown(cell.sequenceIndex, cell.column);
  }

  function handleSvgPointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    if (!interactive || !dragState.active) {
      return;
    }

    const cell = locateCell(event, svgRef.current, alignment, blocks, metrics);
    if (!cell) {
      return;
    }

    const key = `${cell.sequenceIndex}:${cell.column}`;
    if (key === lastHoverRef.current) {
      return;
    }

    lastHoverRef.current = key;
    onCellPointerEnter(cell.sequenceIndex, cell.column);
  }

  const annotationElements = useMemo(
    () =>
      annotations.map((annotation) =>
        renderAnnotation(
          annotation,
          alignment,
          blocks,
          metrics,
          renderMode,
          boxStrokeWidth,
          selectedAnnotationId === annotation.id,
          onAnnotationPointerDown,
        ),
      ),
    [alignment, annotations, blocks, metrics, renderMode, boxStrokeWidth, selectedAnnotationId, onAnnotationPointerDown],
  );

  return (
    <svg
      ref={(node) => {
        svgRef.current = node;
        if (typeof ref === "function") {
          ref(node);
        } else if (ref) {
          ref.current = node;
        }
      }}
      className={`alignment-svg alignment-svg--${renderMode}`}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Protein alignment annotation canvas"
      shapeRendering={renderMode === "export" ? "crispEdges" : "geometricPrecision"}
      textRendering="geometricPrecision"
      onPointerDown={handleSvgPointerDown}
      onPointerMove={handleSvgPointerMove}
      onPointerLeave={() => {
        lastHoverRef.current = null;
      }}
    >
      <rect x={0} y={0} width={width} height={height} fill={renderMode === "export" ? "#ffffff" : "#fcfbf8"} />

      {blocks.map((block) => (
        <g key={block.blockIndex}>
          {renderBlock(
            block,
            alignment,
            profiles,
            metrics,
            renderMode,
            visualizationMode,
            espriptPreset,
            conservationColors,
            highlightColors,
            showConservationStrip,
            structureRenderStyle,
            secondaryStructureTrack,
            bottomStructureTrack,
            interactive,
          )}
        </g>
      ))}

      <g>{annotationElements}</g>
      {renderMode === "export" && showLegend
        ? renderLegend(width, height, visualizationMode, espriptPreset, conservationColors, includeAutoLegend, customLegendItems)
        : null}
      {interactive && pendingBridgeAnchor
        ? renderPendingBridgeAnchor(pendingBridgeAnchor, blocks, metrics, secondaryStructureTrack, renderMode)
        : null}
      {interactive && liveSelection ? renderSelectionOverlay(liveSelection, blocks, metrics) : null}

      {renderMode === "editor" ? (
        <text x={metrics.padding} y={height - 10} className="footer-note">
          Tool: {activeTool.replace("-", " ")}
        </text>
      ) : null}
    </svg>
  );
});

function renderBlock(
  block: BlockLayout,
  alignment: AlignmentData,
  profiles: ReturnType<typeof buildColumnProfiles>,
  metrics: LayoutMetrics,
  renderMode: RenderMode,
  visualizationMode: VisualizationMode,
  espriptPreset: EspriptPreset,
  conservationColors: ConservationColorOverrides | null,
  highlightColors: Map<string, string>,
  showConservationStrip: boolean,
  structureRenderStyle: StructureRenderStyle,
  secondaryStructureTrack: SecondaryStructureTrack | null,
  bottomStructureTrack: SecondaryStructureTrack | null,
  interactive: boolean,
) {
  const nameX = metrics.padding;
  const gridX = metrics.padding + metrics.nameWidth;
  const numberX = gridX - 12;
  const gridWidth = (block.endColumn - block.startColumn + 1) * metrics.cellWidth;
  const bottomTrackY = block.rowY[alignment.sequences.length - 1] - block.y + metrics.cellHeight + 4;

  return (
    <g transform={`translate(0 ${block.y})`}>
      {renderMode === "export" ? (
        <rect x={gridX} y={0} width={gridWidth} height={block.height - 6} fill="#ffffff" />
      ) : null}

      {secondaryStructureTrack ? renderStructureTrack(secondaryStructureTrack, block, gridX, metrics, renderMode, "top", structureRenderStyle) : null}
      {bottomStructureTrack
        ? renderStructureTrack(bottomStructureTrack, block, gridX, metrics, renderMode, "bottom", structureRenderStyle, bottomTrackY)
        : null}

      {renderMode === "editor" ? (
        <text x={nameX} y={16} className="block-label">
          Columns {block.startColumn + 1}-{block.endColumn + 1}
        </text>
      ) : null}

      {Array.from({ length: block.endColumn - block.startColumn + 1 }, (_, offset) => {
        const column = block.startColumn + offset;
        const x = gridX + offset * metrics.cellWidth;
        const label = column % metrics.groupSize === metrics.groupSize - 1 || column === block.endColumn;
        return (
          <g key={`header_${column}`}>
            {renderMode === "export" ? (
              showConservationStrip ? (
                <rect
                  x={x}
                  y={trackOffset(secondaryStructureTrack, renderMode) + 2}
                  width={metrics.cellWidth}
                  height={4}
                  fill={conservationTrackColor(profiles[column], conservationColors)}
                />
              ) : null
            ) : null}
            {label ? (
              <text
                x={x + metrics.cellWidth / 2}
                y={trackOffset(secondaryStructureTrack, renderMode) + (renderMode === "export" ? 18 : 22)}
                textAnchor="middle"
                className="column-number"
              >
                {column + 1}
              </text>
            ) : null}
          </g>
        );
      })}

      {alignment.sequences.map((sequence, sequenceIndex) => {
        const rowY = block.rowY[sequenceIndex] - block.y;
        const baselineY = rowY + metrics.cellHeight * 0.72;
        const startCount = block.startColumn === 0 ? 0 : countResiduesUntil(sequence.aligned, block.startColumn - 1);
        const endCount = countResiduesUntil(sequence.aligned, block.endColumn);
        const startNumber = sequence.startIndex + startCount;
        const endNumber = endCount > 0 ? sequence.startIndex + endCount - 1 : sequence.startIndex;

        return (
          <g key={`${block.blockIndex}_${sequence.id}`}>
            <text x={nameX} y={baselineY} className="sequence-label">
              {sequence.id}
            </text>
            <text x={numberX} y={baselineY} textAnchor="end" className="row-number row-number-left">
              {startNumber}
            </text>

            {renderMode === "export"
              ? renderExportResidueRuns(
                  sequence.aligned,
                  sequenceIndex,
                  block,
                  profiles,
                  metrics,
                  visualizationMode,
                  espriptPreset,
                  conservationColors,
                  highlightColors,
                  rowY,
                )
              : null}
            {renderMode === "export"
              ? renderExportFrameRuns(
                  sequence.aligned,
                  sequenceIndex,
                  block,
                  profiles,
                  metrics,
                  visualizationMode,
                  espriptPreset,
                  conservationColors,
                  highlightColors,
                  rowY,
                )
              : null}

            {Array.from({ length: block.endColumn - block.startColumn + 1 }, (_, offset) => {
              const column = block.startColumn + offset;
              const residue = sequence.aligned[column] ?? "-";
              const x = gridX + offset * metrics.cellWidth;
              const style = resolveResidueStyle(
                residue,
                sequenceIndex,
                column,
                profiles[column],
                renderMode,
                visualizationMode,
                espriptPreset,
                conservationColors,
                highlightColors,
              );
              const drawGapGuide = renderMode === "export" && residue === "-" && !highlightColors.has(`${sequenceIndex}:${column}`);
              const inset = renderMode === "export" ? 0.05 : 0.08;

              return (
                <g key={`${sequence.id}_${column}`}>
                  <rect
                    x={x}
                    y={rowY}
                    width={metrics.cellWidth}
                    height={metrics.cellHeight}
                    rx={renderMode === "editor" ? 3 : 0}
                    fill={renderMode === "editor" ? "#ffffff" : "transparent"}
                    stroke={renderMode === "editor" ? "#eef1f4" : "transparent"}
                    strokeWidth={renderMode === "editor" ? 0.6 : 0}
                    className={interactive ? "residue-cell" : undefined}
                  />

                  {style.drawBox && renderMode !== "export" ? (
                    <rect
                      x={x + metrics.cellWidth * inset}
                      y={rowY + 0.7}
                      width={metrics.cellWidth - metrics.cellWidth * inset * 2}
                      height={metrics.cellHeight - 1.4}
                      rx={2}
                      fill={style.fill}
                      stroke={style.stroke}
                      strokeWidth={0.9}
                      pointerEvents="none"
                    />
                  ) : null}

                  {style.frameColor && renderMode !== "export" ? (
                    <rect
                      x={x + 0.5}
                      y={rowY + 0.5}
                      width={metrics.cellWidth - 1}
                      height={metrics.cellHeight - 1}
                      fill="none"
                      stroke={style.frameColor}
                      strokeWidth={0.95}
                      pointerEvents="none"
                    />
                  ) : null}

                  {drawGapGuide ? (
                    <line
                      x1={x + 2}
                      x2={x + metrics.cellWidth - 2}
                      y1={rowY + metrics.cellHeight / 2}
                      y2={rowY + metrics.cellHeight / 2}
                      stroke="#c6cbd2"
                      strokeDasharray="4 4"
                      strokeWidth={0.7}
                      pointerEvents="none"
                    />
                  ) : null}

                  <text x={x + metrics.cellWidth / 2} y={baselineY} textAnchor="middle" className="residue-letter" fill={style.text}>
                    {residue}
                  </text>
                </g>
              );
            })}

            <text x={gridX + gridWidth + 12} y={baselineY} className="row-number">
              {endNumber}
            </text>
          </g>
        );
      })}
    </g>
  );
}

function renderExportResidueRuns(
  aligned: string,
  sequenceIndex: number,
  block: BlockLayout,
  profiles: ReturnType<typeof buildColumnProfiles>,
  metrics: LayoutMetrics,
  visualizationMode: VisualizationMode,
  espriptPreset: EspriptPreset,
  conservationColors: ConservationColorOverrides | null,
  highlightColors: Map<string, string>,
  rowY: number,
) {
  const gridX = metrics.padding + metrics.nameWidth;
  const runs: ReactElement[] = [];
  let current:
    | {
        startColumn: number;
        endColumn: number;
        fill: string;
        stroke: string;
      }
    | null = null;

  const flush = () => {
    if (!current) {
      return;
    }

    const x = gridX + (current.startColumn - block.startColumn) * metrics.cellWidth;
    const width = (current.endColumn - current.startColumn + 1) * metrics.cellWidth;
    runs.push(
      <rect
        key={`run_${block.blockIndex}_${current.startColumn}_${current.endColumn}_${current.fill}_${current.stroke}`}
        x={x}
        y={rowY + 0.3}
        width={width}
        height={metrics.cellHeight - 0.6}
        fill={current.fill}
        stroke={current.stroke}
        strokeWidth={current.stroke === "transparent" ? 0 : 0.7}
      />,
    );
    current = null;
  };

  for (let column = block.startColumn; column <= block.endColumn; column += 1) {
    const residue = aligned[column] ?? "-";
    const style = resolveResidueStyle(
      residue,
      sequenceIndex,
      column,
      profiles[column],
      "export",
      visualizationMode,
      espriptPreset,
      conservationColors,
      highlightColors,
    );
    const shouldRenderRun = style.drawBox && style.fill !== "transparent";

    if (!shouldRenderRun) {
      flush();
      continue;
    }

    if (
      current &&
      current.endColumn === column - 1 &&
      current.fill === style.fill &&
      current.stroke === style.stroke
    ) {
      current.endColumn = column;
      continue;
    }

    flush();
    current = {
      startColumn: column,
      endColumn: column,
      fill: style.fill,
      stroke: style.stroke,
    };
  }

  flush();
  return <g>{runs}</g>;
}

function renderExportFrameRuns(
  aligned: string,
  sequenceIndex: number,
  block: BlockLayout,
  profiles: ReturnType<typeof buildColumnProfiles>,
  metrics: LayoutMetrics,
  visualizationMode: VisualizationMode,
  espriptPreset: EspriptPreset,
  conservationColors: ConservationColorOverrides | null,
  highlightColors: Map<string, string>,
  rowY: number,
) {
  const gridX = metrics.padding + metrics.nameWidth;
  const runs: ReactElement[] = [];
  let current:
    | {
        startColumn: number;
        endColumn: number;
        frameColor: string;
      }
    | null = null;

  const flush = () => {
    if (!current) {
      return;
    }

    const x = gridX + (current.startColumn - block.startColumn) * metrics.cellWidth + 0.5;
    const width = (current.endColumn - current.startColumn + 1) * metrics.cellWidth - 1;
    runs.push(
      <rect
        key={`frame_${block.blockIndex}_${current.startColumn}_${current.endColumn}_${current.frameColor}`}
        x={x}
        y={rowY + 0.5}
        width={width}
        height={metrics.cellHeight - 1}
        fill="none"
        stroke={current.frameColor}
        strokeWidth={0.95}
      />,
    );
    current = null;
  };

  for (let column = block.startColumn; column <= block.endColumn; column += 1) {
    const residue = aligned[column] ?? "-";
    const style = resolveResidueStyle(
      residue,
      sequenceIndex,
      column,
      profiles[column],
      "export",
      visualizationMode,
      espriptPreset,
      conservationColors,
      highlightColors,
    );

    if (residue === "-" || !style.frameColor) {
      flush();
      continue;
    }

    if (current && current.endColumn === column - 1 && current.frameColor === style.frameColor) {
      current.endColumn = column;
      continue;
    }

    flush();
    current = {
      startColumn: column,
      endColumn: column,
      frameColor: style.frameColor,
    };
  }

  flush();
  return <g>{runs}</g>;
}

function renderSelectionOverlay(selection: Selection, blocks: BlockLayout[], metrics: LayoutMetrics) {
  const normalized = normalizeSelection(selection);
  const gridX = metrics.padding + metrics.nameWidth;

  return blocks
    .filter((block) => selectionIntersectsBlock(normalized, block))
    .map((block) => {
      const startColumn = Math.max(normalized.startColumn, block.startColumn);
      const endColumn = Math.min(normalized.endColumn, block.endColumn);
      const x = gridX + (startColumn - block.startColumn) * metrics.cellWidth;
      const y = block.rowY[normalized.startSequence];
      const width = (endColumn - startColumn + 1) * metrics.cellWidth;
      const height =
        (normalized.endSequence - normalized.startSequence + 1) * (metrics.cellHeight + metrics.rowGap) - metrics.rowGap;

      return (
        <rect
          key={`selection_${block.blockIndex}`}
          x={x}
          y={y}
          width={width}
          height={height}
          rx={6}
          fill="rgba(27, 116, 228, 0.10)"
          stroke="#1b74e4"
          strokeDasharray="6 4"
          strokeWidth={1.5}
          pointerEvents="none"
        />
      );
    });
}

function renderAnnotation(
  annotation: Annotation,
  alignment: AlignmentData,
  blocks: BlockLayout[],
  metrics: LayoutMetrics,
  renderMode: RenderMode,
  boxStrokeWidth: number,
  isSelected: boolean,
  onAnnotationPointerDown: (
    annotationId: string,
    clientX: number,
    clientY: number,
    handle?: "body" | "arrow-tail" | "arrow-head",
  ) => void,
) {
  if (annotation.visible === false) {
    return null;
  }

  if (annotation.type === "bridge") {
    return renderBridgeAnnotation(annotation, blocks, metrics, renderMode, isSelected, onAnnotationPointerDown);
  }

  const gridX = metrics.padding + metrics.nameWidth;
  const normalized = normalizeSelection(annotation.selection);
  const elements: ReactElement[] = [];

  for (const block of blocks) {
    if (!selectionIntersectsBlock(normalized, block)) {
      continue;
    }

    const startColumn = Math.max(normalized.startColumn, block.startColumn);
    const endColumn = Math.min(normalized.endColumn, block.endColumn);
    const x = gridX + (startColumn - block.startColumn) * metrics.cellWidth;
    const y = block.rowY[normalized.startSequence];
    const width = (endColumn - startColumn + 1) * metrics.cellWidth;
    const height =
      (normalized.endSequence - normalized.startSequence + 1) * (metrics.cellHeight + metrics.rowGap) - metrics.rowGap;

    if (annotation.type === "highlight") {
      elements.push(
        <rect
          key={`${annotation.id}_${block.blockIndex}`}
          x={x}
          y={y}
          width={width}
          height={height}
          rx={renderMode === "editor" ? 6 : 0}
          fill="#000000"
          fillOpacity={0.001}
          stroke={isSelected ? annotation.color : "none"}
          strokeWidth={isSelected ? 1.4 : 0}
          strokeDasharray={isSelected ? "8 4" : undefined}
          data-annotation-id={annotation.id}
          pointerEvents="all"
          onPointerDown={(event) => onAnnotationPointerDown(annotation.id, event.clientX, event.clientY)}
        />,
      );
    }

    if (annotation.type === "box") {
      elements.push(
        <rect
          key={`${annotation.id}_${block.blockIndex}`}
          x={x + 0.5}
          y={y + 0.5}
          width={width - 1}
          height={height - 1}
          rx={renderMode === "editor" ? 6 : 0}
          fill="none"
          stroke={annotation.color}
          strokeWidth={renderMode === "editor" ? boxStrokeWidth : Math.max(1, boxStrokeWidth - 0.6)}
          strokeDasharray={isSelected ? "10 5" : undefined}
          data-annotation-id={annotation.id}
          onPointerDown={(event) => onAnnotationPointerDown(annotation.id, event.clientX, event.clientY)}
        />,
      );
    }

    if (
      annotation.type === "triangle-up" ||
      annotation.type === "triangle-down" ||
      annotation.type === "arrow-down" ||
      annotation.type === "span-arrow" ||
      annotation.type === "arrow" ||
      annotation.type === "bracket" ||
      annotation.type === "circle" ||
      annotation.type === "open-circle" ||
      annotation.type === "star"
    ) {
      const startColumn = Math.max(normalized.startColumn, block.startColumn);
      const endColumn = Math.min(normalized.endColumn, block.endColumn);
      const centerColumn = Math.floor((startColumn + endColumn) / 2);
      const markerX = gridX + (centerColumn - block.startColumn) * metrics.cellWidth + metrics.cellWidth / 2;
      const spanStartX = gridX + (startColumn - block.startColumn) * metrics.cellWidth;
      const spanEndX = gridX + (endColumn - block.startColumn + 1) * metrics.cellWidth;
      const markerScale = annotation.size ?? 1;
      const placement = annotation.placement ?? "top";
      const anchorY = placement === "top" ? y - 8 : y + height + 8;
      const stroke = isSelected ? "#101828" : "#ffffff";
      const strokeWidth = 1.2 * markerScale;

      if (annotation.type === "triangle-up" || annotation.type === "triangle-down") {
        const markerY = y - 8;
        const points =
          annotation.type === "triangle-up"
            ? `${markerX},${markerY - 8 * markerScale} ${markerX - 7 * markerScale},${markerY + 4 * markerScale} ${markerX + 7 * markerScale},${markerY + 4 * markerScale}`
            : `${markerX},${markerY + 8 * markerScale} ${markerX - 7 * markerScale},${markerY - 4 * markerScale} ${markerX + 7 * markerScale},${markerY - 4 * markerScale}`;
        elements.push(
          <polygon
            key={`${annotation.id}_${block.blockIndex}`}
            points={points}
            fill={annotation.color}
            stroke={stroke}
            strokeWidth={strokeWidth}
            data-annotation-id={annotation.id}
            onPointerDown={(event) => onAnnotationPointerDown(annotation.id, event.clientX, event.clientY, "body")}
          />,
        );
      }

      if (annotation.type === "arrow-down") {
        const direction = placement === "top" ? 1 : -1;
        const shaftTopY = placement === "top" ? y - 20 * markerScale : y + height + 20 * markerScale;
        const shaftBottomY = placement === "top" ? y - 7 * markerScale : y + height + 7 * markerScale;
        const headBaseY = shaftBottomY - 5 * direction * markerScale;
        elements.push(
          <g
            key={`${annotation.id}_${block.blockIndex}`}
            data-annotation-id={annotation.id}
            onPointerDown={(event) => onAnnotationPointerDown(annotation.id, event.clientX, event.clientY, "body")}
          >
            <line
              x1={markerX}
              y1={shaftTopY}
              x2={markerX}
              y2={shaftBottomY}
              stroke={annotation.color}
              strokeWidth={2.2 * markerScale}
              strokeLinecap="round"
            />
            <polygon
              points={`${markerX},${shaftBottomY} ${markerX - 5.5 * markerScale},${headBaseY} ${markerX + 5.5 * markerScale},${headBaseY}`}
              fill={annotation.color}
              stroke={stroke}
              strokeWidth={0.9 * markerScale}
            />
          </g>,
        );
      }

      if (annotation.type === "span-arrow") {
        const arrowY = placement === "top" ? anchorY - 2 : anchorY + 2;
        const headSize = 8 * markerScale;
        const lineEndX = Math.max(spanStartX + 8, spanEndX - headSize - 1);
        elements.push(
          <g
            key={`${annotation.id}_${block.blockIndex}`}
            data-annotation-id={annotation.id}
            onPointerDown={(event) => onAnnotationPointerDown(annotation.id, event.clientX, event.clientY, "body")}
          >
            <line
              x1={spanStartX}
              y1={arrowY}
              x2={lineEndX}
              y2={arrowY}
              stroke={annotation.color}
              strokeWidth={2.2 * markerScale}
              strokeLinecap="round"
            />
            <polygon
              points={`${spanEndX},${arrowY} ${spanEndX - headSize},${arrowY - 5 * markerScale} ${spanEndX - headSize},${arrowY + 5 * markerScale}`}
              fill={annotation.color}
            />
          </g>,
        );
      }

      if (annotation.type === "arrow") {
        const arrowY = placement === "top" ? anchorY - 2 : anchorY + 2;
        const headSize = 8 * markerScale;
        const tailX = spanStartX + (annotation.tailDx ?? 0);
        const tailY = arrowY + (annotation.tailDy ?? 0);
        const headX = spanEndX + (annotation.headDx ?? 0);
        const headY = arrowY + (annotation.headDy ?? 0);
        const lineEndX = Math.max(tailX + 8, headX - headSize - 1);
        const lineEndY = headY;
        elements.push(
          <g
            key={`${annotation.id}_${block.blockIndex}`}
            data-annotation-id={annotation.id}
            onPointerDown={(event) => onAnnotationPointerDown(annotation.id, event.clientX, event.clientY, "body")}
          >
            <line x1={tailX} y1={tailY} x2={lineEndX} y2={lineEndY} stroke={annotation.color} strokeWidth={2.2 * markerScale} />
            <polygon
              points={`${headX},${headY} ${headX - headSize},${headY - 5 * markerScale} ${headX - headSize},${headY + 5 * markerScale}`}
              fill={annotation.color}
            />
            {renderMode === "editor" && isSelected ? (
              <>
                <circle
                  cx={tailX}
                  cy={tailY}
                  r={4.5}
                  className="annotation-handle"
                  data-annotation-id={annotation.id}
                  onPointerDown={(event) => onAnnotationPointerDown(annotation.id, event.clientX, event.clientY, "arrow-tail")}
                />
                <circle
                  cx={headX}
                  cy={headY}
                  r={4.5}
                  className="annotation-handle"
                  data-annotation-id={annotation.id}
                  onPointerDown={(event) => onAnnotationPointerDown(annotation.id, event.clientX, event.clientY, "arrow-head")}
                />
              </>
            ) : null}
          </g>,
        );
      }

      if (annotation.type === "bracket") {
        const bracketY = placement === "top" ? anchorY - 1 : anchorY + 1;
        const tickHeight = 7 * markerScale;
        const direction = placement === "top" ? 1 : -1;
        elements.push(
          <path
            key={`${annotation.id}_${block.blockIndex}`}
            d={`M ${spanStartX} ${bracketY + tickHeight * direction} L ${spanStartX} ${bracketY} L ${spanEndX} ${bracketY} L ${spanEndX} ${bracketY + tickHeight * direction}`}
            fill="none"
            stroke={annotation.color}
            strokeWidth={2 * markerScale}
            data-annotation-id={annotation.id}
            onPointerDown={(event) => onAnnotationPointerDown(annotation.id, event.clientX, event.clientY, "body")}
          />,
        );
      }

      if (annotation.type === "circle" || annotation.type === "open-circle") {
        elements.push(
          <circle
            key={`${annotation.id}_${block.blockIndex}`}
            cx={markerX}
            cy={y - 9}
            r={6.4 * markerScale}
            fill={annotation.type === "circle" ? annotation.color : "#ffffff"}
            stroke={annotation.color}
            strokeWidth={annotation.type === "circle" ? 1.2 * markerScale : 1.8 * markerScale}
            data-annotation-id={annotation.id}
            onPointerDown={(event) => onAnnotationPointerDown(annotation.id, event.clientX, event.clientY, "body")}
          />,
        );
      }

      if (annotation.type === "star") {
        const points = starPoints(markerX, y - 9, 7 * markerScale, 3.4 * markerScale, 5);
        elements.push(
          <polygon
            key={`${annotation.id}_${block.blockIndex}`}
            points={points}
            fill={annotation.color}
            stroke={stroke}
            strokeWidth={strokeWidth}
            data-annotation-id={annotation.id}
            onPointerDown={(event) => onAnnotationPointerDown(annotation.id, event.clientX, event.clientY, "body")}
          />,
        );
      }
    }
  }

  if (annotation.type === "text") {
    const anchorColumn = Math.min(annotation.selection.endColumn, alignment.alignmentLength - 1);
    const anchorBlock = blocks.find((block) => anchorColumn >= block.startColumn && anchorColumn <= block.endColumn);
    if (anchorBlock) {
      const anchorX = gridX + (anchorColumn - anchorBlock.startColumn + 0.5) * metrics.cellWidth;
      const anchorY = anchorBlock.rowY[annotation.selection.startSequence] - 6;
      const labelX = anchorX + annotation.dx;
      const labelY = anchorY + annotation.dy;

      elements.push(
        <g
          key={annotation.id}
          data-annotation-id={annotation.id}
          onPointerDown={(event) => onAnnotationPointerDown(annotation.id, event.clientX, event.clientY)}
        >
          {annotation.connector !== false ? (
            <line x1={anchorX} y1={anchorY} x2={labelX} y2={labelY - 10} stroke={annotation.color} strokeWidth={1.1} />
          ) : null}
          {annotation.boxed !== false ? (
            <rect
              x={labelX - 6}
              y={labelY - 22}
              width={annotation.text.length * 7.5 + 12}
              height={18}
              rx={renderMode === "editor" ? 8 : 0}
              fill="#ffffff"
              stroke={annotation.color}
              strokeWidth={isSelected ? 1.8 : 1.1}
            />
          ) : null}
          <text x={labelX} y={labelY - 9} className="annotation-label">
            {annotation.text}
          </text>
        </g>,
      );
    }
  }

  return <g key={annotation.id}>{elements}</g>;
}

function renderBridgeAnnotation(
  annotation: Extract<Annotation, { type: "bridge" }>,
  blocks: BlockLayout[],
  metrics: LayoutMetrics,
  renderMode: RenderMode,
  isSelected: boolean,
  onAnnotationPointerDown: (
    annotationId: string,
    clientX: number,
    clientY: number,
    handle?: "body" | "arrow-tail" | "arrow-head",
  ) => void,
) {
  if (annotation.visible === false) {
    return null;
  }

  const leftColumn = Math.min(annotation.from.column, annotation.to.column);
  const rightColumn = Math.max(annotation.from.column, annotation.to.column);
  const block = blocks.find((item) => leftColumn >= item.startColumn && rightColumn <= item.endColumn);
  if (!block) {
    return null;
  }

  const gridX = metrics.padding + metrics.nameWidth;
  const fromX = gridX + (annotation.from.column - block.startColumn + 0.5) * metrics.cellWidth;
  const toX = gridX + (annotation.to.column - block.startColumn + 0.5) * metrics.cellWidth;
  const topAnchorOffset = metrics.cellHeight * 0.14;
  const bottomAnchorOffset = metrics.cellHeight * 0.86;
  const placement = annotation.placement ?? "top";
  const fromY =
    placement === "top"
      ? block.rowY[annotation.from.sequenceIndex] + topAnchorOffset
      : block.rowY[annotation.from.sequenceIndex] + bottomAnchorOffset;
  const toY =
    placement === "top"
      ? block.rowY[annotation.to.sequenceIndex] + topAnchorOffset
      : block.rowY[annotation.to.sequenceIndex] + bottomAnchorOffset;
  const bridgeHeight = annotation.height ?? 1;
  const clearance = (renderMode === "export" ? 10 : 14) * bridgeHeight;
  const bridgeY =
    placement === "top"
      ? Math.min(fromY, toY) - clearance
      : Math.max(fromY, toY) + clearance;
  const strokeWidth = isSelected ? 2.8 : renderMode === "export" ? 1.6 : 2.2;
  const endCap = renderMode === "export" ? 2.2 : 3.2;
  const style = annotation.style ?? "bracket";

  return (
    <g
      key={annotation.id}
      data-annotation-id={annotation.id}
      onPointerDown={(event) => onAnnotationPointerDown(annotation.id, event.clientX, event.clientY)}
    >
      {style === "arch" ? (
        <path
          d={`M ${fromX} ${fromY} Q ${(fromX + toX) / 2} ${bridgeY} ${toX} ${toY}`}
          fill="none"
          stroke={annotation.color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
      ) : (
        <path
          d={`M ${fromX} ${fromY} L ${fromX} ${bridgeY} L ${toX} ${bridgeY} L ${toX} ${toY}`}
          fill="none"
          stroke={annotation.color}
          strokeWidth={strokeWidth}
          strokeLinecap="square"
          strokeLinejoin="miter"
        />
      )}
      <line
        x1={fromX - endCap}
        y1={fromY}
        x2={fromX + endCap}
        y2={fromY}
        stroke={annotation.color}
        strokeWidth={Math.max(1.2, strokeWidth - 0.3)}
        strokeLinecap="round"
      />
      <line
        x1={toX - endCap}
        y1={toY}
        x2={toX + endCap}
        y2={toY}
        stroke={annotation.color}
        strokeWidth={Math.max(1.2, strokeWidth - 0.3)}
        strokeLinecap="round"
      />
    </g>
  );
}

function resolveResidueStyle(
  residue: string,
  sequenceIndex: number,
  column: number,
  profile: ReturnType<typeof buildColumnProfiles>[number],
  renderMode: RenderMode,
  visualizationMode: VisualizationMode,
  espriptPreset: EspriptPreset,
  conservationColors: ConservationColorOverrides | null,
  highlightColors: Map<string, string>,
) {
  const highlightColor = highlightColors.get(`${sequenceIndex}:${column}`);
  if (highlightColor) {
    return {
      fill: highlightColor,
      stroke: highlightColor,
      text: readableTextColor(highlightColor),
      drawBox: true,
      frameColor: null,
    };
  }

  return getResidueStyle(residue, profile, renderMode, visualizationMode, espriptPreset, conservationColors);
}

function buildHighlightColorMap(annotations: Annotation[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const annotation of annotations) {
    if (annotation.type !== "highlight" || annotation.visible === false) {
      continue;
    }
    const selection = normalizeSelection(annotation.selection);
    for (let sequenceIndex = selection.startSequence; sequenceIndex <= selection.endSequence; sequenceIndex += 1) {
      for (let column = selection.startColumn; column <= selection.endColumn; column += 1) {
        map.set(`${sequenceIndex}:${column}`, annotation.color);
      }
    }
  }
  return map;
}

function readableTextColor(color: string): string {
  const normalized = color.replace("#", "");
  const expanded = normalized.length === 3 ? normalized.split("").map((char) => `${char}${char}`).join("") : normalized;
  const r = Number.parseInt(expanded.slice(0, 2), 16);
  const g = Number.parseInt(expanded.slice(2, 4), 16);
  const b = Number.parseInt(expanded.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.64 ? "#111111" : "#ffffff";
}

function locateCell(
  event: ReactPointerEvent<SVGSVGElement>,
  svg: SVGSVGElement | null,
  alignment: AlignmentData,
  blocks: BlockLayout[],
  metrics: LayoutMetrics,
): { sequenceIndex: number; column: number } | null {
  if (!svg) {
    return null;
  }

  const rect = svg.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) {
    return null;
  }

  const viewBox = svg.viewBox.baseVal;
  const x = ((event.clientX - rect.left) / rect.width) * viewBox.width;
  const y = ((event.clientY - rect.top) / rect.height) * viewBox.height;
  const gridX = metrics.padding + metrics.nameWidth;
  const rowBand = metrics.cellHeight + metrics.rowGap;

  for (const block of blocks) {
    const blockGridWidth = (block.endColumn - block.startColumn + 1) * metrics.cellWidth;
    const blockTop = block.rowY[0];
    const blockBottom = blockTop + alignment.sequences.length * rowBand - metrics.rowGap;
    if (x < gridX || x >= gridX + blockGridWidth || y < blockTop || y > blockBottom) {
      continue;
    }

    const rowOffset = y - blockTop;
    const sequenceIndex = Math.floor(rowOffset / rowBand);
    if (sequenceIndex < 0 || sequenceIndex >= alignment.sequences.length) {
      return null;
    }

    const withinRow = rowOffset - sequenceIndex * rowBand;
    if (withinRow > metrics.cellHeight) {
      return null;
    }

    const columnOffset = Math.floor((x - gridX) / metrics.cellWidth);
    const column = block.startColumn + columnOffset;
    if (column < block.startColumn || column > block.endColumn) {
      return null;
    }

    return { sequenceIndex, column };
  }

  return null;
}

function renderLegend(
  width: number,
  height: number,
  visualizationMode: VisualizationMode,
  espriptPreset: EspriptPreset,
  conservationColors: ConservationColorOverrides | null,
  includeAutoLegend: boolean,
  customLegendItems: CustomLegendItem[],
) {
  const strictColor = conservationColors?.strict ?? "#d92d20";
  const similarColor = conservationColors?.similar ?? "#f79009";
  const frameColor = conservationColors?.similar ?? "#335cff";
  const baseItems = includeAutoLegend
    ? [
        {
          label: "Strict identity",
          sample:
            <g>
              <rect x={0} y={-8} width={14} height={10} fill={strictColor} />
              <text x={7} y={0.2} textAnchor="middle" className="legend-sample-invert">A</text>
            </g>,
        },
        {
          label: "Similar column",
          sample:
            visualizationMode === "espript" && espriptPreset === "flashy" ? (
              <g>
                <rect x={0} y={-8} width={14} height={10} fill="#ffef78" stroke="#d1b400" strokeWidth={0.8} />
                <text x={7} y={0.2} textAnchor="middle" className="legend-sample-dark">A</text>
              </g>
            ) : (
              <text x={7} y={0.2} textAnchor="middle" className="legend-sample-red" fill={visualizationMode === "espript" ? "#ff1f1f" : similarColor}>
                A
              </text>
            ),
        },
        {
          label: visualizationMode === "espript" && espriptPreset !== "identity" ? "Global similarity frame" : "Weak conservation",
          sample:
            visualizationMode === "espript" && espriptPreset !== "identity" ? (
              <g>
                <rect x={0} y={-8} width={14} height={10} fill="none" stroke={frameColor} strokeWidth={1} />
                <text x={7} y={0.2} textAnchor="middle" className="legend-sample-dark">A</text>
              </g>
            ) : (
              <rect x={0} y={-8} width={14} height={10} fill={conservationColors?.weak ?? "#fdb022"} />
            ),
        },
      ]
    : [];
  const customItems = customLegendItems
    .filter((item) => item.label.trim())
    .map((item) => ({
      label: item.label.trim(),
      sample:
        item.style === "outline" ? (
          <rect x={0} y={-8} width={14} height={10} fill="none" stroke={item.color} strokeWidth={1.2} />
        ) : item.style === "text" ? (
          <text x={7} y={0.2} textAnchor="middle" className="legend-sample-dark" fill={item.color}>
            A
          </text>
        ) : (
          <rect x={0} y={-8} width={14} height={10} fill={item.color} />
        ),
    }));
  const items = [...baseItems, ...customItems];
  if (items.length === 0) {
    return null;
  }
  const legendHeight = 24 + items.length * 15 + 8;
  const x = width - 220;
  const y = height - legendHeight - 12;
  const title = visualizationMode === "espript" ? `Legend · ESPript ${capitalize(espriptPreset)}` : "Legend";

  return (
    <g className="legend-group">
      <rect x={x} y={y} width={192} height={legendHeight} rx={4} fill="#ffffff" stroke="#c7cfd8" strokeWidth={0.8} />
      <text x={x + 10} y={y + 13} className="legend-title">
        {title}
      </text>
      {items.map((item, index) => {
        const rowY = y + 27 + index * 15;
        return (
          <g key={`${item.label}_${index}`}>
            <g transform={`translate(${x + 10} ${rowY})`}>{item.sample}</g>
            <text x={x + 32} y={rowY + 0.8} className="legend-label">
              {item.label}
            </text>
          </g>
        );
      })}
    </g>
  );
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function renderPendingBridgeAnchor(
  anchor: { sequenceIndex: number; column: number },
  blocks: BlockLayout[],
  metrics: LayoutMetrics,
  _secondaryStructureTrack: SecondaryStructureTrack | null,
  _renderMode: RenderMode,
) {
  const block = blocks.find((item) => anchor.column >= item.startColumn && anchor.column <= item.endColumn);
  if (!block) {
    return null;
  }

  const gridX = metrics.padding + metrics.nameWidth;
  const x = gridX + (anchor.column - block.startColumn + 0.5) * metrics.cellWidth;
  const y = block.rowY[anchor.sequenceIndex] + metrics.cellHeight / 2;

  const size = metrics.cellWidth * 0.26;
  return <rect x={x - size} y={y - size} width={size * 2} height={size * 2} fill="#7c3aed" opacity={0.92} rx={1.6} />;
}

function renderStructureTrack(
  track: SecondaryStructureTrack,
  block: BlockLayout,
  gridX: number,
  metrics: LayoutMetrics,
  renderMode: RenderMode,
  placement: "top" | "bottom",
  style: StructureRenderStyle,
  forcedLaneY?: number,
) {
  const laneY = placement === "top" ? (renderMode === "export" ? 16 : 18) : (forcedLaneY ?? 0) + 8;
  const labelY = placement === "top" ? laneY + (renderMode === "export" ? 2 : 3) : laneY + 5;
  let helixCount = countTrackSegmentsBefore(track.residues, block.startColumn, "H");
  let strandCount = countTrackSegmentsBefore(track.residues, block.startColumn, "E");
  const elements: ReactElement[] = [
    <text key={`track_label_${block.blockIndex}`} x={metrics.padding} y={labelY} className="track-label">
      {track.label}
    </text>,
  ];

  let index = block.startColumn;
  while (index <= block.endColumn) {
    const symbol = classifyTrackSymbol(track.residues[index] ?? "C");
    if (!symbol) {
      index += 1;
      continue;
    }

    let end = index;
    while (end + 1 <= block.endColumn && classifyTrackSymbol(track.residues[end + 1] ?? "C") === symbol) {
      end += 1;
    }

    const x = gridX + (index - block.startColumn) * metrics.cellWidth;
    const width = (end - index + 1) * metrics.cellWidth;
    const residueCount = end - index + 1;
    const previousSymbol = classifyTrackSymbol(track.residues[index - 1] ?? "C");
    const nextSymbol = classifyTrackSymbol(track.residues[end + 1] ?? "C");

    if (symbol === "H") {
      helixCount += 1;
      elements.push(
        ...(style === "ssdraw"
          ? helixSsDrawGroup(block.blockIndex, index, x, laneY, width, residueCount, renderMode)
          : style === "protopo"
            ? protopoHelix(block.blockIndex, index, x, laneY, width, renderMode)
            : helixCoilGroup(block.blockIndex, index, x, laneY, width, renderMode)),
      );
      elements.push(
        <text
          key={`helix_label_${block.blockIndex}_${index}`}
          x={x + width / 2}
          y={laneY - 6}
          textAnchor="middle"
          className="track-segment-label"
        >
          {`\u03b1${helixCount}`}
        </text>,
      );
    } else if (symbol === "E") {
      strandCount += 1;
      elements.push(
        style === "ssdraw"
          ? ssdrawStrand(block.blockIndex, index, x, laneY, width, residueCount, renderMode, nextSymbol)
          : style === "protopo"
            ? protopoStrand(block.blockIndex, index, x, laneY, width, renderMode)
            : classicStrand(block.blockIndex, index, x, laneY, width),
      );
      elements.push(
        <text
          key={`strand_label_${block.blockIndex}_${index}`}
          x={x + width / 2}
          y={laneY - 6}
          textAnchor="middle"
          className="track-segment-label"
        >
          {`\u03b2${strandCount}`}
        </text>,
      );
    } else {
      elements.push(
        style === "ssdraw"
          ? ssdrawLoop(block.blockIndex, index, x, laneY, width, residueCount, renderMode, previousSymbol, nextSymbol)
          : style === "protopo"
            ? protopoLinker(block.blockIndex, index, x, laneY, width, renderMode)
          : (
            <text
              key={`turn_${block.blockIndex}_${index}`}
              x={x + width / 2}
              y={laneY + 7}
              textAnchor="middle"
              className="track-turn-label"
            >
              TT
            </text>
          ),
      );
    }

    index = end + 1;
  }

  return <g>{elements}</g>;
}

function classicStrand(blockIndex: number, index: number, x: number, laneY: number, width: number): ReactElement {
  const tip = x + width;
  const arrowBody = Math.max(width - 10, 2);
  const points = `${x},${laneY + 2} ${x + arrowBody},${laneY + 2} ${tip},${laneY + 5} ${x + arrowBody},${laneY + 8} ${x},${laneY + 8}`;
  return <polygon key={`strand_${blockIndex}_${index}`} points={points} fill="#111111" opacity={0.95} />;
}

function classifyTrackSymbol(symbol: string): "H" | "E" | "T" | null {
  const upper = symbol.toUpperCase();
  if ("HGI".includes(upper)) return "H";
  if ("EB".includes(upper)) return "E";
  if ("TS".includes(upper)) return "T";
  return null;
}

function helixCoilGroup(
  blockIndex: number,
  index: number,
  x: number,
  laneY: number,
  width: number,
  renderMode: RenderMode,
): ReactElement[] {
  const amplitude = renderMode === "export" ? 3.9 : 4.4;
  const period = renderMode === "export" ? 7.8 : 8.6;
  const baselineY = laneY + (renderMode === "export" ? 3.5 : 3.9);
  const halfPeriod = period / 2;
  let cursor = x;
  let direction = -1;
  let path = `M ${x.toFixed(2)} ${baselineY.toFixed(2)}`;

  while (cursor < x + width) {
    const controlX = Math.min(cursor + halfPeriod / 2, x + width);
    const nextX = Math.min(cursor + halfPeriod, x + width);
    const controlY = baselineY + amplitude * direction;
    path += ` Q ${controlX.toFixed(2)} ${controlY.toFixed(2)} ${nextX.toFixed(2)} ${baselineY.toFixed(2)}`;
    cursor += halfPeriod;
    direction *= -1;
  }

  return [
    <path
      key={`helix_wave_${blockIndex}_${index}`}
      d={path}
      fill="none"
      stroke="#596474"
      strokeWidth={renderMode === "export" ? 1.18 : 1.34}
      strokeLinecap="round"
      strokeLinejoin="round"
    />,
  ];
}

function helixSsDrawGroup(
  blockIndex: number,
  index: number,
  x: number,
  laneY: number,
  width: number,
  residueCount: number,
  renderMode: RenderMode,
): ReactElement[] {
  const residues = Math.max(1, residueCount);
  const unit = width / residues;
  const scale = renderMode === "export" ? 5.6 : 6.1;
  const front = "#98a4b5";
  const back = "#d6dce5";
  const stroke = "#4a5565";
  const strokeWidth = renderMode === "export" ? 0.6 : 0.72;

  // Geometry ported from SSDraw's build_helix() and translated into SVG coordinates.
  const y = (value: number) => laneY - value * scale;
  const xPos = (value: number) => x + value * unit;
  const polygons: ReactElement[] = [];

  const pushPolygon = (points: [number, number][], fill: string, key: string) => {
    polygons.push(
      <polygon
        key={key}
        points={points.map(([px, py]) => `${px},${py}`).join(" ")}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinejoin="miter"
      />,
    );
  };

  if (residues <= 2) {
    pushPolygon(
      [
        [xPos(0), y(-0.25)],
        [xPos(1), y(0.75)],
        [xPos(residues), y(0.75)],
        [xPos(Math.max(0, residues - 1)), y(-0.25)],
      ],
      back,
      `ssdraw_helix_short_${blockIndex}_${index}`,
    );
    return polygons;
  }

  pushPolygon(
    [
      [xPos(0), y(-0.25)],
      [xPos(1), y(0.75)],
      [xPos(2), y(0.75)],
      [xPos(1), y(-0.25)],
    ],
    back,
    `ssdraw_helix_start_${blockIndex}_${index}`,
  );

  for (let j = 0; j < residues - 3; j += 1) {
    if (j % 2 === 0) {
      pushPolygon(
        [
          [xPos(1 + j), y(0.75)],
          [xPos(2 + j), y(0.75)],
          [xPos(3 + j), y(-0.75)],
          [xPos(2 + j), y(-0.75)],
        ],
        front,
        `ssdraw_helix_front_${blockIndex}_${index}_${j}`,
      );
    } else {
      pushPolygon(
        [
          [xPos(1 + j), y(-0.75)],
          [xPos(2 + j), y(-0.75)],
          [xPos(3 + j), y(0.75)],
          [xPos(2 + j), y(0.75)],
        ],
        back,
        `ssdraw_helix_back_${blockIndex}_${index}_${j}`,
      );
    }
  }

  if ((residues - 3) % 2 === 1) {
    pushPolygon(
      [
        [xPos(residues - 1), y(-0.75)],
        [xPos(residues), y(-0.75)],
        [xPos(residues + 1), y(0.25)],
        [xPos(residues), y(0.25)],
      ],
      back,
      `ssdraw_helix_end_back_${blockIndex}_${index}`,
    );
  } else {
    pushPolygon(
      [
        [xPos(residues - 1), y(0.75)],
        [xPos(residues), y(0.75)],
        [xPos(residues + 1), y(-0.25)],
        [xPos(residues), y(-0.25)],
      ],
      front,
      `ssdraw_helix_end_front_${blockIndex}_${index}`,
    );
  }

  return polygons;
}

function ssdrawStrand(
  blockIndex: number,
  index: number,
  x: number,
  laneY: number,
  width: number,
  residueCount: number,
  renderMode: RenderMode,
  nextSymbol: "H" | "E" | "T" | null,
): ReactElement {
  const residues = Math.max(1, residueCount);
  const unit = width / residues;
  const headLength = unit * 2;
  const delta = nextSymbol === null ? 0 : 1;
  const startX = x + (delta - 1) * unit;
  const tip = startX + width;
  const yMid = laneY + (renderMode === "export" ? 4.15 : 4.55);
  const halfHeight = renderMode === "export" ? 3.25 : 3.7;
  const bodyEnd = Math.max(startX + unit * 1.1, tip - headLength);
  const points = `${startX},${yMid - halfHeight} ${bodyEnd},${yMid - halfHeight} ${tip},${yMid} ${bodyEnd},${yMid + halfHeight} ${startX},${yMid + halfHeight}`;
  return (
    <polygon
      key={`ssdraw_strand_${blockIndex}_${index}`}
      points={points}
      fill="#d7dde6"
      stroke="#4a5565"
      strokeWidth={renderMode === "export" ? 0.58 : 0.72}
      strokeLinejoin="miter"
    />
  );
}

function ssdrawLoop(
  blockIndex: number,
  index: number,
  x: number,
  laneY: number,
  width: number,
  residueCount: number,
  renderMode: RenderMode,
  previousSymbol: "H" | "E" | "T" | null,
  nextSymbol: "H" | "E" | "T" | null,
): ReactElement {
  const residues = Math.max(1, residueCount);
  const unit = width / residues;
  let startX = x;
  if (previousSymbol && previousSymbol !== "E") {
    startX -= unit;
  } else if (!previousSymbol) {
    startX += unit * 0.06;
  }

  let endX = x + width + unit * 0.33;
  if (nextSymbol === "E") {
    endX = x + width - unit * 0.25;
  } else if (nextSymbol === null) {
    endX = x + width - unit * 0.68;
  }

  const barHeight = renderMode === "export" ? 2.05 : 2.35;
  const y = laneY + (renderMode === "export" ? 3.9 : 4.35);
  return (
    <rect
      key={`ssdraw_loop_${blockIndex}_${index}`}
      x={startX}
      y={y}
      width={Math.max(unit * 0.4, endX - startX)}
      height={barHeight}
      rx={barHeight / 2}
      fill="#d8dee7"
      stroke="#4a5565"
      strokeWidth={renderMode === "export" ? 0.48 : 0.58}
    />
  );
}

function protopoHelix(
  blockIndex: number,
  index: number,
  x: number,
  laneY: number,
  width: number,
  renderMode: RenderMode,
): ReactElement[] {
  const height = renderMode === "export" ? 8.4 : 9.2;
  const y = laneY + (renderMode === "export" ? 0.6 : 0.9);
  return [
    <rect
      key={`protopo_helix_${blockIndex}_${index}`}
      x={x}
      y={y}
      width={width}
      height={height}
      fill="#b67457"
      stroke="#3f2a1f"
      strokeWidth={renderMode === "export" ? 0.65 : 0.78}
      rx={height * 0.2}
    />,
  ];
}

function protopoStrand(
  blockIndex: number,
  index: number,
  x: number,
  laneY: number,
  width: number,
  renderMode: RenderMode,
): ReactElement {
  const yMid = laneY + (renderMode === "export" ? 4.85 : 5.25);
  const bodyHalf = renderMode === "export" ? 2.75 : 3.05;
  const headLength = Math.min(Math.max(width * 0.22, 9), 16);
  const bodyEnd = Math.max(x + width * 0.42, x + width - headLength);
  const tip = x + width;
  const points = `${x},${yMid - bodyHalf} ${bodyEnd},${yMid - bodyHalf} ${tip},${yMid} ${bodyEnd},${yMid + bodyHalf} ${x},${yMid + bodyHalf}`;
  return (
    <polygon
      key={`protopo_strand_${blockIndex}_${index}`}
      points={points}
      fill="#73a96a"
      stroke="#244327"
      strokeWidth={renderMode === "export" ? 0.65 : 0.8}
      strokeLinejoin="miter"
    />
  );
}

function protopoLinker(
  blockIndex: number,
  index: number,
  x: number,
  laneY: number,
  width: number,
  renderMode: RenderMode,
): ReactElement {
  const y = laneY + (renderMode === "export" ? 5.1 : 5.5);
  return (
    <line
      key={`protopo_linker_${blockIndex}_${index}`}
      x1={x}
      x2={x + width}
      y1={y}
      y2={y}
      stroke="#4b5563"
      strokeWidth={renderMode === "export" ? 1.6 : 1.9}
      strokeLinecap="round"
    />
  );
}

function countTrackSegmentsBefore(residues: string, endExclusive: number, symbol: "H" | "E"): number {
  let count = 0;
  let index = 0;
  while (index < endExclusive) {
    const current = classifyTrackSymbol(residues[index] ?? "C");
    if (current !== symbol) {
      index += 1;
      continue;
    }
    count += 1;
    while (index + 1 < endExclusive && classifyTrackSymbol(residues[index + 1] ?? "C") === symbol) {
      index += 1;
    }
    index += 1;
  }
  return count;
}

function starPoints(cx: number, cy: number, outerRadius: number, innerRadius: number, spikes: number): string {
  const step = Math.PI / spikes;
  const points: string[] = [];
  for (let index = 0; index < spikes * 2; index += 1) {
    const radius = index % 2 === 0 ? outerRadius : innerRadius;
    const angle = index * step - Math.PI / 2;
    points.push(`${cx + Math.cos(angle) * radius},${cy + Math.sin(angle) * radius}`);
  }
  return points.join(" ");
}
