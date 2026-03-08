import { useState, useEffect, useRef, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure worker using the version that matches the installed react-pdf/pdfjs-dist
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

function App() {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNum, setPageNum] = useState<number>(1);
  const [triggerKey, setTriggerKey] = useState<string>('AudioVolumeUp');
  const [isSettingKey, setIsSettingKey] = useState(false);
  const [isVolumeHackEnabled, setIsVolumeHackEnabled] = useState(false);
  const [debugLog, setDebugLog] = useState<string>('');
  const [pdfFile, setPdfFile] = useState<any>('/test_sheet_music.pdf');
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastVolumeRef = useRef<number>(0.5);

  const log = (msg: string) => {
    console.log(msg);
    setDebugLog(prev => `${new Date().toLocaleTimeString()}: ${msg}\n${prev}`.slice(0, 500));
  };

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setPageNum(1);
    log(`PDF loaded! Total ${numPages} pages.`);
  };

  const onDocumentLoadError = (err: Error) => {
    log(`Load error: ${err.message}`);
  };

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
        log(`Key bound: ${e.key}`);
        return;
      }

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

  // Volume Button Hack & Media Session
  useEffect(() => {
    if (!isVolumeHackEnabled) return;

    const handleVolumeChange = () => {
      if (!audioRef.current) return;
      const currentVolume = audioRef.current.volume;
      if (currentVolume !== lastVolumeRef.current) {
        nextPage();
        audioRef.current.volume = 0.5;
        lastVolumeRef.current = 0.5;
        log("Volume change detected!");
      }
    };

    const audio = audioRef.current;
    if (audio) {
      audio.addEventListener('volumechange', handleVolumeChange);
    }
    
    if ('mediaSession' in navigator) {
      navigator.mediaSession.setActionHandler('nexttrack', () => {
        nextPage();
        log("Remote: Next");
      });
      navigator.mediaSession.setActionHandler('previoustrack', () => {
        prevPage();
        log("Remote: Prev");
      });
    }

    return () => {
      if (audio) audio.removeEventListener('volumechange', handleVolumeChange);
    };
  }, [isVolumeHackEnabled, nextPage, prevPage]);

  const enableVolumeHack = () => {
    if (audioRef.current) {
      audioRef.current.play().then(() => {
        setIsVolumeHackEnabled(true);
        audioRef.current!.volume = 0.5;
        lastVolumeRef.current = 0.5;
        log("Volume hack active.");
        if ('mediaSession' in navigator) {
          navigator.mediaSession.playbackState = 'playing';
        }
      }).catch((err) => {
        log(`Audio error: ${err.message}`);
        alert("Please tap anywhere first, then try again.");
      });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPdfFile(file);
      log(`New file: ${file.name}`);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '100vh', backgroundColor: '#000', color: '#fff', padding: 0, margin: 0 }}>
      <audio ref={audioRef} src="data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==" loop />

      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 10, backgroundColor: 'rgba(20,20,20,0.95)', padding: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #333' }}>
        <input type="file" accept="application/pdf" onChange={handleFileChange} style={{ fontSize: '10px', width: '80px' }} />
        
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '16px', fontWeight: 'bold' }}>{pageNum} / {numPages}</div>
          <div style={{ display: 'flex', gap: '5px', marginTop: '2px' }}>
            <button onClick={prevPage} style={{ padding: '5px 15px', background: '#333', color: '#fff', border: '1px solid #444', borderRadius: '4px' }}>前</button>
            <button onClick={nextPage} style={{ padding: '5px 15px', background: '#333', color: '#fff', border: '1px solid #444', borderRadius: '4px' }}>次</button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          <button onClick={() => setIsSettingKey(true)} disabled={isSettingKey} style={{ fontSize: '10px', background: '#2980b9', border: 'none', color: '#fff', padding: '4px 8px', borderRadius: '3px' }}>
            {isSettingKey ? 'キー入力中' : `キー: ${triggerKey}`}
          </button>
          <button onClick={enableVolumeHack} disabled={isVolumeHackEnabled} style={{ fontSize: '10px', background: isVolumeHackEnabled ? '#27ae60' : '#e67e22', border: 'none', color: '#fff', padding: '4px 8px', borderRadius: '3px' }}>
            {isVolumeHackEnabled ? '音量検知中' : '音量検知ON'}
          </button>
        </div>
      </div>

      <div style={{ marginTop: '75px', width: '100%', display: 'flex', justifyContent: 'center', paddingBottom: '110px' }}>
        <Document
          file={pdfFile}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          loading={<div style={{ padding: '20px' }}>Loading PDF...</div>}
        >
          <Page 
            pageNumber={pageNum} 
            width={Math.min(window.innerWidth * 0.98, 800)}
            renderTextLayer={false}
            renderAnnotationLayer={false}
          />
        </Document>
      </div>

      {/* Debug Console */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, maxHeight: '80px', overflowY: 'auto', backgroundColor: 'rgba(0,0,0,0.85)', color: '#0f0', fontSize: '10px', padding: '5px', zIndex: 100, pointerEvents: 'none', borderTop: '1px solid #0f0' }}>
        {debugLog}
      </div>
    </div>
  );
}

export default App;
