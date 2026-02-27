# UDGloveSelector
Just1Source - Glove Selector

## PDF Download & Compression

When users click **Download PDF** on the Poster Creator tab, the poster is rendered to a JPEG image via [html2canvas](https://html2canvas.hertzen.com/) and packaged into a PDF using [jsPDF](https://github.com/parallax/jsPDF).

An **adaptive compression pipeline** enforces a strict **< 10 MB** size cap on every export.

### How the adaptive pipeline works

1. The poster is rendered to a canvas at **1.5× scale** via html2canvas.
2. The canvas is encoded as a JPEG `Blob` so its exact byte size can be measured.
3. If the JPEG exceeds the **9.5 MB** embedded-image budget (leaving headroom for PDF container overhead), the exporter iterates:
   - **Phase 1 – quality reduction**: JPEG quality is lowered in steps of 0.05, from 0.92 down to a floor of 0.30.
   - **Phase 2 – canvas downscaling**: If quality alone is insufficient, the canvas is downscaled by 10% per step until the target is met or the canvas reaches 25% of its original size.
4. The first combination of quality and scale that satisfies the target is used; the rest are discarded.

### User-facing feedback

| Scenario | Message shown |
|---|---|
| PDF optimized (quality/scale reduced) | "PDF was optimized to stay under 10 MB." |
| Cannot reach < 10 MB | "PDF could not be reduced below 10 MB. Try removing items or images and export again." |
| Normal export (already under budget) | No message |

### Manual validation

1. Open the app, select gloves on the Features or Industry tab.
2. Switch to the **Poster Creator** tab and click **Download PDF**.
3. Check the saved file size — it should be **under 10 MB**.
