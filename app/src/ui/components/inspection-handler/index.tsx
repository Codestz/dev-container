/**
 * @file InspectionHandler Component
 *
 * This component provides an interactive inspection system for React applications,
 * allowing real-time element inspection, navigation tracking, and parent-iframe communication.
 *
 * Key Features:
 * - Element inspection with visual guides
 * - Navigation state management
 * - Route information extraction
 * - Cross-window communication
 * - Smooth navigation handling
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

interface ElementData {
  /** Unique identifier for the element */
  id: string;
  /** Display name of the component */
  name: string;
  /** Component file path */
  path: string;
  /** Line number in source file */
  line: number;
  /** Source file name */
  file: string;
  /** Starting line in source */
  lineStart: number;
  /** Ending line in source */
  lineEnd: number;
  /** Starting column in source */
  colStart: number;
  /** Ending column in source */
  colEnd: number;
}

interface ElementMetrics {
  /** Element width in pixels */
  width: number;
  /** Element height in pixels */
  height: number;
  /** X coordinate relative to viewport */
  x: number;
  /** Y coordinate relative to viewport */
  y: number;
}

interface SelectedElementInfo {
  element: HTMLElement;
  guide: HTMLDivElement;
  color: string;
  id: string;
}

/**
 * Converts text to a deterministic color
 * @param str - Input string to generate color from
 * @param s - Saturation value (0-100)
 * @param l - Lightness value (0-100)
 * @returns Hex color code
 */
export function textToColor(str: string, s: number = 70, l: number = 50) {
  let hash = 0;

  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }

  const h = hash % 360;
  return hslToHex(h, s, l);
}

/**
 * Converts HSL color values to hex color code
 * @param h - Hue (0-360)
 * @param s - Saturation (0-100)
 * @param l - Lightness (0-100)
 * @returns Hex color code
 */
