import type { ScreenshotSelection } from "@/hooks/useScreenshotPicker";

export interface ScreenshotUploaderProps {
  readonly selections: ReadonlyArray<ScreenshotSelection>;
  readonly error: string | null;
  readonly onPickGallery: () => void;
  readonly onPickCamera: () => void;
  readonly onRemove: (id: string) => void;
  readonly disabled?: boolean;
}
