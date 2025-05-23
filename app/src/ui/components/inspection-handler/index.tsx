/**
 * @file InspectionHandler Component
 */

import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  useElementSelection,
  useInspectionEventHandlers,
  useInspectionMode,
  useNavigationHandler,
  useParentCommunication,
} from "./hooks";

export function InspectionHandler() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    selectedElements,
    clearSelection,
    addSelection,
    removeSelection,
    toggleSelection,
  } = useElementSelection();
  const {
    isInspecting,
    setIsInspecting,
    labelRef,
    hoverGuideRef,
    showElementGuides,
  } = useInspectionMode(selectedElements);
  const { location: navLocation } = useNavigationHandler(clearSelection);

  // Clear selection when pathname changes
  useEffect(() => {
    clearSelection();
  }, [location.pathname, clearSelection]);

  useParentCommunication(
    setIsInspecting,
    clearSelection,
    removeSelection,
    navigate,
    navLocation
  );

  useInspectionEventHandlers(
    isInspecting,
    selectedElements,
    labelRef,
    hoverGuideRef,
    showElementGuides,
    toggleSelection,
    addSelection,
    clearSelection
  );

  return null;
}
