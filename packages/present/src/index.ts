import type { SlideObject, SlideObjectType } from "@outofoffice/document-model";
import { createId } from "@outofoffice/shared";

export function createSlideObject(type: SlideObjectType, sequence: number): SlideObject {
  const isText = type === "text";
  return {
    id: createId("object"),
    type,
    x: 80 + (sequence % 5) * 18,
    y: 80 + (sequence % 5) * 18,
    width: isText ? 360 : 180,
    height: isText ? 80 : 130,
    rotation: 0,
    fill: isText ? "transparent" : type === "ellipse" ? "#f7b955" : "#6d7cff",
    text: isText ? "Double-click to edit" : "",
    fontSize: isText ? 28 : 18,
  };
}
