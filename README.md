# Interactive Alignment Annotation Tool

Frontend MVP for publication-style protein multiple sequence alignment annotation with direct residue interaction.

## Setup

```bash
npm install
npm run dev
```

Build for production:

```bash
npm run build
```

## What works now

- Clustal `.aln` parsing
- Pasted alignment text parsing
- FASTA-aligned input fallback
- Publication-style SVG alignment rendering
- Separate roomy editor rendering and compact export rendering
- Sequence labels, grouped columns, row numbering, consensus row
- ESPript-like conservation styling for export figures
- Direct click / click-drag selection on rendered cells
- Editable annotations anchored to alignment coordinates
- Highlight fills
- Region boxes
- Triangle-up and triangle-down markers
- Text labels with draggable placement and connector line
- Erase mode
- Keyboard delete for selected annotation
- Undo last annotation with `Cmd/Ctrl+Z`
- SVG export
- PNG export

## Residue-to-annotation mapping

The alignment is stored as a sequence array plus a shared alignment-column index. Every rendered residue cell corresponds to:

- `sequenceIndex`
- `alignmentColumn`

Selections are saved as rectangular bounds in that coordinate system:

- `startSequence`
- `endSequence`
- `startColumn`
- `endColumn`

Annotations persist those logical bounds instead of pixel coordinates. During rendering, the SVG layout engine recomputes each cell position from:

- block index
- wrapped block column offset
- row index
- fixed metrics like cell width/height

This means annotations remain attached to the same biological positions even if the view is re-rendered or exported.

Text labels are the only partial exception: their anchor is still residue-based, but the visible label offset is stored as `dx/dy` relative to the anchor so the user can drag the label box without breaking the attachment point.

## ESPript-inspired export behavior

The app now renders exports from a second hidden SVG with tighter metrics than the interactive editor. That keeps editing comfortable while making the saved figure more publication-like.

The export view follows ESPript-style conservation emphasis:

- strictly conserved columns: white letters on red boxes
- similar columns above threshold: red letters framed in blue
- neutral columns: black letters on white

This is intentionally closer to ESPript's classic rendering than the editor view, while keeping annotations fully editable in the live workspace.

## Future enhancements

- Save/load project JSON
- Additional marker shapes
- Brackets and arrows
- Per-annotation property inspector
- Multi-select editing
- PDF export
- Better conservation scoring and coloring modes
- Smarter cross-block annotation handling for long wrapped selections
