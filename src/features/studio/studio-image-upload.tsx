"use client";

import { useRef, useState, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { StudioIcon } from "./studio-navigation";
import styles from "./studio-image-upload.module.css";

type ImageUploadInputProps = Pick<ComponentPropsWithoutRef<"input">, "id" | "accept" | "multiple" | "aria-label"> &
  Partial<Record<`data-${string}`, string>>;

type ImageUploadProps = {
  label: string;
  hint?: string;
  compact?: boolean;
  disabled?: boolean;
  inputProps?: ImageUploadInputProps;
  onFiles: (files: FileList) => void | Promise<void>;
};

export function StudioImageUpload({ label, hint, compact, disabled, inputProps, onFiles }: ImageUploadProps) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  return (
    <div
      className={styles.upload}
      data-compact={compact || undefined}
      data-dragging={dragging && !disabled ? true : undefined}
      onDragOver={event => {
        if (!event.dataTransfer.types.includes("Files")) return;
        event.preventDefault();
        event.stopPropagation();
        const canDrop = !input.current?.matches(":disabled");
        event.dataTransfer.dropEffect = canDrop ? "copy" : "none";
        if (canDrop) setDragging(true);
      }}
      onDragLeave={event => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={event => {
        event.preventDefault();
        event.stopPropagation();
        setDragging(false);
        if (!input.current?.matches(":disabled") && event.dataTransfer.files.length) void onFiles(event.dataTransfer.files);
      }}
    >
      <button type="button" className={styles.trigger} data-upload-reference disabled={disabled} onClick={() => input.current?.click()}>
        <span className={styles.icon}><StudioIcon name="upload" /></span>
        <span className={styles.text}>
          <strong>{label}</strong>
          {hint ? <span>{hint}</span> : null}
        </span>
      </button>
      <input
        {...inputProps}
        ref={input}
        type="file"
        hidden
        disabled={disabled}
        aria-label={inputProps?.["aria-label"] ?? label}
        onChange={event => {
          const files = event.currentTarget.files;
          if (!event.currentTarget.matches(":disabled") && files?.length) void onFiles(files);
          event.currentTarget.value = "";
        }}
      />
    </div>
  );
}

export function StudioImagePreview({ src, alt, caption, removeLabel, onRemove, disabled, className, children, index }: {
  src: string;
  alt: string;
  caption?: string;
  removeLabel: string;
  onRemove: () => void;
  disabled?: boolean;
  className?: string;
  children?: ReactNode;
  index?: number;
}) {
  return (
    <figure data-upload-preview data-reference-index={index} className={className ? `${styles.preview} ${className}` : styles.preview}>
      {children ?? <img src={src} alt={alt} />}
      {caption ? <figcaption className={styles.caption}>{caption}</figcaption> : null}
      <button type="button" data-remove-reference={index ?? ""} className={styles.remove} disabled={disabled} aria-label={removeLabel} onClick={onRemove}>
        <StudioIcon name="x" />
      </button>
    </figure>
  );
}
