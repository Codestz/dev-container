import { useEffect } from "react";

export function useParentCommunication(
  setIsInspecting: (value: boolean) => void,
  clearSelection: () => void,
  removeSelection: (id: string) => void,
  navigate: any,
  location: any
) {
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      switch (event.data.type) {
        case "TOGGLE_INSPECTION":
          setIsInspecting(event.data.enabled);
          if (!event.data.enabled) {
            clearSelection();
          }
          break;

        case "CLEAR_SELECTION":
          clearSelection();
          break;

        case "REMOVE_ELEMENT":
          if (event.data.id) {
            removeSelection(event.data.id);
          }
          break;

        case "NAVIGATION_ACTION":
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
          break;

        case "REQUEST_CURRENT_URL":
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
          break;
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [setIsInspecting, clearSelection, removeSelection, navigate, location]);
}
