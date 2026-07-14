import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { command, type EditorCommand } from "@outofoffice/commands";
import { createSlide, type PresentDocument, type SlideObject } from "@outofoffice/document-model";
import { createSlideObject } from "@outofoffice/present";
import { createId } from "@outofoffice/shared";
import { ToolbarButton } from "@outofoffice/ui";

interface PresentEditorProps {
  document: PresentDocument;
  dispatch(command: EditorCommand): void;
}
interface DragState {
  before: SlideObject;
  offsetX: number;
  offsetY: number;
}

function objectStyle(object: SlideObject): CSSProperties {
  return {
    left: `${(object.x / 960) * 100}%`,
    top: `${(object.y / 540) * 100}%`,
    width: `${(object.width / 960) * 100}%`,
    height: `${(object.height / 540) * 100}%`,
    transform: `rotate(${object.rotation}deg)`,
    background: object.fill,
    fontSize: `clamp(12px, ${(object.fontSize / 960) * 70}vw, ${object.fontSize}px)`,
  };
}

export function PresentEditor({ document: model, dispatch }: PresentEditorProps) {
  const [activeSlideId, setActiveSlideId] = useState(model.slides[0]?.id ?? "");
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [draft, setDraft] = useState<SlideObject | null>(null);
  const [slideshow, setSlideshow] = useState(false);
  const activeSlide = model.slides.find((slide) => slide.id === activeSlideId) ?? model.slides[0];
  const selected = activeSlide?.objects.find((object) => object.id === selectedObjectId) ?? null;
  useEffect(() => {
    if (!model.slides.some((slide) => slide.id === activeSlideId))
      setActiveSlideId(model.slides[0]?.id ?? "");
  }, [activeSlideId, model.slides]);

  const shownObjects = useMemo(
    () => activeSlide?.objects.map((object) => (draft?.id === object.id ? draft : object)) ?? [],
    [activeSlide, draft],
  );
  if (!activeSlide) return <div className="empty-editor">This presentation has no slides.</div>;

  const addSlide = () => {
    const slide = createSlide(model.slides.length + 1);
    dispatch(command({ type: "add-slide", slide, index: model.slides.length }, "Add slide"));
    setActiveSlideId(slide.id);
  };
  const duplicateSlide = () => {
    const index = model.slides.findIndex((slide) => slide.id === activeSlide.id) + 1;
    const slide = structuredClone(activeSlide);
    slide.id = createId("slide");
    slide.title = `${activeSlide.title} copy`;
    slide.objects = slide.objects.map((object) => ({ ...object, id: createId("object") }));
    dispatch(command({ type: "add-slide", slide, index }, "Duplicate slide"));
    setActiveSlideId(slide.id);
  };
  const deleteSlide = () => {
    if (model.slides.length === 1) return;
    const index = model.slides.findIndex((slide) => slide.id === activeSlide.id);
    const fallback = model.slides[index === 0 ? 1 : index - 1];
    dispatch(command({ type: "delete-slide", slide: activeSlide, index }, "Delete slide"));
    setActiveSlideId(fallback?.id ?? "");
    setSelectedObjectId(null);
  };
  const addObject = (type: "text" | "rectangle" | "ellipse") => {
    const object = createSlideObject(type, activeSlide.objects.length);
    dispatch(command({ type: "add-slide-object", slideId: activeSlide.id, object }, `Add ${type}`));
    setSelectedObjectId(object.id);
  };
  const updateObject = (before: SlideObject, after: SlideObject, label: string) => {
    if (JSON.stringify(before) !== JSON.stringify(after))
      dispatch(
        command({ type: "update-slide-object", slideId: activeSlide.id, before, after }, label),
      );
  };
  const beginDrag = (event: ReactPointerEvent<HTMLDivElement>, object: SlideObject) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectedObjectId(object.id);
    const canvas = event.currentTarget.parentElement?.getBoundingClientRect();
    if (!canvas) return;
    const pointX = ((event.clientX - canvas.left) / canvas.width) * 960;
    const pointY = ((event.clientY - canvas.top) / canvas.height) * 540;
    setDrag({ before: object, offsetX: pointX - object.x, offsetY: pointY - object.y });
    setDraft(object);
  };
  const moveDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag) return;
    const canvas = event.currentTarget.parentElement?.getBoundingClientRect();
    if (!canvas) return;
    const x = ((event.clientX - canvas.left) / canvas.width) * 960 - drag.offsetX;
    const y = ((event.clientY - canvas.top) / canvas.height) * 540 - drag.offsetY;
    setDraft({
      ...drag.before,
      x: Math.max(0, Math.min(960 - drag.before.width, x)),
      y: Math.max(0, Math.min(540 - drag.before.height, y)),
    });
  };
  const endDrag = () => {
    if (drag && draft) updateObject(drag.before, draft, "Move object");
    setDrag(null);
    setDraft(null);
  };

  const canvas = (
    <div
      className="slide-canvas"
      style={{ background: activeSlide.background }}
      onPointerDown={() => setSelectedObjectId(null)}
    >
      {shownObjects.map((object) => (
        <div
          key={object.id}
          className={`slide-object object-${object.type} ${selectedObjectId === object.id ? "is-selected" : ""}`}
          style={objectStyle(object)}
          onPointerDown={(event) => {
            event.stopPropagation();
            beginDrag(event, object);
          }}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
        >
          {object.type === "text" ? object.text : ""}
        </div>
      ))}
    </div>
  );

  return (
    <section className="editor-module present-module" aria-label="Present editor">
      <div className="context-toolbar" role="toolbar" aria-label="Presentation tools">
        <ToolbarButton label="Add slide" icon="＋ Slide" onClick={addSlide} />
        <ToolbarButton label="Duplicate slide" icon="Duplicate" onClick={duplicateSlide} />
        <ToolbarButton
          label="Delete slide"
          icon="Delete"
          disabled={model.slides.length === 1}
          onClick={deleteSlide}
        />
        <span className="toolbar-separator" />
        <ToolbarButton label="Add text box" icon="T Text" onClick={() => addObject("text")} />
        <ToolbarButton
          label="Add rectangle"
          icon="▭ Rectangle"
          onClick={() => addObject("rectangle")}
        />
        <ToolbarButton label="Add ellipse" icon="○ Ellipse" onClick={() => addObject("ellipse")} />
        <span className="toolbar-spacer" />
        <ToolbarButton
          label="Start slideshow"
          icon="▶ Present"
          onClick={() => setSlideshow(true)}
        />
      </div>
      <div className="present-workspace">
        <aside className="slide-strip" aria-label="Slides">
          {model.slides.map((slide, index) => (
            <button
              key={slide.id}
              className={slide.id === activeSlide.id ? "is-active" : ""}
              onClick={() => {
                setActiveSlideId(slide.id);
                setSelectedObjectId(null);
              }}
            >
              <span>{index + 1}</span>
              <div className="slide-miniature">
                {slide.objects.slice(0, 4).map((object) => (
                  <i key={object.id} className={`mini-${object.type}`} />
                ))}
              </div>
            </button>
          ))}
        </aside>
        <main className="canvas-stage">{canvas}</main>
        <aside className="properties-inspector">
          <h3>Properties</h3>
          {selected ? (
            <ObjectInspector
              object={selected}
              onChange={(after, label) => updateObject(selected, after, label)}
              onDelete={() => {
                dispatch(
                  command(
                    { type: "delete-slide-object", slideId: activeSlide.id, object: selected },
                    "Delete object",
                  ),
                );
                setSelectedObjectId(null);
              }}
            />
          ) : (
            <p className="muted">Select an object to edit its position, size, color, and text.</p>
          )}
        </aside>
      </div>
      <div className="module-status">
        <span>
          Slide {model.slides.findIndex((slide) => slide.id === activeSlide.id) + 1} of{" "}
          {model.slides.length}
        </span>
        <span>16:9 · landscape</span>
      </div>
      {slideshow && (
        <div
          className="slideshow-overlay"
          role="dialog"
          aria-label="Slideshow"
          onClick={() => setSlideshow(false)}
        >
          {canvas}
          <button onClick={() => setSlideshow(false)}>Exit slideshow</button>
        </div>
      )}
    </section>
  );
}

