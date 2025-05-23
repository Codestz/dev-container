import { useCallback, useState } from "react";
import type { SelectedElementInfo } from "../types";

export function useElementSelection() {
  const [selectedElements, setSelectedElements] = useState<
    SelectedElementInfo[]
  >([]);

  const clearSelection = useCallback(() => {
    setSelectedElements([]);
    window.parent.postMessage({ type: "SELECTIONS_CLEARED" }, "*");
  }, []);

  const addSelection = useCallback(
    (element: HTMLElement, elementId: string) => {
      setSelectedElements((prev) => {
        if (prev.some((info) => info.id === elementId)) {
          return prev;
        }

        let newElements = prev;
        // Limit to 3 selections, remove oldest if needed
        if (prev.length >= 3) {
          const [, ...rest] = prev;
          newElements = rest;
          window.parent.postMessage(
            { type: "ELEMENT_REMOVED", data: { id: prev[0].id } },
            "*"
          );
        }

        return [...newElements, { element, id: elementId }];
      });
    },
    []
  );

  const removeSelection = useCallback((elementId: string) => {
    setSelectedElements((prev) => {
      const removed = prev.find((info) => info.id === elementId);
      if (removed) {
        window.parent.postMessage(
          { type: "ELEMENT_REMOVED", data: { id: elementId } },
          "*"
        );
      }
      return prev.filter((info) => info.id !== elementId);
    });
  }, []);

  const toggleSelection = useCallback(
    (element: HTMLElement, elementId: string) => {
      setSelectedElements((prev) => {
        const existing = prev.find((info) => info.id === elementId);
        if (existing) {
          // Remove existing selection
          window.parent.postMessage(
            { type: "ELEMENT_REMOVED", data: { id: elementId } },
            "*"
          );
          return prev.filter((info) => info.id !== elementId);
        } else {
          // Add new selection
          let newElements = prev;
          if (prev.length >= 3) {
            const [, ...rest] = prev;
            newElements = rest;
            window.parent.postMessage(
              { type: "ELEMENT_REMOVED", data: { id: prev[0].id } },
              "*"
            );
          }
          return [...newElements, { element, id: elementId }];
        }
      });
    },
    []
  );

  return {
    selectedElements,
    clearSelection,
    addSelection,
    removeSelection,
    toggleSelection,
  };
}
