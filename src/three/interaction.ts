"use client";
import type { ThreeEvent } from "@react-three/fiber";

/** context-menu handler that removes an item (right click / long press) */
export function removeOnRightClick(fn: () => void) {
  return (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    e.nativeEvent.preventDefault();
    fn();
  };
}

export function setCursor(c: string) {
  if (typeof document !== "undefined") document.body.style.cursor = c;
}
