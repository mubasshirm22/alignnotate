import type { AlignmentData, Sequence } from "./types";

function parseSequenceHeader(rawId: string): { id: string; startIndex: number } {
  const parenMatch = rawId.match(/^(.*)\((\d+)\)$/);
  if (parenMatch) {
    return {
      id: parenMatch[1].trim(),
      startIndex: Number(parenMatch[2]),
    };
  }

  const underscoreMatch = rawId.match(/^(.*)_(\d+)_$/);
  if (underscoreMatch) {
    return {
      id: underscoreMatch[1].trim(),
      startIndex: Number(underscoreMatch[2]),
    };
  }

  return {
    id: rawId.trim(),
    startIndex: 1,
  };
}

function validateLengths(sequences: Sequence[]): number {
  if (sequences.length === 0) {
    throw new Error("No sequences were found in the alignment.");
  }

  const expected = sequences[0].aligned.length;
  if (expected === 0) {
    throw new Error("Sequences were parsed, but the alignment is empty.");
  }

  for (const sequence of sequences) {
    if (sequence.aligned.length !== expected) {
      throw new Error(
        `Alignment lengths do not match. "${sequence.id}" has ${sequence.aligned.length} columns, expected ${expected}.`,
      );
    }

    if (!/^[A-Za-z*.\-]+$/.test(sequence.aligned)) {
      throw new Error(`Sequence "${sequence.id}" contains unsupported characters.`);
    }
  }

  return expected;
}

export function parseAlignment(text: string, name = "Uploaded alignment"): AlignmentData {
  const normalizedText = text.replace(/\r/g, "");
  const trimmed = normalizedText.trim();
  if (!trimmed) {
    throw new Error("Paste or upload an alignment before rendering.");
  }

  if (/^CLUSTAL/i.test(trimmed)) {
    return parseClustal(normalizedText, name);
  }

  if (/^>/m.test(trimmed)) {
    return parseFasta(trimmed, name);
  }

  return parsePlain(trimmed, name);
}

function parseClustal(text: string, name: string): AlignmentData {
  const lines = text.split("\n");
  const order: string[] = [];
  const chunks = new Map<string, string[]>();
  const consensusRows: string[] = [];

  const headerIndex = lines.findIndex((line) => /^CLUSTAL/i.test(line.trim()));
  if (headerIndex === -1) {
    throw new Error("Clustal header not found.");
  }

  for (let index = headerIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim()) {
      continue;
    }

    if (/^\s+[*:. ]+\s*$/.test(line)) {
      consensusRows.push(extractConsensusFragment(line));
      continue;
    }

    const match = line.match(/^\s*(\S+)\s+([A-Za-z\-]+)(?:\s+(\d+))?\s*$/);
    if (!match) {
      throw new Error(`Could not parse Clustal line ${index + 1}: "${line}"`);
    }

    const [, id, fragment] = match;
    if (!chunks.has(id)) {
      order.push(id);
      chunks.set(id, []);
    }
    chunks.get(id)!.push(fragment);
  }

  const sequences = order.map((id) => ({
    ...parseSequenceHeader(id),
    aligned: chunks.get(id)!.join(""),
  }));

  const alignmentLength = validateLengths(sequences);
  const consensus = consensusRows.length > 0 ? mergeConsensus(consensusRows, alignmentLength) : undefined;

  return {
    name,
    sourceFormat: "clustal",
    sequences,
    alignmentLength,
    consensus,
  };
}

function parseFasta(text: string, name: string): AlignmentData {
  const entries = text.replace(/\r/g, "").split(/^>/m).filter(Boolean);
  const sequences: Sequence[] = entries.map((entry, index) => {
    const [header, ...body] = entry.split("\n");
    const aligned = body.join("").replace(/\s+/g, "");
    const parsedHeader = parseSequenceHeader(header.trim() || `Sequence_${index + 1}`);
    return { ...parsedHeader, aligned };
  });

  const alignmentLength = validateLengths(sequences);
  return {
    name,
    sourceFormat: "fasta",
    sequences,
    alignmentLength,
  };
}

function parsePlain(text: string, name: string): AlignmentData {
  const lines = text
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const sequences: Sequence[] = lines.map((line) => {
    const match = line.match(/^(\S+)\s+([A-Za-z\-]+)$/);
    if (!match) {
      throw new Error(
        "Plain text alignment must have one sequence per line in the form: name<space>ALIGNED-SEQUENCE",
      );
    }

    return {
      ...parseSequenceHeader(match[1]),
      aligned: match[2],
    };
  });

  const alignmentLength = validateLengths(sequences);
  return {
    name,
    sourceFormat: "plain",
    sequences,
    alignmentLength,
  };
}

function mergeConsensus(rows: string[], alignmentLength: number): string {
  const merged = rows.join("");
  return merged.slice(0, alignmentLength).padEnd(alignmentLength, " ");
}

function extractConsensusFragment(line: string): string {
  return line.replace(/\s+$/, "").replace(/^[\t ]+/, "");
}
