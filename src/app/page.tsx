"use client";

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Camera, RefreshCw, Download, Trash2, Share2, Layers, Grid, ArrowRight, Sparkles, Ghost, Palette, Sun, Moon, Zap, ChevronUp, Loader2, Image as ImageIcon } from 'lucide-react';
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
      
      // APPLY ZOOM IF SUPPORTED
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

        const personWidth = canvas.width * 0.75; // Scaled up to 0.75
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

      {step === 'setup' && (
        <div className="flex-1 flex flex-col p-4 md:p-8 overflow-y-auto overscroll-contain animate-in fade-in duration-500 touch-pan-y">
          <div className="max-w-2xl mx-auto w-full space-y-8">
            <div className="vbooth-frame p-1 mt-4">
              <div className="vbooth-marquee">PHOTOS</div>
            </div>

            <div className="sketch-card p-6 md:p-8 space-y-8">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="space-y-4 flex-1 w-full">
                  <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest flex items-center gap-2">
                    <Camera size={12} className="text-blue-500" /> Hardware
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {cameras.map(c => (
                      <button key={c} onClick={() => setCameraModel(c)} className={cn(
                        "py-2 rounded border-2 transition-all text-[8px] font-black uppercase",
                        cameraModel === c ? "bg-black border-black text-white" : "border-neutral-100 bg-white text-neutral-500"
                      )}>{c}</button>
                    ))}
                  </div>
                </div>
                
                <div className="flex gap-4 w-full md:w-auto">
                  <div className="space-y-4 flex-1">
                    <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest flex items-center gap-2">
                      <ChevronUp size={12} className="text-red-500" /> High Angle
                    </label>
                    <button onClick={() => setHighAngle(!highAngle)} className={cn(
                      "w-full h-16 rounded border-4 transition-all flex flex-col items-center justify-center",
                      highAngle ? "bg-red-500 border-black text-white shadow-[4px_4px_0px_black]" : "bg-white border-neutral-100 text-neutral-300"
                    )}>
                      <span className="text-[10px] font-black uppercase">{highAngle ? 'ON' : 'OFF'}</span>
                    </button>
                  </div>
                  <div className="space-y-4 flex-1">
                    <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest flex items-center gap-2">
                      <RefreshCw size={12} className="text-emerald-500" /> Camera
                    </label>
                    <div className="flex flex-col gap-2">
                      <button onClick={() => setFacingMode(prev => prev === 'user' ? 'environment' : 'user')} className={cn(
                        "w-full h-12 rounded border-4 transition-all flex flex-col items-center justify-center",
                        facingMode === 'environment' ? "bg-black border-black text-white shadow-[4px_4px_0px_black]" : "bg-white border-neutral-100 text-neutral-300"
                      )}>
                        <span className="text-[8px] font-black uppercase">{facingMode === 'user' ? 'FRONT' : 'BACK'}</span>
                      </button>
                      <div className="flex gap-2">
                        {[0.5, 1].map(z => (
                          <button key={z} onClick={() => setZoomLevel(z)} className={cn(
                            "flex-1 h-8 rounded border-2 text-[8px] font-black transition-all",
                            zoomLevel === z ? "bg-emerald-500 border-black text-white" : "bg-white border-neutral-100 text-neutral-300"
                          )}>{z}X</button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {highAngle && (
                <div className="space-y-4 animate-in slide-in-from-top duration-300">
                  <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest flex items-center gap-2">
                    <ImageIcon size={12} className="text-red-500" /> Environment
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <button onClick={() => setHighAngleBG('red-cube')} className={cn(
                      "py-3 rounded border-2 font-black uppercase text-[10px] transition-all",
                      highAngleBG === 'red-cube' ? "bg-red-500 border-black text-white shadow-[3px_3px_0px_black]" : "border-neutral-100 bg-white text-neutral-500"
                    )}>Red Cube</button>
                    <button onClick={() => setHighAngleBG('curtain')} className={cn(
                      "py-3 rounded border-2 font-black uppercase text-[10px] transition-all",
                      highAngleBG === 'curtain' ? "bg-slate-500 border-black text-white shadow-[3px_3px_0px_black]" : "border-neutral-100 bg-white text-neutral-500"
                    )}>Curtain</button>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest flex items-center gap-2">
                  <Layers size={12} className="text-blue-500" /> Styles
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(Object.keys(styleIcons) as ShootingStyle[]).map(s => {
                    const Icon = styleIcons[s];
                    return (
                      <button key={s} onClick={() => setShootingStyle(s)} className={cn(
                        "flex flex-col items-center gap-1 py-3 rounded border-2 transition-all",
                        shootingStyle === s ? "bg-blue-500 border-black text-white shadow-[2px_2px_0px_black]" : "border-neutral-100 bg-white text-neutral-500"
                      )}>
                        <Icon size={14} />
                        <span className="text-[8px] font-black uppercase">{s}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="flex gap-6">
                <div className="flex-1 space-y-4">
                  <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest flex items-center gap-2">
                    <Grid size={12} className="text-blue-500" /> Frames
                  </label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4].map(n => (
                      <button key={n} onClick={() => setFrameCount(n)} className={cn(
                        "flex-1 py-3 rounded border-2 transition-all font-black",
                        frameCount === n ? "bg-black border-black text-white" : "border-neutral-100 bg-white text-neutral-500"
                      )}>{n}</button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <button onClick={() => { setCapturedFrames([]); setStep('shooting'); }} className="w-full bg-blue-500 text-white font-black py-6 rounded border-4 border-black shadow-[8px_8px_0px_black] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all text-2xl italic tracking-tighter uppercase">
              Start Session
            </button>
          </div>
        </div>
      )}

      {/* --- SHOOTING --- */}
      {step === 'shooting' && (
        <div className="flex-1 flex flex-col p-4 animate-in zoom-in duration-300">
           <div className="flex-1 flex flex-col items-center justify-center max-w-[450px] mx-auto w-full">
              <div className="w-full vbooth-frame p-2 mb-6">
                 <div className="vbooth-marquee text-lg">LIVE FEED</div>
              </div>
              
              <div className="relative w-full aspect-square retro-body p-4 flex flex-col items-center shadow-2xl overflow-hidden">
                <div className={cn(
                  "w-full h-full border-4 border-black overflow-hidden relative",
                  highAngle ? "bg-red-900" : "bg-black"
                )}>
                  <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1] opacity-90" />
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

                <div className="vbooth-checkered-floor absolute bottom-0 left-0 right-0" />
              </div>

              <div className="mt-8 flex flex-col items-center gap-2">
                 <button onClick={runCaptureSequence} disabled={isCountingDown || isProcessing || capturedFrames.length >= frameCount} className="w-20 h-20 rounded-full bg-red-600 border-4 border-black shadow-[0_8px_0px_#450a0a] active:translate-y-2 active:shadow-none transition-all disabled:opacity-50" />
                 <p className="text-[10px] font-black uppercase mt-4">{isProcessing ? 'Developing...' : (capturedFrames.length < frameCount ? `Shot ${capturedFrames.length + 1} / ${frameCount}` : 'Done!')}</p>
              </div>

              <button onClick={() => { if(stream) stream.getTracks().forEach(t => t.stop()); setStep('setup'); }} className="mt-8 text-neutral-400 font-black flex items-center gap-2 uppercase tracking-widest text-[10px]">
                <RefreshCw size={12} /> Cancel
              </button>
           </div>
        </div>
      )}

      {/* --- LAB --- */}
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
                      <div key={i} className="strip-photo flex items-center justify-center min-h-[400px]">
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