function ObjectInspector({
  object,
  onChange,
  onDelete,
}: {
  object: SlideObject;
  onChange(after: SlideObject, label: string): void;
  onDelete(): void;
}) {
  const number = (key: "x" | "y" | "width" | "height" | "rotation", value: string) => {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) onChange({ ...object, [key]: parsed }, `Change object ${key}`);
  };
  return (
    <div className="inspector-form">
      {object.type === "text" && (
        <label>
          Text
          <textarea
            value={object.text}
            onChange={(event) => onChange({ ...object, text: event.target.value }, "Edit text")}
          />
        </label>
      )}
      <div className="field-grid">
        {(["x", "y", "width", "height", "rotation"] as const).map((key) => (
          <label key={key}>
            {key}
            <input
              type="number"
              value={Math.round(object[key])}
              onChange={(event) => number(key, event.target.value)}
            />
          </label>
        ))}
      </div>
      <label>
        Fill
        <input
          type="color"
          value={object.fill === "transparent" ? "#ffffff" : object.fill}
          onChange={(event) => onChange({ ...object, fill: event.target.value }, "Change fill")}
        />
      </label>
      {object.type === "text" && (
        <label>
          Font size
          <input
            type="number"
            min="8"
            max="144"
            value={object.fontSize}
            onChange={(event) =>
              onChange({ ...object, fontSize: Number(event.target.value) }, "Change font size")
            }
          />
        </label>
      )}
      <button className="danger-button" onClick={onDelete}>
        Delete object
      </button>
    </div>
  );
}
