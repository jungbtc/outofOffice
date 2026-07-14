# Performance and memory

The current performance pass reduces retained browser memory during repeated large edits and removes unused application code. These measurements are reproducible development indicators, not guarantees for every document or computer.

## Recorded results

| Metric                                           |          Before |         After |                                                              Change |
| ------------------------------------------------ | --------------: | ------------: | ------------------------------------------------------------------: |
| Retained JavaScript heap after the edit workload | 1,013,216 bytes | 408,608 bytes |                                                         59.7% lower |
| Workload elapsed time                            |      1,971.1 ms |    1,967.9 ms | Effectively unchanged; the workload waits for every animation frame |
| Main production JavaScript bundle                |       301.67 kB |     255.13 kB |                                                       15.4% smaller |
| Main production JavaScript bundle, gzip          |        99.27 kB |      82.04 kB |                                                       17.4% smaller |
| Modules transformed by the production build      |              82 |            54 |                                                         34.1% fewer |

The baseline heap moved from 2,794,664 bytes before the workload to 3,807,880 bytes after garbage collection. The optimized build moved from 2,464,188 bytes to 2,872,796 bytes under the same workload.

## Heap workload

The Playwright memory check runs Chromium against the production Vite preview and:

1. Opens a new blank document.
2. Forces JavaScript garbage collection through the Chrome DevTools Protocol and records `Runtime.getHeapUsage`.
3. Builds a roughly 120,000-character paragraph and dispatches 120 input changes, replacing a four-character region at a different offset each time.
4. Waits for one animation frame between changes, then waits 800 ms for delayed editor work to settle.
5. Forces garbage collection again and records the retained `usedSize` difference.

The automated regression check currently requires retained growth below 8 MiB and workload time below four seconds. The recorded before-and-after figures above use the same workload and measurement points. Because animation-frame waits dominate the elapsed value, this test is primarily a retained-heap regression check rather than a typing-latency benchmark.

The bundle figures come from the Vite production build output for the main JavaScript chunk. They reflect removal of the presentation and spreadsheet modules and other unused interface code; they do not represent installed application size or native process memory.

## Changes that reduce retained memory

- The content-editable DOM remains local during active typing instead of copying the full HTML document into application state on every input event.
- Idle commits use a minimal common-prefix/common-suffix text patch rather than retaining complete before-and-after documents.
- Undo and redo history is capped at 250 entries and approximately 4 MiB of command data.
- Statistics and model commits are delayed and coalesced instead of running on every browser input event.
- Autosave is serialized, revision-aware, and skips unchanged documents.
- The home screen holds recovery metadata only and loads a selected snapshot on demand.
- Timers, listeners, drag-and-drop registrations, object URLs, and editor resources have explicit cleanup paths.
- Native package JSON is size-checked and streamed into the archive rather than first creating additional complete byte buffers.

## Measurement limits

`Runtime.getHeapUsage` measures the page's JavaScript heap after forced garbage collection. It does not measure the complete Windows working set of WebView2, the Tauri host, Rust allocations, GPU processes, SQLite, loaded fonts, or operating-system caches. Forced collection and a synthetic large-text workload also differ from normal interactive editing.

A Windows release build still needs process-tree working-set measurements on representative hardware for:

- cold idle and one open document;
- sustained typing, formatting, selection, scrolling, and printing;
- repeated open, save, close, and recovery cycles;
- multiple simultaneous documents; and
- memory returned after every document window closes.

Those native measurements should report hardware, Windows and WebView2 versions, document sizes, process-level private working sets, and repeat count. Until they are recorded, the browser-heap result should be described as a verified regression improvement, not total application RAM usage.
