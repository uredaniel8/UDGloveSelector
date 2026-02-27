# UDGloveSelector
Just1Source - Glove Selector

## PDF Download & Compression

When users click **Download PDF** on the Poster Creator tab, the poster is rendered to a JPEG image via [html2canvas](https://html2canvas.hertzen.com/) and packaged into a PDF using [jsPDF](https://github.com/parallax/jsPDF).

A **Quality** selector appears next to the Download PDF button with three presets:

| Preset | html2canvas scale | JPEG quality | Typical use |
|---|---|---|---|
| Screen (smallest) | 1.5× | 0.60 | Smallest file – best for email / web sharing |
| **Email (default)** | **2×** | **0.75** | **Balanced size & quality (default)** |
| Print (best quality) | 3× | 0.92 | Highest fidelity – larger file, for printing |

The default is **Email**, which targets emailability while still looking crisp on screen.

### Adjusting compression settings

The presets are defined in `app.js` near the `PDF_PRESETS` constant:

```js
const PDF_PRESETS = {
  screen:  { scale: 1.5, quality: 0.60 },
  ebook:   { scale: 2,   quality: 0.75 },
  printer: { scale: 3,   quality: 0.92 }
};
const DEFAULT_PDF_PRESET = 'ebook';
```

- **`scale`** – the html2canvas render multiplier. Higher values produce sharper output but increase file size proportionally to `scale²`.
- **`quality`** – JPEG compression level from `0.0` (maximum compression, most artefacts) to `1.0` (minimal compression, highest quality). Values below `0.5` produce visible artefacts on text.

To change the default, update `DEFAULT_PDF_PRESET` to `'screen'` or `'printer'`.
