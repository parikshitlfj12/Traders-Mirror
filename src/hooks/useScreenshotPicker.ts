"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  MAX_SCREENSHOT_BYTES,
  MAX_SCREENSHOT_COUNT,
} from "@/lib/screenshot-constants";

// =============================================================================
// useScreenshotPicker — multi-image broker screenshot selection for Deep mode.
// =============================================================================

export interface ScreenshotSelection {
  readonly id: string;
  readonly file: File;
  readonly previewUrl: string;
  readonly mimeType: string;
}

export interface UseScreenshotPickerResult {
  readonly selections: ReadonlyArray<ScreenshotSelection>;
  readonly error: string | null;
  readonly pickFromGallery: () => void;
  readonly pickFromCamera: () => void;
  readonly remove: (id: string) => void;
  readonly clear: () => void;
}

let nextId = 0;
function makeId(): string {
  nextId += 1;
  return `ss-${nextId}`;
}

export function useScreenshotPicker(): UseScreenshotPickerResult {
  const [selections, setSelections] = useState<ScreenshotSelection[]>([]);
  const [error, setError] = useState<string | null>(null);
  const galleryRef = useRef<HTMLInputElement | null>(null);
  const cameraRef = useRef<HTMLInputElement | null>(null);

  const revokeAll = useCallback((items: ReadonlyArray<ScreenshotSelection>) => {
    for (const s of items) URL.revokeObjectURL(s.previewUrl);
  }, []);

  const clear = useCallback(() => {
    setSelections((prev) => {
      revokeAll(prev);
      return [];
    });
    setError(null);
    if (galleryRef.current) galleryRef.current.value = "";
    if (cameraRef.current) cameraRef.current.value = "";
  }, [revokeAll]);

  const addFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      setError(null);
      setSelections((prev) => {
        const next = [...prev];
        for (const file of Array.from(files)) {
          if (next.length >= MAX_SCREENSHOT_COUNT) {
            setError(`You can attach up to ${MAX_SCREENSHOT_COUNT} images.`);
            break;
          }
          if (!file.type.startsWith("image/")) {
            setError("Please choose image files only.");
            continue;
          }
          if (file.size > MAX_SCREENSHOT_BYTES) {
            setError("Each image must be under 8 MB.");
            continue;
          }
          next.push({
            id: makeId(),
            file,
            previewUrl: URL.createObjectURL(file),
            mimeType: file.type || "image/png",
          });
        }
        return next;
      });
    },
    [],
  );

  const remove = useCallback((id: string) => {
    setSelections((prev) => {
      const target = prev.find((s) => s.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((s) => s.id !== id);
    });
    setError(null);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const gallery = document.createElement("input");
    gallery.type = "file";
    gallery.accept = "image/jpeg,image/png,image/webp";
    gallery.multiple = true;
    gallery.className = "hidden";
    gallery.setAttribute("aria-hidden", "true");
    gallery.addEventListener("change", () => {
      addFiles(gallery.files);
      gallery.value = "";
    });

    const camera = document.createElement("input");
    camera.type = "file";
    camera.accept = "image/*";
    camera.capture = "environment";
    camera.className = "hidden";
    camera.setAttribute("aria-hidden", "true");
    camera.addEventListener("change", () => {
      addFiles(camera.files);
      camera.value = "";
    });

    document.body.appendChild(gallery);
    document.body.appendChild(camera);
    galleryRef.current = gallery;
    cameraRef.current = camera;

    return () => {
      gallery.remove();
      camera.remove();
    };
  }, [addFiles]);

  useEffect(() => {
    return () => revokeAll(selections);
  }, [selections, revokeAll]);

  const pickFromGallery = useCallback(() => {
    galleryRef.current?.click();
  }, []);

  const pickFromCamera = useCallback(() => {
    cameraRef.current?.click();
  }, []);

  return {
    selections,
    error,
    pickFromGallery,
    pickFromCamera,
    remove,
    clear,
  };
}
