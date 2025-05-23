import { useCallback, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

export function useNavigationHandler(clearSelection: () => void) {
  const navigate = useNavigate();
  const location = useLocation();

  const sendNavigationState = useCallback(() => {
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
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const link = (e.target as HTMLElement).closest("a");
      if (link?.href && link.href.startsWith(window.location.origin)) {
        e.preventDefault();
        const path = new URL(link.href).pathname;
        clearSelection();
        navigate(path, { replace: true, preventScrollReset: true });
      }
    };

    const handleSubmit = (e: SubmitEvent) => {
      const form = e.target as HTMLFormElement;
      if (form.method === "get") {
        e.preventDefault();
        const formData = new FormData(form);
        const queryString = new URLSearchParams(formData as any).toString();
        const path = `${form.action.replace(window.location.origin, "")}?${queryString}`;
        clearSelection();
        navigate(path, { replace: true, preventScrollReset: true });
      }
    };

    document.addEventListener("click", handleClick);
    document.addEventListener("submit", handleSubmit);

    return () => {
      document.removeEventListener("click", handleClick);
      document.removeEventListener("submit", handleSubmit);
    };
  }, [navigate, clearSelection]);

  useEffect(() => {
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

    const handlePopState = () => {
      clearSelection();
      sendNavigationState();
    };

    window.addEventListener("popstate", handlePopState);
    sendNavigationState();

    return () => {
      window.removeEventListener("popstate", handlePopState);
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
    };
  }, [clearSelection, sendNavigationState]);

  return { location };
}
