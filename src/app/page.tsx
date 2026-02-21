"use client";

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Camera, RefreshCw, Download, Trash2, Share2, Layers, Grid, Sparkles, Ghost, Palette, Sun, Moon, Zap, ChevronUp, Loader2, Image as ImageIcon, Settings2 } from 'lucide-react';
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
  const [isDesktop, setIsDesktop] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isFlashing, setIsFlashing] = useState(false);
  const [isCountingDown, setIsCountingDown] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [error, setError] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const redCubeRef = useRef<HTMLImageElement | null>(null);
  const curtainRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const checkIsDesktop = () => setIsDesktop(window.innerWidth >= 1024);
    checkIsDesktop();
    window.addEventListener('resize', checkIsDesktop);

    const redImg = new Image();
    redImg.src = '/red-cube-final-bg.jpg';
    redCubeRef.current = redImg;

    const curtainImg = new Image();
    curtainImg.src = '/curtain-bg.jpg';
    curtainRef.current = curtainImg;

    return () => window.removeEventListener('resize', checkIsDesktop);
  }, []);

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
      
      const track = newStream.getVideoTracks()[0];
      const capabilities = track.getCapabilities() as any;
      if (capabilities.zoom) {
        try {
          await (track as any).applyConstraints({ advanced: [{ zoom: zoomLevel }] });
        } catch (e) {
          console.warn("Zoom not supported by browser/hardware constraints:", e);
        }
      }

      setStream(newStream);
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
        videoRef.current.load();
      }
      setError(null);
    } catch (err) {
      console.error("Camera error:", err);
      setError(`Camera access denied: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [facingMode, zoomLevel]);

  useEffect(() => {
    if (step === 'shooting') {
      startCamera();
    }
    return () => {
      if (stream) stream.getTracks().forEach(track => track.stop());
    };
  }, [step, facingMode, startCamera]);

  const captureFrame = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    setIsFlashing(true);
    setTimeout(() => setIsFlashing(false), 300);

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (ctx) {
      const rawCanvas = document.createElement('canvas');
      rawCanvas.width = 800;
      rawCanvas.height = 600;
      const rawCtx = rawCanvas.getContext('2d');
      if (!rawCtx) return;

      rawCtx.translate(800, 0);
      rawCtx.scale(-1, 1);
      
      const videoRatio = video.videoWidth / video.videoHeight;
      const targetRatio = 800 / 600;
      
      let sw, sh, sx, sy;
      if (highAngle) {
        if (videoRatio > targetRatio) {
          sw = video.videoWidth;
          sh = video.videoWidth / targetRatio;
          sx = 0;
          sy = (video.videoHeight - sh) / 2;
        } else {
          sh = video.videoHeight;
          sw = video.videoHeight * targetRatio;
          sx = (video.videoWidth - sw) / 2;
          sy = 0;
        }
      } else {
        if (videoRatio > targetRatio) {
          sh = video.videoHeight;
          sw = video.videoHeight * targetRatio;
          sx = (video.videoWidth - sw) / 2;
          sy = 0;
        } else {
          sw = video.videoWidth;
          sh = video.videoWidth / targetRatio;
          sx = 0;
          sy = (video.videoHeight - sh) / 2;
        }
      }
      rawCtx.drawImage(video, sx, sy, sw, sh, 0, 0, 800, 600);

      let finalFrameSource: CanvasImageSource | Blob = rawCanvas;

      if (highAngle) {
        setIsProcessing(true);
        try {
          const blob = await new Promise<Blob>((resolve) => rawCanvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.95));
          const removedBgBlob = await removeBackground(blob, {
            progress: (step, progress) => console.log(`BG Removal: ${step} ${Math.round(progress * 100)}%`),
            model: 'isnet_fp16'
          });
          const img = new Image();
          const url = URL.createObjectURL(removedBgBlob);
          await new Promise((resolve) => {
            img.onload = resolve;
            img.src = url;
          });
          finalFrameSource = img;
        } catch (err) {
          console.error("BG Removal Error:", err);
        } finally {
          setIsProcessing(false);
        }
      }

      const activeBP = highAngleBG === 'red-cube' ? redCubeRef.current : curtainRef.current;

      if (highAngle && activeBP) {
        canvas.width = activeBP.width;
        canvas.height = activeBP.height;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(activeBP, 0, 0);

        const personWidth = canvas.width * 0.9;
        const personHeight = personWidth * (600 / 800);
        const px = (canvas.width - personWidth) / 2;
        const py = (canvas.height - personHeight) / 2 - (canvas.height * 0.05); 

        ctx.save();
        const maskCanvas = document.createElement('canvas');
        maskCanvas.width = personWidth;
        maskCanvas.height = personHeight;
        const maskCtx = maskCanvas.getContext('2d');
        if (maskCtx) {
          maskCtx.drawImage(finalFrameSource as any, 0, 0, personWidth, personHeight);
          maskCtx.globalCompositeOperation = 'destination-in';
          const bottomFade = maskCtx.createLinearGradient(0, 0, 0, personHeight);
          bottomFade.addColorStop(0, 'rgba(0,0,0,1)');
          bottomFade.addColorStop(0.95, 'rgba(0,0,0,1)');
          bottomFade.addColorStop(1, 'rgba(0,0,0,0)');
          maskCtx.fillStyle = bottomFade;
          maskCtx.fillRect(0, 0, personWidth, personHeight);
          ctx.drawImage(maskCanvas, px, py);
        }
        ctx.restore();
      } else {
        canvas.width = 800;
        canvas.height = 600;
        ctx.clearRect(0, 0, 800, 600);
        ctx.drawImage(finalFrameSource as any, 0, 0, 800, 600);
      }
      
      try {
        if (window.pixelsJS) {
          const filters = getPixelsFilters(cameraModel, shootingStyle);
          let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          filters.forEach(filterName => {
            if (filterName !== 'none') {
              imageData = window.pixelsJS.filterImgData(imageData, filterName);
            }
          });
          ctx.putImageData(imageData, 0, 0);
        }
      } catch (err) {
        console.error("Pixels.js error:", err);
      }
      
      const frameUrl = canvas.toDataURL('image/jpeg', 0.9);
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
    }
  };

  const getPixelsFilters = (camera: CameraModel, style: ShootingStyle) => {
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
  };

  const generateStrip = (frames: string[]) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const padding = 40;
    const gap = 20;
    let finalFrameWidth = 800;
    let finalFrameHeight = 600;
    const activeBP = highAngleBG === 'red-cube' ? redCubeRef.current : curtainRef.current;
    if (highAngle && activeBP) {
      finalFrameWidth = activeBP.width;
      finalFrameHeight = activeBP.height;
    }
    canvas.width = finalFrameWidth + (padding * 2);
    canvas.height = (finalFrameHeight * frames.length) + (gap * (frames.length - 1)) + (padding * 2) + 80;
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    let loadedCount = 0;
    frames.forEach((src, i) => {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, padding, padding + (i * (finalFrameHeight + gap)), finalFrameWidth, finalFrameHeight);
        loadedCount++;
        if (loadedCount === frames.length) {
          ctx.fillStyle = '#1a1a1a';
          ctx.font = `italic bold ${Math.max(20, finalFrameWidth * 0.035)}px "Courier New"`;
          ctx.textAlign = 'center';
          const bottomText = caption || `NOVA BOOTH // ${cameraModel} // ${shootingStyle.toUpperCase()}`;
          ctx.fillText(bottomText, canvas.width / 2, canvas.height - 40);
          const stripUrl = canvas.toDataURL('image/jpeg', 0.9);
          setSessions(current => [{
            id: Math.random().toString(36).substr(2, 9),
            frames: frames,
            style: shootingStyle,
            camera: cameraModel,
            highAngle: highAngle,
            highAngleBG: highAngleBG,
            timestamp: Date.now(),
            caption: caption,
            stripUrl: stripUrl
          }, ...current]);
        }
      };
      img.src = src;
    });
  };

  const runCaptureSequence = () => {
    if (isCountingDown || isProcessing) return;
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
              setTimeout(startOne, highAngle ? 4000 : 1500); 
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

  const styleIcons: Record<ShootingStyle, any> = {
    standard: Sparkles,
    classic: Camera,
    FQS: Sun,
    OFM: Moon,
    'retro-grain': Ghost,
    'cyberpunk': Zap,
    'vivid': Palette,
    'dreamy': Sparkles,
    'noir': Layers
  };

  const cameras: CameraModel[] = ['Normal', 'SX-70', '600 Series', 'Spectra', 'i-Type', 'Go', 'Rollfilm', 'Packfilm', 'Flip', 'I-2', 'Impulse'];

  return (
    <div className="fixed inset-0 bg-[#f4e4bc] flex flex-col overflow-hidden safe-top safe-bottom touch-none">
      <canvas ref={canvasRef} className="hidden" />

      {/* --- REDESIGNED SETUP (EXTERIOR) --- */}
      {step === 'setup' && (
        <div className="flex-1 flex flex-col items-center justify-center p-4 animate-in fade-in duration-500 overflow-y-auto">
          <div className="photobooth-exterior">
            <div className="photobooth-sign">
              Photographs
            </div>
            
            <div className="photobooth-main-section">
              <div className="photobooth-left-panel">
                <div className="photobooth-price-tag">
                  <div className="number">3</div>
                  <div className="details">for $1.50</div>
                </div>
                <div className="flex-1 border-b-8 border-black p-2 flex flex-col gap-1 overflow-hidden opacity-50">
                  {Array.from({length: 8}).map((_, i) => (
                    <div key={i} className="w-full aspect-[3/4] border-2 border-black bg-white" />
                  ))}
                </div>
              </div>

              <div className="photobooth-entrance">
                <div className="photobooth-curtain" />
                <button 
                  onClick={() => setStep('shooting')}
                  className="photobooth-start-btn bg-white text-black font-black px-8 py-4 border-4 border-black shadow-[6px_6px_0px_black] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all uppercase italic tracking-tighter text-xl"
                >
                  Step Inside
                </button>
              </div>

              <div className="photobooth-right-panel">
                <div className="mt-4">W<br/>H<br/>I<br/>L<br/>E</div>
                <div className="text-4xl my-4">U</div>
                <div>W<br/>A<br/>I<br/>T</div>
              </div>
            </div>

            <div className="photobooth-bottom-section">
              <div className="photobooth-bottom-left">
                <div className="photobooth-flash-box">
                  <div className="mb-1 text-red-500">READY</div>
                  <div className="mb-1 text-red-500">TO</div>
                  <div className="text-xl">FLASH</div>
                  <Zap size={20} className="mt-1" />
                </div>
              </div>
              <div className="photobooth-bottom-right">
                <div className="photobooth-stool" />
              </div>
            </div>
          </div>
          
          <p className="mt-8 text-[10px] font-black uppercase tracking-widest text-neutral-500">
            Nova Interactive AI Photobooth // Ver 2.0
          </p>
        </div>
      )}

      {/* --- SHOOTING (INTERIOR) --- */}
      {step === 'shooting' && (
        <div className="flex-1 flex flex-col animate-in zoom-in duration-300">
           {/* Top Info Bar */}
           <div className="bg-black text-white p-2 px-4 flex justify-between items-center">
              <span className="text-[10px] font-black uppercase tracking-tighter">
                {capturedFrames.length < frameCount ? `FRAME ${capturedFrames.length + 1} / ${frameCount}` : 'ALL FRAMES CAPTURED'}
              </span>
              <button onClick={() => setShowSettings(!showSettings)} className="text-white hover:text-blue-400 transition-colors">
                <Settings2 size={18} />
              </button>
           </div>

           <div className="flex-1 relative flex flex-col items-center justify-center bg-zinc-900 overflow-hidden">
              {/* Live Preview Container */}
              <div className={cn(
                "w-full max-w-[500px] aspect-[4/3] relative overflow-hidden",
                highAngle ? "shadow-[0_0_50px_rgba(239,68,68,0.3)]" : "shadow-[0_0_50px_rgba(0,0,0,0.5)]"
              )}>
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
                
                {isFlashing && <div className="absolute inset-0 bg-white z-50 camera-flash" />}
                
                {isCountingDown && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-40 backdrop-blur-[2px]">
                    <span className="text-white text-9xl font-black italic">{countdown}</span>
                  </div>
                )}
                
                {isProcessing && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 z-50 backdrop-blur-[4px]">
                    <Loader2 className="w-12 h-12 text-white animate-spin mb-4" />
                    <span className="text-white text-xs font-black uppercase tracking-widest">Processing AI...</span>
                  </div>
                )}
              </div>

              {/* LIVE SETTINGS OVERLAY */}
              {showSettings && (
                <div className="absolute bottom-24 left-4 right-4 bg-white/95 backdrop-blur border-4 border-black p-4 z-50 animate-in slide-in-from-bottom-4">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-black text-xs uppercase italic">Live Settings</h3>
                    <button onClick={() => setShowSettings(false)} className="text-xs font-black uppercase underline">Close</button>
                  </div>
                  
                  <div className="space-y-4 max-h-[40vh] overflow-y-auto">
                    {/* Hardware Selection */}
                    <div>
                      <p className="control-group-label">Hardware</p>
                      <div className="grid grid-cols-3 gap-1">
                        {cameras.map(c => (
                          <button key={c} onClick={() => setCameraModel(c)} className={cn(
                            "py-1 rounded border-2 text-[7px] font-black uppercase",
                            cameraModel === c ? "bg-black border-black text-white" : "border-neutral-200 bg-white"
                          )}>{c}</button>
                        ))}
                      </div>
                    </div>

                    {/* Style Selection */}
                    <div>
                      <p className="control-group-label">Style</p>
                      <div className="grid grid-cols-3 gap-1">
                        {(Object.keys(styleIcons) as ShootingStyle[]).map(s => (
                          <button key={s} onClick={() => setShootingStyle(s)} className={cn(
                            "py-1 rounded border-2 text-[7px] font-black uppercase",
                            shootingStyle === s ? "bg-blue-500 border-black text-white" : "border-neutral-200 bg-white"
                          )}>{s}</button>
                        ))}
                      </div>
                    </div>

                    {/* High Angle Toggle */}
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <p className="control-group-label">Angle</p>
                        <button onClick={() => setHighAngle(!highAngle)} className={cn(
                          "w-full py-2 rounded border-2 font-black text-[8px] uppercase",
                          highAngle ? "bg-red-500 text-white border-black" : "bg-white border-neutral-200"
                        )}>High Angle: {highAngle ? 'ON' : 'OFF'}</button>
                      </div>
                      <div className="flex-1">
                        <p className="control-group-label">Frames</p>
                        <div className="flex gap-1">
                          {[1, 2, 3, 4].map(n => (
                            <button key={n} onClick={() => setFrameCount(n)} className={cn(
                              "flex-1 py-2 rounded border-2 font-black text-[8px]",
                              frameCount === n ? "bg-black text-white" : "bg-white border-neutral-200"
                            )}>{n}</button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* SHUTTER BAR */}
              <div className="absolute bottom-0 left-0 right-0 p-6 bg-zinc-800 border-t-4 border-black flex items-center justify-between">
                 <button onClick={() => { if(stream) stream.getTracks().forEach(t => t.stop()); setStep('setup'); }} className="text-white/50 hover:text-white transition-colors">
                    <RefreshCw size={24} />
                 </button>

                 <div className="relative">
                    <button 
                      onClick={runCaptureSequence} 
                      disabled={isCountingDown || isProcessing || capturedFrames.length >= frameCount} 
                      className="w-16 h-16 rounded-full bg-red-600 border-4 border-black shadow-[0_4px_0px_#450a0a] active:translate-y-1 active:shadow-none transition-all disabled:opacity-50" 
                    />
                 </div>

                 <div className="w-6" /> {/* Spacer */}
              </div>
           </div>
        </div>
      )}

      {/* --- LAB (RESULTS) --- */}
      {step === 'lab' && (
        <div className="flex-1 flex flex-col p-4 md:p-10 overflow-y-auto overscroll-contain animate-in slide-in-from-bottom duration-500 touch-pan-y">
          <header className="text-center py-6">
            <h2 className="text-4xl font-black text-neutral-900 uppercase italic tracking-tighter">LAB RESULTS</h2>
            <p className="text-neutral-400 uppercase tracking-widest text-[10px] mt-2 font-black">Vintage Illustration Finish</p>
          </header>

          <div className="flex-1 flex flex-col items-center gap-12 pb-32">
             {sessions.map(session => (
               <div key={session.id} className="flex flex-col items-center gap-6 w-full max-w-sm">
                 <div className="photobooth-strip w-full bg-white">
                    {session.frames.map((frame, i) => (
                      <div key={i} className={cn(
                        "strip-photo flex items-center justify-center",
                        session.highAngle ? "min-h-[400px]" : "aspect-[4/3]"
                      )}>
                        <img src={frame} className="w-full h-auto" />
                      </div>
                    ))}
                    <div className="py-6 text-center">
                       <p className="text-[10px] font-black text-neutral-800 italic uppercase">
                          {caption || `NOVA // ${session.camera} // ${session.style}`}
                       </p>
                    </div>
                 </div>
                 <div className="flex gap-4">
                    <button onClick={() => handleDownload(session)} className="bg-white p-4 rounded shadow-[4px_4px_0px_black] border-2 border-black active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all"><Download size={20} /></button>
                    <button onClick={() => handleShare(session)} className="bg-white p-4 rounded shadow-[4px_4px_0px_black] border-2 border-black active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all"><Share2 size={20} /></button>
                    <button onClick={() => setSessions(prev => prev.filter(s => s.id !== session.id))} className="bg-white p-4 rounded shadow-[4px_4px_0px_black] border-2 border-black active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all text-red-500"><Trash2 size={20} /></button>
                 </div>
               </div>
             ))}
          </div>
          
          <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-[#f4e4bc] via-[#f4e4bc]/90 to-transparent pointer-events-none">
            <button onClick={() => { setCapturedFrames([]); setStep('setup'); }} className="w-full max-w-md mx-auto bg-black text-white py-6 rounded border-4 border-black shadow-[6px_6px_0px_#3b82f6] flex items-center justify-center gap-3 active:translate-y-1 active:shadow-none transition-all pointer-events-auto uppercase italic font-black">
              Return to Booth
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
