# Present module

## Current vertical slice

Present stores ordered slides and independent objects in a fixed 960×540 coordinate space. Users can add, duplicate, and delete slides; add text boxes, rectangles, and ellipses; drag objects; edit geometry, rotation, fill, text, and font size; delete objects; and open a full-window slideshow.

An in-progress drag is transient view state. Pointer release emits one serializable `update-slide-object` command, keeping history efficient and the model authoritative.

## Not yet implemented

Image objects, resize handles, rotation handles, crop, grouping, layer panels, align/distribute, snapping, guides, slide reordering/hiding UI, layouts, transitions, speaker-note editing, presenter view, PPTX/ODP import/export, and PDF/image export remain future work.

The next rendering step is an accessible SVG scene with resize/rotate handles and a spatial index; interoperability follows only after fixture-backed mapping tests.
