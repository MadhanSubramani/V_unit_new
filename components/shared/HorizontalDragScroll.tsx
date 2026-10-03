"use client";

import { useEffect, useState } from "react";

const INTERACTIVE = "a, button, input, select, textarea, label, [role='menuitem']";
const DRAG_THRESHOLD = 6;

export default function HorizontalDragScroll({
  className,
  children,
  scrollRef,
}: {
  className?: string;
  children: React.ReactNode;
  scrollRef?: React.RefObject<HTMLDivElement | null>;
}) {
  const [node, setNode] = useState<HTMLDivElement | null>(null);

  const setRefs = (element: HTMLDivElement | null) => {
    if (scrollRef) {
      (scrollRef as React.MutableRefObject<HTMLDivElement | null>).current = element;
    }
    setNode(element);
  };

  useEffect(() => {
    const element = node;
    if (!element) return;

    let pointerId: number | null = null;
    let startX = 0;
    let startScroll = 0;
    let dragging = false;

    const release = () => {
      if (pointerId !== null && element.hasPointerCapture(pointerId)) {
        element.releasePointerCapture(pointerId);
      }
      pointerId = null;
      dragging = false;
      element.classList.remove("cursor-grabbing", "select-none");
      element.classList.add("cursor-grab");
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || event.button !== 0) return;
      const target = event.target;
      if (target instanceof Element && target.closest(INTERACTIVE)) return;
      if (element.scrollWidth <= element.clientWidth) return;

      pointerId = event.pointerId;
      startX = event.clientX;
      startScroll = element.scrollLeft;
      dragging = false;
    };

    const onPointerMove = (event: PointerEvent) => {
      if (pointerId === null || event.pointerId !== pointerId) return;
      const delta = event.clientX - startX;
      if (!dragging) {
        if (Math.abs(delta) < DRAG_THRESHOLD) return;
        dragging = true;
        element.setPointerCapture(event.pointerId);
        element.classList.remove("cursor-grab");
        element.classList.add("cursor-grabbing", "select-none");
      }
      event.preventDefault();
      element.scrollLeft = startScroll - delta;
    };

    const onPointerUp = (event: PointerEvent) => {
      if (pointerId === null || event.pointerId !== pointerId) return;
      const wasDragging = dragging;
      release();
      if (!wasDragging) return;
      const suppressClick = (clickEvent: MouseEvent) => {
        clickEvent.preventDefault();
        clickEvent.stopPropagation();
        element.removeEventListener("click", suppressClick, true);
      };
      element.addEventListener("click", suppressClick, true);
      window.setTimeout(() => {
        element.removeEventListener("click", suppressClick, true);
      }, 0);
    };

    element.classList.add("cursor-grab");
    element.addEventListener("pointerdown", onPointerDown);
    element.addEventListener("pointermove", onPointerMove);
    element.addEventListener("pointerup", onPointerUp);
    element.addEventListener("pointercancel", onPointerUp);

    return () => {
      release();
      element.classList.remove("cursor-grab", "cursor-grabbing", "select-none");
      element.removeEventListener("pointerdown", onPointerDown);
      element.removeEventListener("pointermove", onPointerMove);
      element.removeEventListener("pointerup", onPointerUp);
      element.removeEventListener("pointercancel", onPointerUp);
    };
  }, [node]);

  return (
    <div ref={setRefs} className={className}>
      {children}
    </div>
  );
}
