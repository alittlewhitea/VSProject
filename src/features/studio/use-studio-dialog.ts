"use client";

import { useEffect, useRef, type RefObject } from "react";

/** Keep focus in an open Studio dialog without resetting it on data updates. */
export function useStudioDialog(open: boolean, dialogRef: RefObject<HTMLElement | null>, {
  onClose, canClose = true, suspended = () => false, lockScroll = true
}: { onClose: () => void; canClose?: boolean; suspended?: () => boolean; lockScroll?: boolean }) {
  const latest = useRef({ onClose, canClose, suspended });
  latest.current = { onClose, canClose, suspended };
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    if (lockScroll) document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (document.querySelector("[data-auth-dialog]") && !dialogRef.current?.hasAttribute("data-auth-dialog")) return;
      if (latest.current.suspended()) return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      if (event.key === "Escape" && latest.current.canClose) {
        event.preventDefault();
        event.stopPropagation();
        latest.current.onClose();
      }
      if (event.key !== "Tab") return;
      const items = Array.from(dialog.querySelectorAll<HTMLElement>(
        'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]'
      )).filter(item => item.tabIndex >= 0 && item.getClientRects().length && !item.closest('[inert], [aria-hidden="true"]'));
      if (!items.length) { event.preventDefault(); dialog.focus(); return; }
      const first = items[0], last = items[items.length - 1];
      const outside = !dialog.contains(document.activeElement) || document.activeElement === dialog;
      if (event.shiftKey && (outside || document.activeElement === first)) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (outside || document.activeElement === last)) {
        event.preventDefault(); first.focus();
      }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      if (lockScroll) document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", keydown);
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [open, dialogRef, lockScroll]);
}
