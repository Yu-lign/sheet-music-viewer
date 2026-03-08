import { useState, useEffect, useRef, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

// Worker path for pdf.js (matching version 5.5.207)
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.5.207/pdf.worker.min.mjs`;

function App() {
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pageNum, setPageNum] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [triggerKey, setTriggerKey] = useState<string>('AudioVolumeUp');
  const [isSettingKey, setIsSettingKey] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null);

  // Load default test PDF on mount
  useEffect(() => {
    const loadDefaultPdf = async () => {
      try {
        const response = await fetch('/test_sheet_music.pdf');
        if (!response.ok) throw new Error('PDF not found');
        const arrayBuffer = await response.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        setPdfDoc(pdf);
        setNumPages(pdf.numPages);
        setPageNum(1);
      } catch (err) {
        console.error("Default PDF load error:", err);
      }
    };
    loadDefaultPdf();
  }, []);

  // Load PDF from input file
  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const arrayBuffer = event.target?.result as ArrayBuffer;
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        setPdfDoc(pdf);
        setNumPages(pdf.numPages);
        setPageNum(1);
      };
      reader.readAsArrayBuffer(file);
    }
  };

  // Render the current page
  const renderPage = useCallback(async (num: number, pdf: pdfjsLib.PDFDocumentProxy) => {
    if (!canvasRef.current) return;
    
    if (renderTaskRef.current) {
      renderTaskRef.current.cancel();
    }

    const page = await pdf.getPage(num);
    const viewport = page.getViewport({ scale: 2.0 }); // High quality scale
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (context) {
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const renderContext = {
        canvasContext: context,
        viewport: viewport,
        canvas: canvas,
      };
      
      const renderTask = page.render(renderContext);
      renderTaskRef.current = renderTask;
      
      try {
        await renderTask.promise;
      } catch (err: any) {
        if (err.name !== 'RenderingCancelledException') {
          console.error(err);
        }
      }
    }
  }, []);

  useEffect(() => {
    if (pdfDoc) {
      renderPage(pageNum, pdfDoc);
    }
  }, [pdfDoc, pageNum, renderPage]);

  // Handle key events for page turning
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isSettingKey) {
        setTriggerKey(e.key);
        setIsSettingKey(false);
        e.preventDefault();
        return;
      }

      if (e.key === triggerKey || e.key === 'ArrowRight' || e.key === ' ') {
        setPageNum((prev) => (prev < numPages ? prev + 1 : prev));
        e.preventDefault();
      } else if (e.key === 'AudioVolumeDown' || e.key === 'ArrowLeft') {
        setPageNum((prev) => (prev > 1 ? prev - 1 : 1));
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [triggerKey, isSettingKey, numPages]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '100vh', backgroundColor: '#1a1a1a', color: '#fff' }}>
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 10, backgroundColor: 'rgba(0,0,0,0.7)', padding: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <input type="file" accept="application/pdf" onChange={onFileChange} style={{ fontSize: '12px' }} />
        <div>
          <span style={{ marginRight: '15px' }}>{pageNum} / {numPages}</span>
          <button onClick={() => setPageNum(p => Math.max(1, p - 1))} style={{ padding: '5px 15px' }}>前</button>
          <button onClick={() => setPageNum(p => Math.min(numPages, p + 1))} style={{ padding: '5px 15px', marginLeft: '5px' }}>次</button>
        </div>
        <button onClick={() => setIsSettingKey(true)} disabled={isSettingKey} style={{ fontSize: '12px' }}>
          {isSettingKey ? 'キー押して...' : `めくりキー: ${triggerKey}`}
        </button>
      </div>

      <div style={{ marginTop: '60px', width: '100%', display: 'flex', justifyContent: 'center' }}>
        <canvas ref={canvasRef} style={{ maxWidth: '100%', height: 'auto', backgroundColor: '#fff' }} />
      </div>
    </div>
  );
}

export default App;
