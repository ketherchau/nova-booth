"use client";

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Camera, RefreshCw, Download, Trash2, Share2, Sparkles, Ghost, Palette, Sun, Moon, Zap, ChevronUp, Loader2, Image as ImageIcon, Settings2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import confetti from 'canvas-confetti';

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

interface PhotoSession {
  id: string;
  frames: string[];
  style: ShootingStyle;
  camera: CameraModel;
  highAngle: boolean;
  timestamp: number;
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
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [capturedFrames, setCapturedFrames] = useState<string[]>([]);
  const [sessions, setSessions] = useState<PhotoSession[]>([]);
  
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isFlashing, setIsFlashing] = useState(false);
  const [isCountingDown, setIsCountingDown] = useState(false);
  const [countdown, setCountdown] = useState(3);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const livePreviewCanvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(undefined);

  const filterStack = useMemo(() => {
    const stack: string[] = [];
    switch (cameraModel) {
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
    switch (shootingStyle) {
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
  }, [cameraModel, shootingStyle]);

  const startCamera = useCallback(async () => {
    try {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      const constraints = {
        video: { facingMode, width: { ideal: 720 }, height: { ideal: 720 } },
        audio: false
      };
      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(newStream);
      if (videoRef.current) videoRef.current.srcObject = newStream;
    } catch (err) { console.error("Camera error:", err); }
  }, [facingMode]);

  useEffect(() => {
    if (step === 'shooting') startCamera();
    return () => {
      if (stream) stream.getTracks().forEach(track => track.stop());
    };
  }, [step, startCamera]);

  const renderLivePreview = useCallback(() => {
    const video = videoRef.current;
    const canvas = livePreviewCanvasRef.current;
    if (!video || !canvas || video.readyState < 2) {
      requestRef.current = requestAnimationFrame(renderLivePreview);
      return;
    }

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    if (canvas.width !== 480) {
        canvas.width = 480;
        canvas.height = 480 * (video.videoHeight / video.videoWidth);
    }
    
    ctx.save();
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.restore();

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
    } else if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
    }
    return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
  }, [step, renderLivePreview]);

  const captureFrame = async () => {
    const liveCanvas = livePreviewCanvasRef.current;
    if (!liveCanvas) return;
    setIsFlashing(true);
    setTimeout(() => setIsFlashing(false), 300);
    const frameUrl = liveCanvas.toDataURL('image/jpeg', 0.8);
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
    const padding = 40, gap = 20, fw = 800, fh = 600;
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
          ctx.fillText(`NOVA BOOTH // ${cameraModel} // ${shootingStyle.toUpperCase()}`, canvas.width / 2, canvas.height - 40);
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
            if (currentIdx < frameCount) setTimeout(startOne, 2000); 
            return 3;
          }
          return c - 1;
        });
      }, 1000);
    };
    startOne();
  };

  const cameras: CameraModel[] = ['Normal', 'SX-70', '600 Series', 'Spectra', 'i-Type', 'Go', 'Rollfilm', 'Packfilm', 'Flip', 'I-2', 'Impulse'];
  const styles: ShootingStyle[] = ['standard', 'classic', 'FQS', 'OFM', 'retro-grain', 'cyberpunk', 'vivid', 'dreamy', 'noir'];

  return (
    <div className="fixed inset-0 bg-[#f4e4bc] flex flex-col overflow-hidden safe-top safe-bottom touch-none font-mono">
      {/* --- ROUNDED VINTAGE SETUP --- */}
      {step === 'setup' && (
        <div className="flex-1 flex flex-col items-center justify-center p-4 animate-in fade-in duration-500">
          <div className="booth-container">
            <div className="booth-frame-outer">
              <div className="booth-frame-inner">
                <div className="booth-sign-main">Photographs</div>
                
                <div className="flex flex-1 border-t-8 border-[#0c0c0c]">
                  <div className="w-20 border-r-8 border-[#0c0c0c] flex flex-col">
                    <div className="booth-paper-sign text-center border-b-4 border-[#0c0c0c] py-4">
                      <div className="text-3xl font-black">3</div>
                      <div className="text-[7px] font-black uppercase">for $1.50</div>
                    </div>
                    <div className="flex-1 p-2 bg-[#d6ded9] flex flex-col gap-1 opacity-20">
                       {Array.from({length: 4}).map((_, i) => (
                         <div key={i} className="w-full aspect-[3/4] bg-neutral-800" />
                       ))}
                    </div>
                  </div>

                  <div className="flex-1 booth-curtain-container flex items-center justify-center">
                    <div className="booth-curtain-fabric" />
                    <button 
                      onClick={() => setStep('shooting')}
                      className="absolute z-10 bg-white text-black font-black px-6 py-4 border-4 border-black rounded-xl shadow-[6px_6px_0px_black] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all uppercase italic text-lg tracking-tighter"
                    >
                      Step Inside
                    </button>
                  </div>

                  <div className="w-16 border-l-8 border-[#0c0c0c] bg-[#d6ded9] p-2 flex flex-col items-center text-[8px] font-black uppercase tracking-tighter leading-none text-neutral-600">
                    <div className="mt-4">W<br/>H<br/>I<br/>L<br/>E</div>
                    <div className="text-2xl my-4 text-neutral-800">U</div>
                    <div>W<br/>A<br/>I<br/>T</div>
                  </div>
                </div>

                <div className="flex h-32 border-t-8 border-[#0c0c0c] booth-panel-mint">
                  <div className="flex-1 flex items-center justify-center border-r-8 border-[#0c0c0c]">
                    <div className="booth-metal-plate w-16 h-20 rounded-lg flex flex-col items-center justify-center text-[5px] font-black uppercase text-red-600">
                       <div className="mb-1 text-xs text-black">FLASH</div>
                       <Zap size={14} className="text-black" />
                    </div>
                  </div>
                  <div className="w-24 relative">
                    <div className="absolute bottom-4 right-8 w-1 h-16 bg-black/80" />
                    <div className="absolute bottom-20 right-4 w-8 h-1.5 bg-black/80 rounded-full" />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <p className="mt-4 text-[7px] font-black uppercase tracking-[0.3em] text-neutral-500 opacity-40">Nova Interactive // Est. 2026</p>
        </div>
      )}

      {/* --- NATIVE MOBILE SHOOTING PAGE --- */}
      {step === 'shooting' && (
        <div className="flex-1 flex flex-col bg-black animate-in zoom-in duration-300">
           <video ref={videoRef} autoPlay playsInline muted className="hidden" />
           <div className="flex-1 relative flex flex-col items-center justify-center overflow-hidden">
              <canvas ref={livePreviewCanvasRef} className="w-full h-full object-cover" />
              {isFlashing && <div className="absolute inset-0 bg-white z-50" />}
              {isCountingDown && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 z-40">
                  <span className="text-white text-9xl font-black italic">{countdown}</span>
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

           <div className="control-bar-horizontal">
              <div>
                <p className="text-[8px] font-black text-white/40 uppercase mb-2 tracking-widest">Hardware</p>
                <div className="horizontal-scroller">
                  {cameras.map(c => (
                    <button key={c} onClick={() => setCameraModel(c)} className={cn("pill-button", cameraModel === c && "active")}>{c}</button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[8px] font-black text-white/40 uppercase mb-2 tracking-widest">Style</p>
                <div className="horizontal-scroller">
                  {styles.map(s => (
                    <button key={s} onClick={() => setShootingStyle(s)} className={cn("pill-button", shootingStyle === s && "active")}>{s}</button>
                  ))}
                </div>
              </div>
           </div>

           <div className="shooting-footer safe-bottom">
              <div className="flex-1 flex justify-center"><button onClick={() => setFacingMode(prev => prev === 'user' ? 'environment' : 'user')} className="p-4 text-white/60"><RefreshCw size={24} /></button></div>
              <div className="flex-1 flex justify-center"><button onClick={runCaptureSequence} disabled={isCountingDown || capturedFrames.length >= frameCount} className="shutter-btn" /></div>
              <div className="flex-1 flex justify-center"><button onClick={() => setHighAngle(!highAngle)} className={cn("p-4 transition-colors", highAngle ? "text-red-500" : "text-white/60")}><ChevronUp size={24} /></button></div>
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
                 </div>
                 <div className="flex gap-4">
                    <button onClick={() => {
                        const link = document.createElement('a');
                        link.href = session.stripUrl || session.frames[0];
                        link.download = `strip-${session.id}.jpg`;
                        link.click();
                    }} className="bg-white p-4 rounded-full shadow-lg border-2 border-black"><Download size={20} /></button>
                    <button onClick={async () => {
                        if (navigator.share) {
                            const res = await fetch(session.stripUrl || session.frames[0]);
                            const blob = await res.blob();
                            const file = new File([blob], `booth-${session.id}.jpg`, { type: 'image/jpeg' });
                            navigator.share({ files: [file], title: 'Nova Booth' });
                        }
                    }} className="bg-white p-4 rounded-full shadow-lg border-2 border-black"><Share2 size={20} /></button>
                    <button onClick={() => setSessions(prev => prev.filter(s => s.id !== session.id))} className="bg-white p-4 rounded-full shadow-lg border-2 border-black text-red-500"><Trash2 size={20} /></button>
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
