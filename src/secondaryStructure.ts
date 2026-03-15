import type { AlignmentData, SecondaryStructureTrack } from "./types";

export function parseSecondaryStructureTrack(
  rawInput: string,
  alignment: AlignmentData | null,
): SecondaryStructureTrack | null {
  if (!alignment) {
    return null;
  }

  const trimmed = rawInput.trim();
  if (!trimmed) {
    return null;
  }

  const lines = trimmed
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const candidate = lines.length > 1 ? lines.slice(1).join("") : lines[0];
  const label = lines.length > 1 ? lines[0].replace(/:$/, "") : "Secondary structure";
  const residues = candidate
    .replace(/\s+/g, "")
    .toUpperCase()
    .split("")
    .map(mapDsspSymbol)
    .join("");

  if (!/^[HECTC\-]+$/.test(residues)) {
    throw new Error("Secondary structure accepts aligned H/E/T/C style tracks or DSSP-style symbols.");
  }

  if (residues.length !== alignment.alignmentLength) {
    throw new Error(
      `Secondary structure length ${residues.length} does not match alignment length ${alignment.alignmentLength}.`,
    );
  }

  return { label, residues };
}

function mapDsspSymbol(symbol: string): string {
  if ("HGI".includes(symbol)) return "H";
  if ("EB".includes(symbol)) return "E";
  if ("TS".includes(symbol)) return "T";
  if (symbol === "." || symbol === " " || symbol === "C") return "C";
  return symbol;
}
