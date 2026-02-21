"use client";

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Camera, RefreshCw, Download, Trash2, Share2, Sparkles, Ghost, Palette, Sun, Moon, Zap, ChevronUp, Loader2, Image as ImageIcon, Settings2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import confetti from 'canvas-confetti';
import { removeBackground } from '@imgly/background-removal';

type ShootingStyle = 'standard' | 'classic' | 'FQS' | 'OFM' | 'retro-grain' | 'cyberpunk' | 'vivid' | 'dreamy' | 'noir';

type CameraModel = 
  | 'Normal'
  | 'SX-70' 
  | '600 Series' 
  | 'Spectra' 
  | 'i-Type' 
  | 'Go' 
  | 'Rollfilm' 
  | 'Packfilm' 
  | 'Flip' 
  | 'I-2' 
  | 'Impulse';

type HighAngleBG = 'red-cube' | 'curtain';

interface PhotoSession {
  id: string;
  frames: string[];
  style: ShootingStyle;
  camera: CameraModel;
  highAngle: boolean;
  highAngleBG?: HighAngleBG;
  timestamp: number;
  caption?: string;
  stripUrl?: string;
}

declare global {
  interface Window {
    pixelsJS: any;
  }
}

export default function PhotoBooth() {
  const [step, setStep] = useState<'setup' | 'shooting' | 'lab'>('setup');
  const [shootingStyle, setShootingStyle] = useState<ShootingStyle>('standard');
  const [cameraModel, setCameraModel] = useState<CameraModel>('Normal');
  const [frameCount, setFrameCount] = useState<number>(4);
  const [highAngle, setHighAngle] = useState<boolean>(false);
  const [highAngleBG, setHighAngleBG] = useState<HighAngleBG>('red-cube');
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [caption, setCaption] = useState<string>('');
  const [capturedFrames, setCapturedFrames] = useState<string[]>([]);
  const [sessions, setSessions] = useState<PhotoSession[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [filterStack, setFilterStack] = useState<string[]>(['none']);
  
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isFlashing, setIsFlashing] = useState(false);
  const [isCountingDown, setIsCountingDown] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [error, setError] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const livePreviewCanvasRef = useRef<HTMLCanvasElement>(null);
  const redCubeRef = useRef<HTMLImageElement | null>(null);
  const curtainRef = useRef<HTMLImageElement | null>(null);
  const requestRef = useRef<number>(undefined);

  useEffect(() => {
    const redImg = new Image();
    redImg.src = '/red-cube-final-bg.jpg';
    redCubeRef.current = redImg;

    const curtainImg = new Image();
    curtainImg.src = '/curtain-bg.jpg';
    curtainRef.current = curtainImg;
  }, []);

  const getPixelsFilters = useCallback((camera: CameraModel, style: ShootingStyle) => {
    const stack: string[] = [];
    switch (camera) {
      case 'Normal': break;
      case 'SX-70': stack.push('rosetint'); break;
      case '600 Series': stack.push('mellow'); break;
      case 'Spectra': stack.push('solange'); break;
      case 'Go': stack.push('serenity'); break;
      case 'Rollfilm': stack.push('twenties'); break;
      case 'Packfilm': stack.push('vintage'); break;
      case 'i-Type': stack.push('neue'); break;
      case 'Flip': stack.push('invert'); break;
      case 'I-2': stack.push('incbrightness'); break;
      case 'Impulse': stack.push('warmth'); break;
    }
    switch (style) {
      case 'standard': break;
      case 'FQS': stack.push('sunset'); break;
      case 'OFM': stack.push('greyscale'); break;
      case 'retro-grain': stack.push('vintage'); break;
      case 'cyberpunk': stack.push('ocean'); break;
      case 'vivid': stack.push('eclectic'); break;
      case 'dreamy': stack.push('perfume'); break;
      case 'noir': stack.push('twenties'); break;
    }
    return stack.length > 0 ? stack : ['none'];
  }, []);

  useEffect(() => {
    setFilterStack(getPixelsFilters(cameraModel, shootingStyle));
  }, [cameraModel, shootingStyle, getPixelsFilters]);

  const startCamera = useCallback(async () => {
    try {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      
      const constraints = {
        video: { 
          facingMode: facingMode,
          width: { ideal: 1080 }, 
          height: { ideal: 1080 } 
        },
        audio: false
      };
      
      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(newStream);
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }
    } catch (err) {
      console.error("Camera error:", err);
      setError(`Camera access denied`);
    }
  }, [facingMode]);

  useEffect(() => {
    if (step === 'shooting') {
      startCamera();
    }
    return () => {
      if (stream) stream.getTracks().forEach(track => track.stop());
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [step, startCamera]);

  // LIVE FILTER PREVIEW ENGINE
  const renderLivePreview = useCallback(() => {
    const video = videoRef.current;
    const canvas = livePreviewCanvasRef.current;
    if (!video || !canvas || video.readyState < 2) {
      requestRef.current = requestAnimationFrame(renderLivePreview);
      return;
    }

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Draw mirrored video
    ctx.save();
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.restore();

    // Apply filters if Pixels.js is available and filters are not 'none'
    if (window.pixelsJS && filterStack[0] !== 'none') {
      let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      filterStack.forEach(f => {
        imageData = window.pixelsJS.filterImgData(imageData, f);
      });
      ctx.putImageData(imageData, 0, 0);
    }

    requestRef.current = requestAnimationFrame(renderLivePreview);
  }, [filterStack]);

  useEffect(() => {
    if (step === 'shooting') {
      requestRef.current = requestAnimationFrame(renderLivePreview);
    }
  }, [step, renderLivePreview]);

  const captureFrame = async () => {
    const liveCanvas = livePreviewCanvasRef.current;
    const finalCanvas = canvasRef.current;
    if (!liveCanvas || !finalCanvas) return;

    setIsFlashing(true);
    setTimeout(() => setIsFlashing(false), 300);

    const frameUrl = liveCanvas.toDataURL('image/jpeg', 0.9);
    setCapturedFrames(prev => {
      const next = [...prev, frameUrl];
      if (next.length === frameCount) {
        setTimeout(() => {
          generateStrip(next);
          setStep('lab');
          confetti({ particleCount: 150, spread: 100, origin: { y: 0.6 } });
        }, 800);
      }
      return next;
    });
  };

  const generateStrip = (frames: string[]) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const padding = 40;
    const gap = 20;
    const fw = 800;
    const fh = 600;
    
    canvas.width = fw + (padding * 2);
    canvas.height = (fh * frames.length) + (gap * (frames.length - 1)) + (padding * 2) + 80;
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    let loadedCount = 0;
    frames.forEach((src, i) => {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, padding, padding + (i * (fh + gap)), fw, fh);
        loadedCount++;
        if (loadedCount === frames.length) {
          ctx.fillStyle = '#1a1a1a';
          ctx.font = `italic bold 28px "Courier New"`;
          ctx.textAlign = 'center';
          ctx.fillText(caption || `NOVA BOOTH // ${cameraModel} // ${shootingStyle.toUpperCase()}`, canvas.width / 2, canvas.height - 40);
          const stripUrl = canvas.toDataURL('image/jpeg', 0.9);
          setSessions(current => [{
            id: Math.random().toString(36).substr(2, 9),
            frames: frames,
            style: shootingStyle,
            camera: cameraModel,
            highAngle: highAngle,
            timestamp: Date.now(),
            stripUrl: stripUrl
          }, ...current]);
        }
      };
      img.src = src;
    });
  };

  const runCaptureSequence = () => {
    if (isCountingDown || capturedFrames.length >= frameCount) return;
    setCapturedFrames([]);
    let currentIdx = 0;
    const startOne = () => {
      setIsCountingDown(true);
      setCountdown(3);
      const timer = setInterval(() => {
        setCountdown(c => {
          if (c <= 1) {
            clearInterval(timer);
            setIsCountingDown(false);
            captureFrame();
            currentIdx++;
            if (currentIdx < frameCount) {
              setTimeout(startOne, 2000); 
            }
            return 3;
          }
          return c - 1;
        });
      }, 1000);
    };
    startOne();
  };

  const handleDownload = (session: PhotoSession) => {
    const link = document.createElement('a');
    link.href = session.stripUrl || session.frames[0];
    link.download = `nova-strip-${session.id}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleShare = async (session: PhotoSession) => {
    const url = session.stripUrl || session.frames[0];
    if (navigator.share) {
      try {
        const res = await fetch(url);
        const blob = await res.blob();
        const file = new File([blob], `nova-booth-${session.id}.jpg`, { type: 'image/jpeg' });
        await navigator.share({ files: [file], title: 'Nova Booth', text: `Check out my photobooth strip!` });
      } catch (err) { console.error("Share failed", err); }
    } else {
      handleDownload(session);
    }
  };

  const cameras: CameraModel[] = ['Normal', 'SX-70', '600 Series', 'Spectra', 'i-Type', 'Go', 'Rollfilm', 'Packfilm', 'Flip', 'I-2', 'Impulse'];
  const styles: ShootingStyle[] = ['standard', 'classic', 'FQS', 'OFM', 'retro-grain', 'cyberpunk', 'vivid', 'dreamy', 'noir'];

  return (
    <div className="fixed inset-0 bg-[#f4e4bc] flex flex-col overflow-hidden safe-top safe-bottom touch-none font-mono">
      <canvas ref={canvasRef} className="hidden" />

      {/* --- REALISTIC VINTAGE SETUP --- */}
      {step === 'setup' && (
        <div className="flex-1 flex flex-col items-center justify-center p-4 animate-in fade-in duration-500 overflow-y-auto">
          <div className="booth-container">
            <div className="booth-frame-outer">
              <div className="booth-frame-inner">
                <div className="booth-gold-trim" />
                
                <div className="booth-sign-main">Photographs</div>
                
                <div className="flex border-t-8 border-[#0c0c0c]">
                  {/* Left Panel */}
                  <div className="w-24 border-r-8 border-[#0c0c0c] flex flex-col">
                    <div className="booth-paper-sign text-center border-b-4 border-[#0c0c0c]">
                      <div className="text-3xl font-black">3</div>
                      <div className="text-[8px] font-black uppercase">for $1.50</div>
                    </div>
                    <div className="flex-1 p-2 bg-[#d6ded9] flex flex-col gap-1 opacity-40">
                       {Array.from({length: 6}).map((_, i) => (
                         <div key={i} className="w-full aspect-[3/4] bg-neutral-800" />
                       ))}
                    </div>
                  </div>

                  {/* Entrance / Curtain */}
                  <div className="flex-1 booth-curtain-container flex items-center justify-center">
                    <div className="booth-curtain-fabric" />
                    <button 
                      onClick={() => setStep('shooting')}
                      className="absolute z-10 bg-white text-black font-black px-6 py-4 border-4 border-black shadow-[6px_6px_0px_black] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all uppercase italic text-lg tracking-tighter"
                    >
                      Step Inside
                    </button>
                  </div>

                  {/* Right Panel */}
                  <div className="w-20 border-l-8 border-[#0c0c0c] bg-[#d6ded9] p-2 flex flex-col items-center text-[10px] font-black uppercase tracking-tighter leading-none text-neutral-600">
                    <div className="mt-4">W<br/>H<br/>I<br/>L<br/>E</div>
                    <div className="text-3xl my-6 text-neutral-800">U</div>
                    <div>W<br/>A<br/>I<br/>T</div>
                  </div>
                </div>

                <div className="flex h-40 border-t-8 border-[#0c0c0c]">
                  <div className="flex-1 booth-panel-mint flex items-center justify-center border-r-8 border-[#0c0c0c]">
                    <div className="booth-metal-plate w-20 h-24 p-2 flex flex-col items-center justify-center text-[6px] font-black uppercase text-red-600">
                       <div className="booth-screw top-1 left-1" />
                       <div className="booth-screw top-1 right-1" />
                       <div className="booth-screw bottom-1 left-1" />
                       <div className="booth-screw bottom-1 right-1" />
                       <div className="mb-1">READY</div>
                       <div className="mb-1">TO</div>
                       <div className="text-xs text-black">FLASH</div>
                       <Zap size={14} className="mt-1 text-black" />
                    </div>
                  </div>
                  <div className="w-32 booth-panel-mint relative">
                    {/* Stool leg */}
                    <div className="absolute bottom-4 right-8 w-1 h-20 bg-black/80" />
                    <div className="absolute bottom-24 right-4 w-10 h-2 bg-black/80 rounded-full" />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <p className="mt-8 text-[8px] font-black uppercase tracking-[0.2em] text-neutral-500 opacity-50">Precision AI Sequence // Model 2026</p>
        </div>
      )}

      {/* --- NATIVE MOBILE SHOOTING PAGE --- */}
      {step === 'shooting' && (
        <div className="flex-1 flex flex-col bg-black animate-in zoom-in duration-300">
           {/* Hidden Video for stream processing */}
           <video ref={videoRef} autoPlay playsInline muted className="hidden" />

           {/* Live Feed - Native App Feel */}
           <div className="flex-1 relative flex flex-col items-center justify-center overflow-hidden">
              <canvas ref={livePreviewCanvasRef} className="w-full h-full object-cover" />
              
              {isFlashing && <div className="absolute inset-0 bg-white z-50 camera-flash" />}
              
              {isCountingDown && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 z-40">
                  <span className="text-white text-9xl font-black italic animate-ping">{countdown}</span>
                </div>
              )}
              
              <div className="absolute top-0 left-0 right-0 p-4 safe-top flex justify-between items-center pointer-events-none">
                 <div className="bg-black/50 backdrop-blur-md px-3 py-1 rounded-full text-[10px] text-white font-black uppercase tracking-widest border border-white/20">
                   {capturedFrames.length < frameCount ? `SHOT ${capturedFrames.length + 1} / ${frameCount}` : 'COMPLETE'}
                 </div>
                 <button onClick={() => setStep('setup')} className="p-2 bg-black/50 rounded-full text-white pointer-events-auto border border-white/20">
                   <X size={20} />
                 </button>
              </div>
           </div>

           {/* Native Style Controls */}
           <div className="control-bar-horizontal">
              <div>
                <p className="text-[8px] font-black text-white/40 uppercase mb-2 tracking-widest">Hardware Profile</p>
                <div className="horizontal-scroller">
                  {cameras.map(c => (
                    <button key={c} onClick={() => setCameraModel(c)} className={cn(
                      "pill-button",
                      cameraModel === c && "active"
                    )}>{c}</button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[8px] font-black text-white/40 uppercase mb-2 tracking-widest">Visual Style</p>
                <div className="horizontal-scroller">
                  {styles.map(s => (
                    <button key={s} onClick={() => setShootingStyle(s)} className={cn(
                      "pill-button",
                      shootingStyle === s && "active"
                    )}>{s}</button>
                  ))}
                </div>
              </div>
           </div>

           <div className="shooting-footer safe-bottom">
              <div className="flex-1 flex justify-center">
                 <button onClick={() => setFacingMode(prev => prev === 'user' ? 'environment' : 'user')} className="p-4 text-white/60">
                    <RefreshCw size={24} />
                 </button>
              </div>
              
              <div className="flex-1 flex justify-center">
                 <button 
                  onClick={runCaptureSequence} 
                  disabled={isCountingDown || capturedFrames.length >= frameCount} 
                  className="shutter-btn"
                 />
              </div>

              <div className="flex-1 flex justify-center">
                 <button onClick={() => setHighAngle(!highAngle)} className={cn(
                    "p-4 transition-colors",
                    highAngle ? "text-red-500" : "text-white/60"
                 )}>
                    <ChevronUp size={24} />
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* --- LAB (RESULTS) --- */}
      {step === 'lab' && (
        <div className="flex-1 flex flex-col p-4 overflow-y-auto overscroll-contain animate-in slide-in-from-bottom duration-500">
          <header className="text-center py-8">
            <h2 className="text-4xl font-black text-neutral-900 uppercase italic tracking-tighter">DEVELOPED</h2>
            <div className="h-1 w-20 bg-black mx-auto mt-2" />
          </header>

          <div className="flex-1 flex flex-col items-center gap-12 pb-32">
             {sessions.map(session => (
               <div key={session.id} className="flex flex-col items-center gap-6 w-full max-w-sm">
                 <div className="bg-white p-4 shadow-xl border border-black/10">
                    <div className="flex flex-col gap-4">
                      {session.frames.map((frame, i) => (
                        <div key={i} className="aspect-[4/3] bg-neutral-900 overflow-hidden">
                          <img src={frame} className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                    <div className="pt-6 text-center border-t border-dashed border-neutral-300 mt-4">
                       <p className="text-[9px] font-black text-neutral-500 uppercase tracking-widest">
                          {session.camera} // {session.style.toUpperCase()} // {new Date(session.timestamp).toLocaleTimeString()}
                       </p>
                    </div>
                 </div>
                 <div className="flex gap-4">
                    <button onClick={() => handleDownload(session)} className="bg-white p-4 rounded-full shadow-lg border-2 border-black active:scale-95 transition-transform"><Download size={20} /></button>
                    <button onClick={() => handleShare(session)} className="bg-white p-4 rounded-full shadow-lg border-2 border-black active:scale-95 transition-transform"><Share2 size={20} /></button>
                    <button onClick={() => setSessions(prev => prev.filter(s => s.id !== session.id))} className="bg-white p-4 rounded-full shadow-lg border-2 border-black text-red-500 active:scale-95 transition-transform"><Trash2 size={20} /></button>
                 </div>
               </div>
             ))}
          </div>
          
          <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-[#f4e4bc] to-transparent pointer-events-none">
            <button onClick={() => { setCapturedFrames([]); setStep('setup'); }} className="w-full max-w-md mx-auto bg-black text-white py-6 rounded-full border-4 border-black shadow-2xl flex items-center justify-center gap-3 active:scale-95 transition-all pointer-events-auto uppercase italic font-black">
              New Session
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
