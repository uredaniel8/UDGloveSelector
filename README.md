# UDGloveSelector
Just1Source - Glove Selector

## PDF Download & Compression

When users click **Download PDF** on the Poster Creator tab, the poster is rendered to a JPEG image via [html2canvas](https://html2canvas.hertzen.com/) and packaged into a PDF using [jsPDF](https://github.com/parallax/jsPDF).

A single, fixed compression setting is enforced to keep poster PDFs consistently under 10 MB:

| Setting | Value | Notes |
|---|---|---|
| html2canvas scale | 1.5× | Balances sharpness and file size |
| JPEG quality | 0.72 | Good visual fidelity with strong compression |

### Compression configuration

The settings are defined in `app.js` as `PDF_QUALITY`:

```js
const PDF_QUALITY = { scale: 1.5, quality: 0.72 };
```

- **`scale`** – the html2canvas render multiplier. Higher values produce sharper output but increase file size proportionally to `scale²`.
- **`quality`** – JPEG compression level from `0.0` (maximum compression, most artefacts) to `1.0` (minimal compression, highest quality). Values below `0.5` produce visible artefacts on text.

### Manual validation

1. Open the app, select gloves on the Features or Industry tab.
2. Switch to the **Poster Creator** tab and click **Download PDF**.
3. Check the saved file size — it should be **under 10 MB**.
