export interface ExportOptions {
  /** Target resolution in DPI for raster (PNG) export. Default 600 (publication quality). */
  dpi?: number;
  /** Explicit raster scale factor. If provided, overrides `dpi`. */
  scale?: number;
  background?: "transparent" | "white";
  filename?: string;
  fontFamily?: string;
}

/** CSS reference resolution: 1 CSS px == 1/96 inch. */
const CSS_DPI = 96;
/** Browsers cap canvas dimensions (~16384 px per side on most engines). */
const MAX_CANVAS_DIM = 16384;

/**
 * Prepares the SVG for export by cloning it, applying background color,
 * and setting explicit pixel dimensions so downstream rasterization is well-defined.
 */
async function prepareSvgForExport(svgNode: SVGSVGElement, background: "transparent" | "white", fontFamily?: string): Promise<string> {
  const clonedSvg = svgNode.cloneNode(true) as SVGSVGElement;

  const w = svgNode.clientWidth || svgNode.getBoundingClientRect().width;
  const h = svgNode.clientHeight || svgNode.getBoundingClientRect().height;
  if (w && h) {
    clonedSvg.setAttribute("width", String(w));
    clonedSvg.setAttribute("height", String(h));
    if (!clonedSvg.getAttribute("viewBox")) {
      clonedSvg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    }
  }

  if (background === "white") {
    clonedSvg.style.backgroundColor = "white";
    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("width", "100%");
    rect.setAttribute("height", "100%");
    rect.setAttribute("fill", "white");
    clonedSvg.insertBefore(rect, clonedSvg.firstChild);
  }

  try {
    let targetFamily = "";
    if (fontFamily) {
      targetFamily = fontFamily.split(",")[0].replace(/['"]/g, "").trim().toLowerCase();
    }

    let fontCssRules: string[] = [];
    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules) {
          if (rule.type === CSSRule.FONT_FACE_RULE) {
            const ffRule = rule as CSSFontFaceRule;
            const family = ffRule.style.getPropertyValue("font-family").replace(/['"]/g, "").trim().toLowerCase();
            if (targetFamily && family === targetFamily) {
              const weight = ffRule.style.getPropertyValue("font-weight") || "400";
              const style = ffRule.style.getPropertyValue("font-style") || "normal";
              
              // Filter to normal style and regular/bold weights to reduce export bloat
              const isNormalStyle = style === "normal";
              const isCommonWeight = weight === "400" || weight === "normal" || weight === "700" || weight === "bold";
              
              if (isNormalStyle && isCommonWeight) {
                fontCssRules.push(rule.cssText);
              }
            }
          }
        }
      } catch (e) {
        // ignore cross origin
      }
    }
    
    const urlRegex = /url\("?([^"\)]+)"?\)/g;
    const fetchPromises: Promise<{ originalText: string, dataUrl: string | null }>[] = [];
    
    for (const ruleText of fontCssRules) {
      const matches = [...ruleText.matchAll(urlRegex)];
      // Only fetch the first format (typically woff2) to avoid embedding duplicate data
      if (matches.length > 0) {
        const match = matches[0];
        const url = match[1];
        if (url.startsWith("data:")) continue;
        fetchPromises.push((async () => {
          try {
            const res = await fetch(url);
            const blob = await res.blob();
            const reader = new FileReader();
            const dataUrl = await new Promise<string>((resolve) => {
              reader.onload = () => resolve(reader.result as string);
              reader.readAsDataURL(blob);
            });
            return { originalText: match[0], dataUrl: `url("${dataUrl}")` };
          } catch (e) {
            console.error("Failed to inline font url", url, e);
            return { originalText: match[0], dataUrl: null };
          }
        })());
      }
    }

    const results = await Promise.all(fetchPromises);
    
    let fontCss = fontCssRules.join("\n");
    for (const res of results) {
      if (res.dataUrl) {
        fontCss = fontCss.replace(res.originalText, res.dataUrl);
      }
    }

    if (fontCss) {
      const styleNode = document.createElementNS("http://www.w3.org/2000/svg", "style");
      styleNode.textContent = fontCss;
      clonedSvg.insertBefore(styleNode, clonedSvg.firstChild);
    }
  } catch (e) {
    console.error("Failed to embed font CSS:", e);
  }

  return new XMLSerializer().serializeToString(clonedSvg);
}

