"use client";

import { CameraIcon, ImageIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { MAX_SCREENSHOT_COUNT } from "@/lib/screenshot-constants";
import { cn } from "@/lib/utils";

import type { ScreenshotUploaderProps } from "./types";

// =============================================================================
// ScreenshotUploader — attach broker screenshots for Deep analysis (multi).
// =============================================================================

export function ScreenshotUploader({
  selections,
  error,
  onPickGallery,
  onPickCamera,
  onRemove,
  disabled,
}: ScreenshotUploaderProps) {
  const atCap = selections.length >= MAX_SCREENSHOT_COUNT;

  return (
    <div className="flex w-full flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-foreground">
          Trade screenshots
        </span>
        <span className="text-[10px] text-muted-foreground">
          {selections.length}/{MAX_SCREENSHOT_COUNT}
        </span>
      </div>

      {selections.length > 0 ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {selections.map((s, index) => (
            <div
              key={s.id}
              className="relative overflow-hidden rounded-lg border border-border/80 bg-muted/20"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- blob preview */}
              <img
                src={s.previewUrl}
                alt={`Screenshot ${index + 1}`}
                className="aspect-video w-full object-cover"
              />
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="absolute right-1.5 top-1.5 h-7 w-7 rounded-full bg-background/90 shadow"
                onClick={() => onRemove(s.id)}
                disabled={disabled}
                aria-label={`Remove screenshot ${index + 1}`}
              >
                <XIcon className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      ) : null}

      <div
        className={cn(
          "flex flex-col items-center gap-2 rounded-xl border border-dashed border-brand/30 bg-brand/5 px-4 py-4",
        )}
      >
        <p className="text-center text-xs leading-relaxed text-muted-foreground">
          Add one or more broker or chart images so Deep analysis can read
          prices, direction, and P&amp;L.
        </p>
        <div className="flex w-full flex-wrap justify-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onPickGallery}
            disabled={disabled || atCap}
            className="gap-1.5 border-brand/30"
          >
            <ImageIcon className="h-3.5 w-3.5" />
            Gallery
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onPickCamera}
            disabled={disabled || atCap}
            className="gap-1.5 border-brand/30"
          >
            <CameraIcon className="h-3.5 w-3.5" />
            Camera
          </Button>
        </div>
      </div>

      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

export type { ScreenshotUploaderProps } from "./types";
