import { downloadBlob } from "./utils";

type RasterExportOptions = {
  scale?: number;
  quality?: number;
};

export async function exportSvg(svg: SVGSVGElement, filename: string): Promise<void> {
  const markup = serializeSvg(svg);
  downloadBlob(filename, "image/svg+xml;charset=utf-8", markup);
}

export async function exportPng(svg: SVGSVGElement, filename: string, options?: RasterExportOptions): Promise<void> {
  const canvas = await rasterizeSvgToCanvas(svg, options);
  const blob = await canvasToBlob(canvas, "image/png");
  downloadBlob(filename, "image/png", blob);
}

export async function exportPdf(svg: SVGSVGElement, filename: string, options?: RasterExportOptions): Promise<void> {
  const canvas = await rasterizeSvgToCanvas(svg, options);
  const jpegDataUrl = canvas.toDataURL("image/jpeg", options?.quality ?? 0.94);
  const pdf = buildPdfFromJpeg(jpegDataUrl, canvas.width, canvas.height);
  const pdfBuffer = pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength) as ArrayBuffer;
  downloadBlob(filename, "application/pdf", new Blob([pdfBuffer], { type: "application/pdf" }));
}

async function rasterizeSvgToCanvas(svg: SVGSVGElement, options?: RasterExportOptions): Promise<HTMLCanvasElement> {
  const markup = serializeSvg(svg);
  const blob = new Blob([markup], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  return await new Promise<HTMLCanvasElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      const width = svg.viewBox.baseVal.width || svg.clientWidth;
      const height = svg.viewBox.baseVal.height || svg.clientHeight;
      const scale = Math.max(1, options?.scale ?? 1);
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      const context = canvas.getContext("2d");

      if (!context) {
        reject(new Error("Canvas export is not available in this browser."));
        URL.revokeObjectURL(url);
        return;
      }

      context.fillStyle = "#f4f1eb";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.setTransform(scale, 0, 0, scale, 0, 0);
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(image, 0, 0, width, height);
      URL.revokeObjectURL(url);
      resolve(canvas);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("PNG export failed to rasterize the SVG."));
    };
    image.src = url;
  });
}

async function canvasToBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob> {
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error(`${type} export failed.`));
        return;
      }
      resolve(blob);
    }, type);
  });
}

function buildPdfFromJpeg(dataUrl: string, width: number, height: number): Uint8Array {
  const jpegBytes = dataUrlToBytes(dataUrl);
  const pageWidth = Math.round(width);
  const pageHeight = Math.round(height);
  const content = `q\n${pageWidth} 0 0 ${pageHeight} 0 0 cm\n/Im0 Do\nQ\n`;

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Count 1 /Kids [3 0 R] >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`,
    null,
    `<< /Length ${content.length} >>\nstream\n${content}endstream`,
  ];

  const chunks: Uint8Array[] = [];
  const offsets: number[] = [0];
  let cursor = 0;

  const header = toBytes("%PDF-1.4\n");
  chunks.push(header);
  cursor += header.length;

  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(cursor);
    const objectNumber = index + 1;
    const prefix = toBytes(`${objectNumber} 0 obj\n`);
    chunks.push(prefix);
    cursor += prefix.length;

    if (objectNumber === 4) {
      const imageHeader = toBytes(
        `<< /Type /XObject /Subtype /Image /Width ${pageWidth} /Height ${pageHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`,
      );
      const imageFooter = toBytes("\nendstream");
      chunks.push(imageHeader, jpegBytes, imageFooter);
      cursor += imageHeader.length + jpegBytes.length + imageFooter.length;
    } else {
      const body = toBytes(`${objects[index]}\n`);
      chunks.push(body);
      cursor += body.length;
    }

    const suffix = toBytes("\nendobj\n");
    chunks.push(suffix);
    cursor += suffix.length;
  }

  const xrefOffset = cursor;
  const xrefLines = ["xref", `0 ${objects.length + 1}`, "0000000000 65535 f "];
  for (let index = 1; index < offsets.length; index += 1) {
    xrefLines.push(`${offsets[index].toString().padStart(10, "0")} 00000 n `);
  }
  const xref = toBytes(`${xrefLines.join("\n")}\n`);
  const trailer = toBytes(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);
  chunks.push(xref, trailer);

  return joinBytes(chunks);
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(",")[1] ?? "";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function toBytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function joinBytes(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
}

function serializeSvg(svg: SVGSVGElement): string {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");

  const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
  style.textContent = `
    .sequence-label {
      font-family: "Times New Roman", Times, serif;
    }
    .row-number,.column-number,.annotation-label,.track-label,.track-segment-label,.track-turn-label,.legend-title,.legend-label,.legend-sample-invert,.legend-sample-red,.legend-sample-dark,.block-label,.footer-note {
      font-family: "Courier New", Courier, monospace;
    }
    .residue-letter {
      font-family: "Courier New", Courier, monospace;
      font-kerning: none;
    }
    .sequence-label { font-size: 10.5px; font-weight: 700; }
    .residue-letter { font-size: 10.8px; font-weight: 700; }
    .row-number,.column-number { font-size: 9.8px; font-weight: 600; }
    .annotation-label { font-size: 11px; font-weight: 600; }
    .track-label,.track-segment-label,.track-turn-label { font-size: 9.6px; font-weight: 600; }
    .track-segment-label,.track-turn-label { fill: #3457c2; }
    .legend-title { font-size: 8.8px; font-weight: 700; }
    .legend-label { font-size: 8.2px; font-weight: 500; }
    .legend-sample-invert,.legend-sample-red,.legend-sample-dark { font-size: 8px; font-weight: 700; }
    .legend-sample-invert { fill: #ffffff; }
    .legend-sample-red { fill: #ff1f1f; }
    .legend-sample-dark { fill: #111111; }
  `;

  clone.insertBefore(style, clone.firstChild);
  const serializer = new XMLSerializer();
  return serializer.serializeToString(clone);
}
