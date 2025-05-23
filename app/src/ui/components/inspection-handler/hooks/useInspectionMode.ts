import { useCallback, useEffect, useRef, useState } from "react";
import type { SelectedElementInfo } from "../types";
import { getElementMetrics, textToColor } from "../utils";

export function useInspectionMode(selectedElements: SelectedElementInfo[]) {
  const [isInspecting, setIsInspecting] = useState(false);
  const labelRef = useRef<HTMLDivElement | null>(null);
  const hoverGuideRef = useRef<HTMLDivElement | null>(null);
  const selectedGuidesRef = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    const label = document.createElement("div");
    label.style.cssText = `
      position: fixed;
      z-index: 99999;
      background: #646cff;
      color: white;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      pointer-events: none;
      display: none;
      font-weight: 500;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      transition: transform 0.1s ease-out;
    `;
    document.body.appendChild(label);
    labelRef.current = label;

    return () => {
      if (document.body.contains(label)) {
        document.body.removeChild(label);
      }
    };
  }, []);

  const showElementGuides = useCallback((element: HTMLElement) => {
    const metrics = getElementMetrics(element);
    const PADDING = 2;
    const guide = document.createElement("div");

    guide.style.cssText = `
      position: fixed;
      border: 1px dashed rgba(100, 108, 255, 0.5);
      background: rgba(100, 108, 255, 0.1);
      pointer-events: none;
      z-index: 99998;
      width: ${metrics.width + PADDING * 2}px;
      height: ${metrics.height + PADDING * 2}px;
      left: ${metrics.x - PADDING}px;
      top: ${metrics.y - PADDING}px;
      border-radius: 4px;
    `;
    document.body.appendChild(guide);
    return guide;
  }, []);

  const createSelectedElementGuide = useCallback(
    (element: HTMLElement, elementId: string) => {
      const metrics = getElementMetrics(element);
      const PADDING = 2;
      const color = textToColor(elementId);
      const guide = document.createElement("div");

      guide.style.cssText = `
      position: fixed;
      border: 2px solid ${color};
      background: ${color}20;
      pointer-events: none;
      z-index: 99997;
      width: ${metrics.width + PADDING * 2}px;
      height: ${metrics.height + PADDING * 2}px;
      left: ${metrics.x - PADDING}px;
      top: ${metrics.y - PADDING}px;
      border-radius: 4px;
    `;

      // Create close button
      const closeBtn = document.createElement("button");
      closeBtn.className = "inspection-close-btn";
      closeBtn.setAttribute("data-element-id", elementId);
      closeBtn.style.cssText = `
      position: absolute;
      top: -8px;
      right: -8px;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      border: none;
      background: ${color};
      color: white;
      font-size: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      pointer-events: auto;
      font-weight: bold;
      z-index: 99998;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    `;
      closeBtn.innerHTML = "×";
      closeBtn.title = "Remove selection";

      guide.appendChild(closeBtn);
      document.body.appendChild(guide);
      return guide;
    },
    []
  );

  // Update selected element guides when selectedElements changes
  useEffect(() => {
    const guidesMap = selectedGuidesRef.current;
    const currentIds = new Set(selectedElements.map((info) => info.id));

    // Remove guides for deselected elements
    for (const [id, guide] of guidesMap.entries()) {
      if (!currentIds.has(id)) {
        if (document.body.contains(guide)) {
          document.body.removeChild(guide);
        }
        guidesMap.delete(id);
      }
    }

    // Add guides for newly selected elements
    for (const { element, id } of selectedElements) {
      if (!guidesMap.has(id)) {
        const guide = createSelectedElementGuide(element, id);
        guidesMap.set(id, guide);
      }
    }
  }, [selectedElements, createSelectedElementGuide]);

  // Clean up guides when inspection stops
  useEffect(() => {
    if (!isInspecting) {
      const guidesMap = selectedGuidesRef.current;
      for (const guide of guidesMap.values()) {
        if (document.body.contains(guide)) {
          document.body.removeChild(guide);
        }
      }
      guidesMap.clear();
    }
  }, [isInspecting]);

  // Handle window resize to update guide positions
  useEffect(() => {
    const handleResize = () => {
      const guidesMap = selectedGuidesRef.current;
      for (const { element, id } of selectedElements) {
        const guide = guidesMap.get(id);
        if (guide) {
          const metrics = getElementMetrics(element);
          const PADDING = 2;
          guide.style.width = `${metrics.width + PADDING * 2}px`;
          guide.style.height = `${metrics.height + PADDING * 2}px`;
          guide.style.left = `${metrics.x - PADDING}px`;
          guide.style.top = `${metrics.y - PADDING}px`;
        }
      }
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleResize);
    };
  }, [selectedElements]);

  return {
    isInspecting,
    setIsInspecting,
    labelRef,
    hoverGuideRef,
    showElementGuides,
  };
}
