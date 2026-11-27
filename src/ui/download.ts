"use client";

/**
 * Save a file from the page. iPhone/iPad Safari ignores `<a download>` for
 * generated files, so where the browser can share files the system share sheet
 * is opened (Save Image / Save to Files / AirDrop…); otherwise a normal download.
 */
export async function saveFile(blob: Blob, name: string) {
  const file = new File([blob], name, { type: blob.type });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  const touch = window.matchMedia?.("(pointer: coarse)").matches;
  if (touch && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: name });
      return;
    } catch (e) {
      if ((e as DOMException)?.name === "AbortError") return; // the user closed the sheet
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function canvasBlob(c: HTMLCanvasElement): Promise<Blob> {
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("toBlob failed"))), "image/png"));
}
