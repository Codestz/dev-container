import { useCallback, useEffect } from "react";
import type { ElementData, SelectedElementInfo } from "../types";
import { getElementMetrics, textToColor, throttle } from "../utils";

export function useInspectionEventHandlers(
  isInspecting: boolean,
  selectedElements: SelectedElementInfo[],
  labelRef: React.MutableRefObject<HTMLDivElement | null>,
  hoverGuideRef: React.MutableRefObject<HTMLDivElement | null>,
  showElementGuides: (element: HTMLElement) => HTMLDivElement,
  toggleSelection: (element: HTMLElement, elementId: string) => void,
  addSelection: (element: HTMLElement, elementId: string) => void,
  clearSelection: () => void
) {
  const extractElementData = useCallback(
    (element: HTMLElement): ElementData => {
      return {
        id: element.getAttribute("data-archie-id") || "",
        name: element.getAttribute("data-archie-name") || "",
        path: element.getAttribute("data-component-path") || "",
        line: parseInt(element.getAttribute("data-component-line") || "0", 10),
        file: element.getAttribute("data-component-file") || "",
        lineStart: parseInt(element.getAttribute("data-line-start") || "0", 10),
        lineEnd: parseInt(element.getAttribute("data-line-end") || "0", 10),
        colStart: parseInt(element.getAttribute("data-col-start") || "0", 10),
        colEnd: parseInt(element.getAttribute("data-col-end") || "0", 10),
      };
    },
    []
  );

  // Create a Set of selected element IDs for O(1) lookup
  const selectedElementIds = new Set(selectedElements.map((info) => info.id));

  useEffect(() => {
    if (!isInspecting) {
      clearSelection();
      if (labelRef.current) {
        labelRef.current.style.display = "none";
      }
      if (
        hoverGuideRef.current &&
        document.body.contains(hoverGuideRef.current)
      ) {
        document.body.removeChild(hoverGuideRef.current);
        hoverGuideRef.current = null;
      }
      return;
    }

    const handleMouseOver = (event: MouseEvent) => {
      const target = event.target as HTMLElement;

      // Check if click is on a close button
      if (target.closest(".inspection-close-btn")) {
        return;
      }

      const inspectableElement = target.closest(
        "[data-archie-id]"
      ) as HTMLElement;

      if (
        !inspectableElement ||
        selectedElements.some(({ element }) => element === inspectableElement)
      ) {
        return;
      }

      if (
        hoverGuideRef.current &&
        document.body.contains(hoverGuideRef.current)
      ) {
        document.body.removeChild(hoverGuideRef.current);
      }
      hoverGuideRef.current = showElementGuides(inspectableElement);

      if (labelRef.current) {
        const name = inspectableElement.getAttribute("data-archie-name") || "";
        const metrics = getElementMetrics(inspectableElement);
        labelRef.current.textContent = `${name} - ${metrics.width}x${metrics.height}`;
        labelRef.current.style.display = "block";

        const rect = inspectableElement.getBoundingClientRect();
        labelRef.current.style.top = `${rect.top - 22}px`;
        labelRef.current.style.left = `${rect.left - 2}px`;
      }

      const elementData = extractElementData(inspectableElement);
      window.parent.postMessage(
        {
          type: "ELEMENT_INSPECTED",
          data: {
            ...elementData,
            metrics: getElementMetrics(inspectableElement),
          },
        },
        "*"
      );
    };

    const handleMouseOut = () => {
      if (
        hoverGuideRef.current &&
        document.body.contains(hoverGuideRef.current)
      ) {
        document.body.removeChild(hoverGuideRef.current);
        hoverGuideRef.current = null;
      }
      if (labelRef.current) {
        labelRef.current.style.display = "none";
      }
    };

    const throttledMouseMove = throttle((event: MouseEvent) => {
      if (labelRef.current && labelRef.current.style.display === "block") {
        labelRef.current.style.left = `${event.clientX + 10}px`;
        labelRef.current.style.top = `${event.clientY + 10}px`;
      }
    }, 16);

    const handleClick = (event: MouseEvent) => {
      // Always prevent default behavior during inspection
      event.preventDefault();
      event.stopPropagation();

      const target = event.target as HTMLElement;

      // Handle close button clicks
      if (target.closest(".inspection-close-btn")) {
        const closeBtn = target.closest(".inspection-close-btn") as HTMLElement;
        const elementId = closeBtn.getAttribute("data-element-id");
        if (elementId) {
          const selectedInfo = selectedElements.find(
            (info) => info.id === elementId
          );
          if (selectedInfo) {
            toggleSelection(selectedInfo.element, elementId);
            window.parent.postMessage(
              {
                type: "ELEMENT_DESELECTED",
                data: { id: elementId },
              },
              "*"
            );
          }
        }
        return;
      }

      const inspectableElement = target.closest(
        "[data-archie-id]"
      ) as HTMLElement;

      if (!inspectableElement) return;

      const elementId = inspectableElement.getAttribute("data-archie-id") || "";
      toggleSelection(inspectableElement, elementId);

      if (!selectedElementIds.has(elementId)) {
        const elementData = extractElementData(inspectableElement);
        window.parent.postMessage(
          {
            type: "ELEMENT_SELECTED",
            data: {
              ...elementData,
              metrics: getElementMetrics(inspectableElement),
              color: textToColor(elementId),
            },
          },
          "*"
        );
      } else {
        window.parent.postMessage(
          {
            type: "ELEMENT_DESELECTED",
            data: { id: elementId },
          },
          "*"
        );
      }
    };

    const handleDoubleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const currentElement = target.closest("[data-archie-id]") as HTMLElement;

      if (!currentElement) return;

      const firstChild = currentElement.querySelector(
        "[data-archie-id]"
      ) as HTMLElement;
      if (firstChild) {
        event.preventDefault();
        event.stopPropagation();

        const elementId = firstChild.getAttribute("data-archie-id") || "";
        addSelection(firstChild, elementId);

        const elementData = extractElementData(firstChild);
        window.parent.postMessage(
          {
            type: "ELEMENT_SELECTED",
            data: {
              ...elementData,
              metrics: getElementMetrics(firstChild),
              color: textToColor(elementId),
            },
          },
          "*"
        );
      }
    };

    // Prevent all form submissions and link navigations during inspection
    const handleFormSubmit = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      // Prevent enter key from triggering button clicks, etc.
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    document.addEventListener("mouseover", handleMouseOver);
    document.addEventListener("mouseout", handleMouseOut);
    document.addEventListener("mousemove", throttledMouseMove);
    document.addEventListener("pointerdown", handleClick, true);
    document.addEventListener("dblclick", handleDoubleClick);
    document.addEventListener("submit", handleFormSubmit, true);
    document.addEventListener("keydown", handleKeyDown, true);

    return () => {
      document.removeEventListener("mouseover", handleMouseOver);
      document.removeEventListener("mouseout", handleMouseOut);
      document.removeEventListener("mousemove", throttledMouseMove);
      document.removeEventListener("pointerdown", handleClick, true);
      document.removeEventListener("dblclick", handleDoubleClick);
      document.removeEventListener("submit", handleFormSubmit, true);
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [
    isInspecting,
    selectedElementIds.size, // Only depend on the count, not the full array
    showElementGuides,
    toggleSelection,
    addSelection,
    clearSelection,
    extractElementData,
  ]);

  // Notify parent when inspection starts
  useEffect(() => {
    if (isInspecting) {
      window.parent.postMessage({ type: "INSPECTION_ACTIVE" }, "*");
    }
  }, [isInspecting]);
}