function hslToHex(h: number, s: number, l: number) {
  l /= 100;
  const a = (s * Math.min(l, 1 - l)) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/**
 * Gets the bounding metrics of an HTML element
 * @param element - Target HTML element
 * @returns ElementMetrics object with rounded dimensions
 */
const getElementMetrics = (element: HTMLElement): ElementMetrics => {
  const rect = element.getBoundingClientRect();
  return {
    width: Math.round(rect.width),
    height: Math.round(rect.height),
    x: Math.round(rect.left),
    y: Math.round(rect.top),
  };
};

/**
 * Throttle function to limit the rate of execution
 * @param func - Function to throttle
 * @param limit - Time limit in milliseconds
 */
const throttle = (func: Function, limit: number) => {
  let inThrottle: boolean;
  return function (this: any, ...args: any[]) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};

/**
 * Creates and displays a visual guide around an element
 * @param element - Target HTML element
 * @param color - Color for the guide border and background
 * @returns Guide element
 */
const showElementGuides = (
  element: HTMLElement,
  color: string = "rgba(100, 108, 255, 0.5)"
) => {
  const metrics = getElementMetrics(element);
  const PADDING = 2; // Small padding in pixels
  const guide = document.createElement("div");
  const bgColor = color.replace(/^#/, "");

  guide.style.cssText = `
    position: fixed;
    border: 1px dashed ${color};
    background: #${bgColor}1A;
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
};

/**
 * InspectionHandler Component
 *
 * This component manages the inspection system and provides the following functionality:
 * 1. Element Inspection:
 *    - Visual guides for hovered and selected elements
 *    - Element information extraction
 *    - Click interception for interactive elements
 *
 * 2. Navigation Management:
 *    - Intercepts and handles internal navigation
 *    - Maintains navigation state
 *    - Prevents page reloads during navigation
 *
 * 3. Parent Window Communication:
 *    - Reports navigation state changes
 *    - Sends element selection data
 *    - Handles incoming commands
 *
 * 4. Route Management:
 *    - Extracts and reports available routes
 *    - Tracks current route information
 *
 * Message Types:
 * - TOGGLE_INSPECTION: Enable/disable inspection mode
 * - CLEAR_SELECTION: Clear current element selection
 * - NAVIGATION_ACTION: Handle navigation commands
 * - REQUEST_CURRENT_URL: Get current URL information
 * - ROUTES_AVAILABLE: Report available routes
 * - URL_CHANGED: Notify URL changes
 * - NAVIGATION_STATE: Report navigation state
 * - ELEMENT_SELECTED: Report selected element data
 * - INSPECTION_ACTIVE: Notify inspection mode status
 */
export function InspectionHandler() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isInspecting, setIsInspecting] = useState(false);
  const [selectedElements, setSelectedElements] = useState<
    SelectedElementInfo[]
  >([]);
  const labelRef = useRef<HTMLDivElement>(null);
  const hoverGuideRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);

  // Function to update guide position and size
  const updateGuidePosition = useCallback(
    (element: HTMLElement, guide: HTMLElement) => {
      const metrics = getElementMetrics(element);
      const PADDING = 2;
      guide.style.width = `${metrics.width + PADDING * 2}px`;
      guide.style.height = `${metrics.height + PADDING * 2}px`;
      guide.style.left = `${metrics.x - PADDING}px`;
      guide.style.top = `${metrics.y - PADDING}px`;
    },
    []
  );

  /**
   * Updates guide position for selected elements
   * Uses requestAnimationFrame for smooth updates
   */
  useEffect(() => {
    if (selectedElements.length === 0) return;

    const updatePositions = () => {
      selectedElements.forEach((info) => {
        updateGuidePosition(info.element, info.guide);
      });
      rafRef.current = requestAnimationFrame(updatePositions);
    };

    rafRef.current = requestAnimationFrame(updatePositions);

    const handleScroll = () => {
      selectedElements.forEach((info) => {
        updateGuidePosition(info.element, info.guide);
      });
    };

    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleScroll, true);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleScroll, true);
    };
  }, [selectedElements, updateGuidePosition]);

  useEffect(() => {
    // Create label element for hover
    const label = document.createElement("div");
    label.style.position = "fixed";
    label.style.zIndex = "99999";
    label.style.background = "#646cff";
    label.style.color = "white";
    label.style.padding = "4px 8px";
    label.style.borderRadius = "4px";
    label.style.fontSize = "12px";
    label.style.pointerEvents = "none";
    label.style.display = "none";
    label.style.fontWeight = "500";
    label.style.boxShadow = "0 2px 6px rgba(0,0,0,0.3)";
    label.style.transition = "transform 0.1s ease-out";
    document.body.appendChild(label);

    // @ts-expect-error - current is read-only
    labelRef.current = label;

    return () => {
      document.body.removeChild(label);
    };
  }, []);

  /**
   * Clears all selected elements and their guides
   */
  const clearSelection = useCallback(() => {
    // Remove all guides and clear selections
    selectedElements.forEach((info) => {
      document.body.removeChild(info.guide);
    });
    setSelectedElements([]);

    // Notify parent that selections were cleared
    window.parent.postMessage(
      {
        type: "SELECTIONS_CLEARED",
      },
      "*"
    );
  }, [selectedElements]);

  /**
   * Removes a specific element from selection
   */
  const removeSelection = useCallback((elementId: string) => {
    setSelectedElements((prev) => {
      const filtered = prev.filter((info) => info.id !== elementId);
      const removed = prev.find((info) => info.id === elementId);
      if (removed) {
        document.body.removeChild(removed.guide);

        // Notify parent that an element was removed
        window.parent.postMessage(
          {
            type: "ELEMENT_REMOVED",
            data: { id: elementId },
          },
          "*"
        );
      }
      return filtered;
    });
  }, []);

  /**
   * Creates a selection guide for an element
   */
  const createSelectionGuide = useCallback(
    (element: HTMLElement, elementId: string) => {
      // Generate a color based on the element ID for consistency
      const color = textToColor(elementId);
      const metrics = getElementMetrics(element);
      const PADDING = 2;
      const guide = document.createElement("div");
      const bgColor = color.replace(/^#/, "");

      guide.style.cssText = `
      position: fixed;
      border: 2px solid ${color};
      background: #${bgColor}1A;
      pointer-events: none;
      z-index: 99998;
      width: ${metrics.width + PADDING * 2}px;
      height: ${metrics.height + PADDING * 2}px;
      left: ${metrics.x - PADDING}px;
      top: ${metrics.y - PADDING}px;
      border-radius: 4px;
      transition: all 0.2s ease-out;
    `;
      document.body.appendChild(guide);
      return { guide, color };
    },
    []
  );

  /**
   * Handles element click for selection
   */
  const handleElementClick = useCallback(
    (element: HTMLElement, event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();

      const elementId = element.getAttribute("data-archie-id") || "";

      // Check if element is already selected
      const existingSelectionIndex = selectedElements.findIndex(
        (info) => info.id === elementId
      );

      if (existingSelectionIndex >= 0) {
        removeSelection(elementId);
        return;
      }

      // Check if we've reached the maximum selections (3)
      if (selectedElements.length >= 3) {
        // Remove the oldest selection
        const [oldest, ...rest] = selectedElements;
        document.body.removeChild(oldest.guide);
        setSelectedElements(rest);
      }

      // Create new selection
      const { guide, color } = createSelectionGuide(element, elementId);

      // Extract element data
      const elementData: ElementData = {
        id: elementId,
        name: element.getAttribute("data-archie-name") || "",
        path: element.getAttribute("data-component-path") || "",
        line: parseInt(element.getAttribute("data-component-line") || "0", 10),
        file: element.getAttribute("data-component-file") || "",
        lineStart: parseInt(element.getAttribute("data-line-start") || "0", 10),
        lineEnd: parseInt(element.getAttribute("data-line-end") || "0", 10),
        colStart: parseInt(element.getAttribute("data-col-start") || "0", 10),
        colEnd: parseInt(element.getAttribute("data-col-end") || "0", 10),
      };

      // Add to selected elements
      setSelectedElements((prev) => [
        ...prev,
        { element, guide, color, id: elementId },
      ]);

      // Include metrics and color in message to parent
      window.parent.postMessage(
        {
          type: "ELEMENT_SELECTED",
          data: {
            ...elementData,
            metrics: getElementMetrics(element),
            color,
          },
        },
        "*"
      );

      // If it's an interactive element, trigger its click after a small delay
      const isInteractive = element.matches(
        'button, [role="button"], a, input, select, textarea, [tabindex], [contenteditable="true"], details, summary'
      );

      if (isInteractive) {
        setTimeout(() => {
          element.click();
        }, 0);
      }
    },
    [selectedElements, removeSelection, createSelectionGuide]
  );

  /**
   * Handles double click to select first child element
   */
  const handleDoubleClick = useCallback(
    (event: MouseEvent) => {
      if (!isInspecting) return;

      const target = event.target as HTMLElement;
      const currentElement = target.closest("[data-archie-id]") as HTMLElement;

      if (!currentElement) return;

      // Find first child with data-archie-id
      const firstChild = currentElement.querySelector(
        "[data-archie-id]"
      ) as HTMLElement;
      if (firstChild) {
        event.preventDefault();
        event.stopPropagation();
        handleElementClick(firstChild, event);
      }
    },
    [isInspecting, handleElementClick]
  );

  /**
   * Message Handler
   * Processes incoming messages from parent window
   */
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === "TOGGLE_INSPECTION") {
        setIsInspecting(event.data.enabled);
        // Clear selection when toggling inspection off
        if (!event.data.enabled) {
          clearSelection();
        }
      } else if (event.data.type === "CLEAR_SELECTION") {
        clearSelection();
      } else if (event.data.type === "REMOVE_ELEMENT") {
        // Handle removing a specific element by ID
        if (event.data.id) {
          removeSelection(event.data.id);
        }
      } else if (event.data.type === "NAVIGATION_ACTION") {
        if (event.data.action === "back") {
          navigate(-1);
        } else if (event.data.action === "forward") {
          navigate(1);
        } else if (event.data.action === "navigate") {
          navigate(event.data.url);
        } else if (event.data.action === "reload") {
          clearSelection();
          navigate(0);
        }

        window.parent.postMessage(
          {
            type: "NAVIGATION_STATE",
            data: {
              canGoBack: false,
              canGoForward: false,
              currentPath: window.location.pathname,
            },
          },
          "*"
        );
      } else if (event.data.type === "REQUEST_CURRENT_URL") {
        window.parent.postMessage(
          {
            type: "CURRENT_URL",
            data: {
              path: location.pathname,
              search: location.search,
              hash: location.hash,
            },
          },
          "*"
        );
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [navigate, clearSelection, removeSelection, location]);

  /**
   * Inspection mode event handlers
   */
  useEffect(() => {
    if (!isInspecting) {
      clearSelection();
      if (labelRef.current) {
        labelRef.current.style.display = "none";
      }
      // Clear hover guide
      if (hoverGuideRef.current) {
        document.body.removeChild(hoverGuideRef.current);
        hoverGuideRef.current = null;
      }
      return;
    }

    const handleMouseOver = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const inspectableElement = target.closest(
        "[data-archie-id]"
      ) as HTMLElement;

      if (
        !inspectableElement ||
        selectedElements.some(({ element }) => element === inspectableElement)
      )
        return;

      // Show guide for hovered element
      if (hoverGuideRef.current) {
        document.body.removeChild(hoverGuideRef.current);
      }
      hoverGuideRef.current = showElementGuides(inspectableElement);

      // Update hover label
      if (labelRef.current) {
        const name = inspectableElement.getAttribute("data-archie-name") || "";
        const metrics = getElementMetrics(inspectableElement);

        // Clear previous content
        labelRef.current.innerHTML = "";

        // Add name and metrics
        const nameElement = document.createElement("div");
        nameElement.textContent = `${name} - ${metrics.width}x${metrics.height}`;
        nameElement.style.fontWeight = "600";

        labelRef.current.appendChild(nameElement);

        labelRef.current.style.display = "block";

        // Position relative to the element
        const rect = inspectableElement.getBoundingClientRect();
        labelRef.current.style.position = "fixed";
        labelRef.current.style.top = `${rect.top - 22}px`;
        labelRef.current.style.left = `${rect.left - 2}px`;
      }

      // Send hover data
      const elementData: ElementData = {
        id: inspectableElement.getAttribute("data-archie-id") || "",
        name: inspectableElement.getAttribute("data-archie-name") || "",
        path: inspectableElement.getAttribute("data-component-path") || "",
        line: parseInt(
          inspectableElement.getAttribute("data-component-line") || "0",
          10
        ),
        file: inspectableElement.getAttribute("data-component-file") || "",
        lineStart: parseInt(
          inspectableElement.getAttribute("data-line-start") || "0",
          10
        ),
        lineEnd: parseInt(
          inspectableElement.getAttribute("data-line-end") || "0",
          10
        ),
        colStart: parseInt(
          inspectableElement.getAttribute("data-col-start") || "0",
          10
        ),
        colEnd: parseInt(
          inspectableElement.getAttribute("data-col-end") || "0",
          10
        ),
      };

      const metrics = getElementMetrics(inspectableElement);
      window.parent.postMessage(
        {
          type: "ELEMENT_INSPECTED",
          data: {
            ...elementData,
            metrics,
          },
        },
        "*"
      );
    };

    const handleMouseOut = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const inspectableElement = target.closest(
        "[data-archie-id]"
      ) as HTMLElement;

      if (
        inspectableElement &&
        !selectedElements.some(({ element }) => element === inspectableElement)
      ) {
        // Remove hover guide only
        if (hoverGuideRef.current) {
          document.body.removeChild(hoverGuideRef.current);
          hoverGuideRef.current = null;
        }
      }

      // Hide label
      if (labelRef.current) {
        labelRef.current.style.display = "none";
      }
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (labelRef.current && labelRef.current.style.display === "block") {
        labelRef.current.style.left = `${event.clientX + 10}px`;
        labelRef.current.style.top = `${event.clientY + 10}px`;
      }
    };

    // Create throttled version inside the effect where handleMouseMove is defined
    const throttledMouseMove = throttle(handleMouseMove, 16);

    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const inspectableElement = target.closest(
        "[data-archie-id]"
      ) as HTMLElement;

      if (inspectableElement) {
        handleElementClick(inspectableElement, event);
      }
    };

    document.addEventListener("mouseover", handleMouseOver);
    document.addEventListener("mouseout", handleMouseOut);
    document.addEventListener("mousemove", throttledMouseMove);
    document.addEventListener("pointerdown", handleClick, true);
    document.addEventListener("dblclick", handleDoubleClick);

    return () => {
      // Cleanup hover guide only on effect cleanup
      if (hoverGuideRef.current) {
        document.body.removeChild(hoverGuideRef.current);
        hoverGuideRef.current = null;
      }
      document.removeEventListener("mouseover", handleMouseOver);
      document.removeEventListener("mouseout", handleMouseOut);
      document.removeEventListener("mousemove", throttledMouseMove);
      document.removeEventListener("pointerdown", handleClick, true);
      document.removeEventListener("dblclick", handleDoubleClick);
    };
  }, [
    isInspecting,
    selectedElements,
    handleElementClick,
    clearSelection,
    handleDoubleClick,
  ]);

  // Notify parent when inspection starts to handle focus
  useEffect(() => {
    if (isInspecting) {
      // Tell parent window that inspection is active so it can focus the iframe if needed
      window.parent.postMessage({ type: "INSPECTION_ACTIVE" }, "*");
    }
  }, [isInspecting]);

  // Cleanup all observers and guides when component unmounts
  useEffect(() => {
    const handlePopState = () => {
      // Clear guides immediately before navigation
      selectedElements.forEach(({ guide }) => {
        document.body.removeChild(guide);
      });

      // Send updated navigation state
      window.parent.postMessage(
        {
          type: "NAVIGATION_STATE",
          data: {
            canGoBack: false,
            canGoForward: false,
            currentPath: window.location.pathname,
          },
        },
        "*"
      );
    };

    window.addEventListener("popstate", handlePopState);

    // Initial navigation state notification
    window.parent.postMessage(
      {
        type: "NAVIGATION_STATE",
        data: {
          canGoBack: false,
          canGoForward: false,
          currentPath: window.location.pathname,
        },
      },
      "*"
    );

    return () => {
      window.removeEventListener("popstate", handlePopState);
      // Ensure cleanup of guides
      selectedElements.forEach(({ guide }) => {
        document.body.removeChild(guide);
      });
    };
  }, [selectedElements]);

  /**
   * Navigation Interception
   * Handles internal navigation to prevent page reloads
   */
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const link = (e.target as HTMLElement).closest("a");
      if (link?.href && link.href.startsWith(window.location.origin)) {
        e.preventDefault();

        const path = new URL(link.href).pathname;

        // Clear guides before navigation
        clearSelection();
        if (hoverGuideRef.current) {
          document.body.removeChild(hoverGuideRef.current);
          hoverGuideRef.current = null;
        }
        if (labelRef.current) {
          labelRef.current.style.display = "none";
        }

        // Use navigation state
        window.parent.postMessage(
          {
            type: "NAVIGATION_STATE",
            data: {
              canGoBack: false,
              canGoForward: false,
              currentPath: path,
            },
          },
          "*"
        );

        // Navigate using router to prevent page reload
        navigate(path, {
          replace: true,
          preventScrollReset: true,
        });
      }
    };

    const handleSubmit = (e: SubmitEvent) => {
      const form = e.target as HTMLFormElement;
      if (form.method === "get") {
        e.preventDefault();
        const formData = new FormData(form);
        const queryString = new URLSearchParams(formData as any).toString();
        const path = `${form.action.replace(window.location.origin, "")}?${queryString}`;

        // Clear guides before navigation
        clearSelection();
        if (hoverGuideRef.current) {
          document.body.removeChild(hoverGuideRef.current);
          hoverGuideRef.current = null;
        }
        if (labelRef.current) {
          labelRef.current.style.display = "none";
        }

        navigate(path, {
          replace: true,
          preventScrollReset: true,
        });
      }
    };

    document.addEventListener("click", handleClick);
    document.addEventListener("submit", handleSubmit);

    return () => {
      document.removeEventListener("click", handleClick);
      document.removeEventListener("submit", handleSubmit);
    };
  }, [navigate, clearSelection]);

  /**
   * History State Monitoring
   * Tracks and reports navigation state changes
   */
  useEffect(() => {
    const sendNavigationState = () => {
      window.parent.postMessage(
        {
          type: "NAVIGATION_STATE",
          data: {
            canGoBack: false,
            canGoForward: false,
            currentPath: window.location.pathname,
          },
        },
        "*"
      );
    };

    // Monitor history state changes
    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;

    window.history.pushState = function () {
      originalPushState.apply(this, arguments as any);
      sendNavigationState();
    };

    window.history.replaceState = function () {
      originalReplaceState.apply(this, arguments as any);
      sendNavigationState();
    };

    window.addEventListener("popstate", sendNavigationState);

    return () => {
      window.removeEventListener("popstate", sendNavigationState);
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
    };
  }, []);

  return null;
}
