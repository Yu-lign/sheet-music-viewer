import { useState, useEffect, useRef, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

// Use the local worker from node_modules - Vite will handle this correctly
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

function App() {
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pageNum, setPageNum] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [triggerKey, setTriggerKey] = useState<string>('AudioVolumeUp');
  const [isSettingKey, setIsSettingKey] = useState(false);
  const [isVolumeHackEnabled, setIsVolumeHackEnabled] = useState(false);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastVolumeRef = useRef<number>(0.5);

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

  // Handle PDF file selection
  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const arrayBuffer = event.target?.result as ArrayBuffer;
          const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
          const pdf = await loadingTask.promise;
          setPdfDoc(pdf);
          setNumPages(pdf.numPages);
          setPageNum(1);
        } catch (err) {
          console.error("File load error:", err);
        }
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

    try {
      const page = await pdf.getPage(num);
      const viewport = page.getViewport({ scale: 2.0 });
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
        await renderTask.promise;
      }
    } catch (err: any) {
      if (err.name !== 'RenderingCancelledException') {
        console.error("Render error:", err);
      }
    }
  }, []);

  useEffect(() => {
    if (pdfDoc) {
      renderPage(pageNum, pdfDoc);
    }
  }, [pdfDoc, pageNum, renderPage]);

  // Next/Prev Page Actions
  const nextPage = useCallback(() => {
    setPageNum((prev) => (prev < numPages ? prev + 1 : prev));
  }, [numPages]);

  const prevPage = useCallback(() => {
    setPageNum((prev) => (prev > 1 ? prev - 1 : 1));
  }, []);

  // Keyboard Event Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isSettingKey) {
        setTriggerKey(e.key);
        setIsSettingKey(false);
        e.preventDefault();
        return;
      }

      // Handle custom trigger key OR common remote keys
      if (e.key === triggerKey || e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') {
        nextPage();
        e.preventDefault();
      } else if (e.key === 'AudioVolumeDown' || e.key === 'ArrowLeft') {
        prevPage();
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [triggerKey, isSettingKey, nextPage, prevPage]);

  // Volume Button Hack (monitoring volumechange event)
  useEffect(() => {
    if (!isVolumeHackEnabled) return;

    const handleVolumeChange = () => {
      if (!audioRef.current) return;
      const currentVolume = audioRef.current.volume;
      
      // If volume changed, trigger next page
      if (currentVolume !== lastVolumeRef.current) {
        nextPage();
        // Reset volume to 0.5 to prevent reaching 0 or 1
        audioRef.current.volume = 0.5;
        lastVolumeRef.current = 0.5;
      }
    };

    const audio = audioRef.current;
    if (audio) {
      audio.addEventListener('volumechange', handleVolumeChange);
    }
    return () => {
      if (audio) {
        audio.removeEventListener('volumechange', handleVolumeChange);
      }
    };
  }, [isVolumeHackEnabled, nextPage]);

  const enableVolumeHack = () => {
    if (audioRef.current) {
      audioRef.current.play().catch(() => {}); // Play silent audio to enable volume monitoring
      setIsVolumeHackEnabled(true);
      lastVolumeRef.current = audioRef.current.volume;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '100vh', backgroundColor: '#000', color: '#fff', padding: 0, margin: 0 }}>
      {/* Hidden Audio for Volume Hack */}
      <audio ref={audioRef} src="data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==" loop style={{ display: 'none' }} />

      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 10, backgroundColor: 'rgba(20,20,20,0.9)', padding: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #333' }}>
        <input type="file" accept="application/pdf" onChange={onFileChange} style={{ fontSize: '12px', width: '100px' }} />
        
        <div>
          <span style={{ fontSize: '18px', fontWeight: 'bold', marginRight: '15px' }}>{pageNum} / {numPages}</span>
          <button onClick={prevPage} style={{ padding: '10px 20px', fontSize: '16px', background: '#333', color: '#fff', border: '1px solid #444', borderRadius: '5px' }}>前</button>
          <button onClick={nextPage} style={{ padding: '10px 20px', fontSize: '16px', background: '#333', color: '#fff', border: '1px solid #444', borderRadius: '5px', marginLeft: '5px' }}>次</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <button onClick={() => setIsSettingKey(true)} disabled={isSettingKey} style={{ fontSize: '11px', background: '#2980b9', border: 'none', color: '#fff', padding: '5px 10px', borderRadius: '3px' }}>
            {isSettingKey ? 'キー押して...' : `めくりキー: ${triggerKey}`}
          </button>
          <button onClick={enableVolumeHack} disabled={isVolumeHackEnabled} style={{ fontSize: '11px', background: isVolumeHackEnabled ? '#27ae60' : '#e67e22', border: 'none', color: '#fff', padding: '5px 10px', borderRadius: '3px' }}>
            {isVolumeHackEnabled ? '音量検知ON' : '音量検知を有効化'}
          </button>
        </div>
      </div>

      <div style={{ marginTop: '70px', width: '100%', display: 'flex', justifyContent: 'center' }}>
        <canvas ref={canvasRef} style={{ maxWidth: '100%', height: 'auto', backgroundColor: '#fff' }} />
      </div>
    </div>
  );
}

export default App;