/** Downloads a given URL/data-URL as a file. */
function downloadUrl(url: string, filename: string) {
  const a = document.createElement("a");
  a.download = filename;
  a.href = url;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/** Standard PNG CRC-32 (table-free). */
function crc32(buf: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Injects a pHYs chunk into a PNG blob so image editors and publishers read the
 * intended DPI (otherwise the file is tagged as the default 96 DPI regardless of
 * pixel count). Inserted immediately after IHDR (byte offset 33).
 */
async function pngBlobWithDpi(blob: Blob, dpi: number): Promise<Blob> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  // Sanity: a valid PNG starts with the 8-byte signature then a 25-byte IHDR chunk.
  if (buf.length < 33) return blob;

  const ppm = Math.round(dpi / 0.0254); // pixels per metre
  const phys = new Uint8Array(21);
  const dv = new DataView(phys.buffer);
  dv.setUint32(0, 9); // chunk data length
  phys[4] = 0x70; phys[5] = 0x48; phys[6] = 0x59; phys[7] = 0x73; // "pHYs"
  dv.setUint32(8, ppm);  // pixels per unit, X
  dv.setUint32(12, ppm); // pixels per unit, Y
  phys[16] = 1;          // unit specifier: 1 = metre
  dv.setUint32(17, crc32(phys.subarray(4, 17))); // CRC over type + data

  const out = new Uint8Array(buf.length + 21);
  out.set(buf.subarray(0, 33), 0);
  out.set(phys, 33);
  out.set(buf.subarray(33), 54);
  return new Blob([out], { type: "image/png" });
}

/**
 * Exports the SVG node to a high-DPI PNG (default 600 DPI) and triggers a download.
 * The PNG carries a pHYs chunk so it reports the true DPI to editors/publishers.
 */
export async function exportPNG(svgNode: SVGSVGElement, options: ExportOptions = {}) {
  await document.fonts.ready;
  if (options.fontFamily) {
    const primaryFamily = options.fontFamily.split(",")[0].replace(/['"]/g, "").trim();
    try {
      await document.fonts.load(`16px "${primaryFamily}"`);
    } catch (e) {
      console.warn("Failed to wait for font load", e);
    }
  }

  const { dpi = 600, scale, background = "transparent", filename = "graph-export.png", fontFamily } = options;

  const svgData = await prepareSvgForExport(svgNode, background, fontFamily);
  const width = svgNode.clientWidth || svgNode.getBoundingClientRect().width;
  const height = svgNode.clientHeight || svgNode.getBoundingClientRect().height;

  // Density relative to the 96 DPI CSS baseline, clamped so the canvas stays within engine limits.
  let s = scale ?? dpi / CSS_DPI;
  s = Math.min(s, MAX_CANVAS_DIM / Math.max(width, 1), MAX_CANVAS_DIM / Math.max(height, 1));

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * s);
  canvas.height = Math.round(height * s);

  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.scale(s, s);

  const img = new Image();
  img.onload = () => {
    ctx.drawImage(img, 0, 0);
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const tagged = await pngBlobWithDpi(blob, dpi);
      const url = URL.createObjectURL(tagged);
      downloadUrl(url, filename);
      URL.revokeObjectURL(url);
    }, "image/png");
  };
  img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
}

/**
 * Exports the SVG node to an SVG file and triggers a download.
 * SVG is resolution-independent; explicit width/height are set in prepareSvgForExport.
 */
export async function exportSVG(svgNode: SVGSVGElement, options: ExportOptions = {}) {
  const { background = "transparent", filename = "graph-export.svg", fontFamily } = options;

  const svgData = await prepareSvgForExport(svgNode, background, fontFamily);
  const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  downloadUrl(url, filename);
  URL.revokeObjectURL(url);
}
