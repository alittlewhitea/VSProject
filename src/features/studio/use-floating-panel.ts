"use client";

import { useEffect, type Dispatch, type RefObject, type SetStateAction } from "react";

export type FloatingPanelPlacement = "top" | "bottom" | "modal";

function getPlacement(element: HTMLElement | null): FloatingPanelPlacement {
  if (typeof window === "undefined") return "bottom";
  if (window.innerWidth < 640) return "modal";
  if (!element) return "bottom";

  const rect = element.getBoundingClientRect();
  const spaceBelow = window.innerHeight - rect.bottom;
  const spaceAbove = rect.top;
  return spaceBelow >= 430 || spaceBelow >= spaceAbove ? "bottom" : "top";
}

export function useFloatingPanel({
  open,
  triggerRef,
  panelRef,
  setOpen,
  onPlacementChange
}: {
  open: boolean;
  triggerRef: RefObject<HTMLElement | null>;
  panelRef: RefObject<HTMLElement | null>;
  setOpen: Dispatch<SetStateAction<boolean>>;
  onPlacementChange: (placement: FloatingPanelPlacement) => void;
}) {
  useEffect(() => {
    if (!open) return;

    const updatePlacement = () => onPlacementChange(getPlacement(triggerRef.current));
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (triggerRef.current?.contains(event.target as Node)) return;
      if (panelRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };

    updatePlacement();
    window.addEventListener("resize", updatePlacement);
    window.addEventListener("scroll", updatePlacement, true);
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    return () => {
      window.removeEventListener("resize", updatePlacement);
      window.removeEventListener("scroll", updatePlacement, true);
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [onPlacementChange, open, panelRef, setOpen, triggerRef]);
}
