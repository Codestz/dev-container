export interface ElementData {
  id: string;
  name: string;
  path: string;
  line: number;
  file: string;
  lineStart: number;
  lineEnd: number;
  colStart: number;
  colEnd: number;
}

export interface ElementMetrics {
  width: number;
  height: number;
  x: number;
  y: number;
}

export interface SelectedElementInfo {
  element: HTMLElement;
  id: string;
}
