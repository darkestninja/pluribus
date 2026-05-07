declare global { interface Window { cv: any; Module: any } }

// Pinned to a specific release — never use floating aliases like "4.x" or "@master"
const OPENCV_URL = "https://docs.opencv.org/4.10.0/opencv.js";
const CASCADE_URL =
  "https://cdn.jsdelivr.net/gh/opencv/opencv@4.10.0/data/haarcascades/haarcascade_frontalface_default.xml";
const FACE_SIZE = 64;
const OPENCV_TIMEOUT_MS = 12_000;

let cv: any = null;
let classifier: any = null;
let loadPromise: Promise<void> | null = null;
let opencvFailed = false;

const refCache = new Map<string, Float32Array>();

// ── OpenCV path ────────────────────────────────────────────────────────────

function initOpenCV(): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      opencvFailed = true;
      reject(new Error("opencv.js load timeout"));
    }, OPENCV_TIMEOUT_MS);

    window.Module = {
      onRuntimeInitialized() {
        clearTimeout(timer);
        cv = window.cv;
        resolve();
      },
    };
    const s = document.createElement("script");
    s.src = OPENCV_URL;
    s.async = true;
    s.onerror = () => { clearTimeout(timer); opencvFailed = true; reject(new Error("opencv.js load failed")); };
    document.head.appendChild(s);
  });
}

async function ensureOpenCV(): Promise<void> {
  if (opencvFailed) throw new Error("opencv unavailable");
  if (cv?.CascadeClassifier) return;
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    await initOpenCV();
    const resp = await fetch(CASCADE_URL);
    if (!resp.ok) throw new Error("cascade fetch failed");
    const data = new Uint8Array(await resp.arrayBuffer());
    cv.FS_createDataFile("/", "face.xml", data, true, false, false);
    classifier = new cv.CascadeClassifier();
    classifier.load("face.xml");
  })();
  return loadPromise;
}

async function urlToMat(url: string): Promise<any> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext("2d")!.drawImage(img, 0, 0);
      res(cv.matFromImageData(
        canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height),
      ));
    };
    img.onerror = rej;
    img.src = url;
  });
}

function detectFace(mat: any): any | null {
  const gray = new cv.Mat();
  cv.cvtColor(mat, gray, cv.COLOR_RGBA2GRAY);
  cv.equalizeHist(gray, gray);

  const faces = new cv.RectVector();
  classifier.detectMultiScale(gray, faces, 1.1, 3, 0, new cv.Size(30, 30), new cv.Size(0, 0));
  gray.delete();

  if (faces.size() === 0) { faces.delete(); return null; }

  let best = faces.get(0);
  for (let i = 1; i < faces.size(); i++) {
    const f = faces.get(i);
    if (f.width * f.height > best.width * best.height) best = f;
  }

  const cropped = mat.roi(best);
  const out = new cv.Mat();
  cv.resize(cropped, out, new cv.Size(FACE_SIZE, FACE_SIZE));
  cropped.delete();
  faces.delete();
  return out;
}

function grayHist(mat: any): Float32Array {
  const g = new cv.Mat();
  cv.cvtColor(mat, g, cv.COLOR_RGBA2GRAY);
  const bins = new Float32Array(256).fill(0);
  const d: Uint8Array = g.data;
  for (let i = 0; i < d.length; i++) bins[d[i]]++;
  const n = d.length || 1;
  for (let i = 0; i < 256; i++) bins[i] /= n;
  g.delete();
  return bins;
}

// ── Canvas fallback path ───────────────────────────────────────────────────
// Used when OpenCV fails to load. Scales both images to 64×64, builds a
// grayscale histogram, and computes Pearson correlation.

async function urlToGrayscaleHistCanvas(url: string): Promise<Float32Array> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = FACE_SIZE;
      canvas.height = FACE_SIZE;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, FACE_SIZE, FACE_SIZE);
      const { data } = ctx.getImageData(0, 0, FACE_SIZE, FACE_SIZE);
      const bins = new Float32Array(256).fill(0);
      const pixels = FACE_SIZE * FACE_SIZE;
      for (let i = 0; i < data.length; i += 4) {
        const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
        bins[gray]++;
      }
      for (let i = 0; i < 256; i++) bins[i] /= pixels;
      resolve(bins);
    };
    img.onerror = reject;
    img.src = url;
  });
}

// ── Pearson correlation ────────────────────────────────────────────────────

function correlation(h1: Float32Array, h2: Float32Array): number {
  let m1 = 0, m2 = 0;
  for (let i = 0; i < 256; i++) { m1 += h1[i]; m2 += h2[i]; }
  m1 /= 256; m2 /= 256;
  let cov = 0, v1 = 0, v2 = 0;
  for (let i = 0; i < 256; i++) {
    const a = h1[i] - m1, b = h2[i] - m2;
    cov += a * b; v1 += a * a; v2 += b * b;
  }
  const d = Math.sqrt(v1 * v2);
  return d === 0 ? 0 : cov / d;
}

// ── OpenCV histogram path ──────────────────────────────────────────────────

async function getHistogramOpenCV(url: string, cache: boolean): Promise<Float32Array | null> {
  if (cache && refCache.has(url)) return refCache.get(url)!;
  const mat = await urlToMat(url);
  const face = detectFace(mat);
  mat.delete();
  if (!face) {
    // Fall back to full-image histogram when no face detected
    const mat2 = await urlToMat(url);
    const hist = grayHist(mat2);
    mat2.delete();
    if (cache) refCache.set(url, hist);
    return hist;
  }
  const hist = grayHist(face);
  face.delete();
  if (cache) refCache.set(url, hist);
  return hist;
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Returns a 0–100 visual resemblance score between two image URLs.
 * Uses OpenCV face detection + histogram correlation when available,
 * falls back to a simple full-image histogram correlation via Canvas API.
 */
export async function computeResemblanceScore(
  referenceUrl: string,
  generatedUrl: string,
): Promise<number | null> {
  try {
    // Try OpenCV path first
    if (!opencvFailed) {
      try {
        await ensureOpenCV();
        const [ref, gen] = await Promise.all([
          getHistogramOpenCV(referenceUrl, true),
          getHistogramOpenCV(generatedUrl, false),
        ]);
        if (ref && gen) {
          const corr = correlation(ref, gen);
          return Math.round(((corr + 1) / 2) * 100);
        }
      } catch {
        opencvFailed = true;
      }
    }

    // Canvas fallback
    const [ref, gen] = await Promise.all([
      urlToGrayscaleHistCanvas(referenceUrl),
      urlToGrayscaleHistCanvas(generatedUrl),
    ]);
    const corr = correlation(ref, gen);
    // Apply a small boost since histogram similarity without face crop tends to
    // read lower than face-cropped similarity.
    return Math.min(100, Math.round(((corr + 1) / 2) * 100 + 5));
  } catch {
    return null;
  }
}

export function clearRefCache(url?: string) {
  if (url) refCache.delete(url);
  else refCache.clear();
}
