"use client";

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Camera, RefreshCw, Download, Trash2, Share2, Layers, Grid, ArrowRight, Sparkles, Ghost, Palette, Sun, Moon, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import confetti from 'canvas-confetti';

type ShootingStyle = 'classic' | 'FQS' | 'OFM' | 'retro-grain' | 'cyberpunk' | 'vivid' | 'dreamy' | 'noir';

type CameraModel = 
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
  timestamp: number;
  caption?: string;
  stripUrl?: string;
}

export default function PhotoBooth() {
  const [step, setStep] = useState<'setup' | 'shooting' | 'lab'>('setup');
  const [shootingStyle, setShootingStyle] = useState<ShootingStyle>('classic');
  const [cameraModel, setCameraModel] = useState<CameraModel>('600 Series');
  const [frameCount, setFrameCount] = useState<number>(4);
  const [caption, setCaption] = useState<string>('');
  const [capturedFrames, setCapturedFrames] = useState<string[]>([]);
  const [sessions, setSessions] = useState<PhotoSession[]>([]);
  const [isDesktop, setIsDesktop] = useState(false);
  
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isFlashing, setIsFlashing] = useState(false);
  const [isCountingDown, setIsCountingDown] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [error, setError] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const checkIsDesktop = () => setIsDesktop(window.innerWidth >= 1024);
    checkIsDesktop();
    window.addEventListener('resize', checkIsDesktop);
    return () => window.removeEventListener('resize', checkIsDesktop);
  }, []);

  const startCamera = useCallback(async () => {
    try {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1080 }, height: { ideal: 1080 } },
        audio: false
      });
      setStream(newStream);
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }
      setError(null);
    } catch (err) {
      console.error("Camera error:", err);
      setError("Camera access denied.");
    }
  }, [stream]);

  useEffect(() => {
    if (step === 'shooting') {
      startCamera();
    }
    return () => {
      if (stream) stream.getTracks().forEach(track => track.stop());
    };
  }, [step]);

  const captureFrame = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    setIsFlashing(true);
    setTimeout(() => setIsFlashing(false), 300);

    const ctx = canvas.getContext('2d');
    if (ctx) {
      canvas.width = 800;
      canvas.height = 600; 
      
      ctx.save();
      ctx.translate(800, 0);
      ctx.scale(-1, 1);
      
      const videoRatio = video.videoWidth / video.videoHeight;
      const targetRatio = 800 / 600;
      
      let sw, sh, sx, sy;
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

      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, 800, 600);
      ctx.restore();
      
      // Combine Camera Characteristics + Shooting Style
      const filter = getCombinedFilter(cameraModel, shootingStyle);
      if (filter !== 'none') {
        ctx.filter = filter;
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        tempCanvas.getContext('2d')?.drawImage(canvas, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(tempCanvas, 0, 0);
        ctx.filter = 'none';
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

  const generateStrip = (frames: string[]) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const frameWidth = 800;
    const frameHeight = 600;
    const padding = 40;
    const gap = 20;

    canvas.width = frameWidth + (padding * 2);
    canvas.height = (frameHeight * frames.length) + (gap * (frames.length - 1)) + (padding * 2) + 80;

    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    let loadedCount = 0;
    frames.forEach((src, i) => {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, padding, padding + (i * (frameHeight + gap)), frameWidth, frameHeight);
        loadedCount++;
        if (loadedCount === frames.length) {
          ctx.fillStyle = '#1a1a1a';
          ctx.font = 'italic bold 28px "Comic Sans MS", cursive';
          ctx.textAlign = 'center';
          const bottomText = caption || `NOVA BOOTH // ${cameraModel} // ${shootingStyle.toUpperCase()}`;
          ctx.fillText(bottomText, canvas.width / 2, canvas.height - 40);

          const stripUrl = canvas.toDataURL('image/jpeg', 0.9);
          setSessions(current => [{
            id: Math.random().toString(36).substr(2, 9),
            frames: frames,
            style: shootingStyle,
            camera: cameraModel,
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
    if (isCountingDown) return;
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
              setTimeout(startOne, 1500);
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
        await navigator.share({
          files: [file],
          title: 'Nova Booth',
          text: `Check out my photobooth strip from the ${session.camera}! 📸`,
        });
      } catch (err) { console.error("Share failed", err); }
    } else {
      handleDownload(session);
    }
  };

  const getCombinedFilter = (camera: CameraModel, style: ShootingStyle) => {
    let base = 'none';
    
    // 1. Apply Camera-specific baseline
    switch (camera) {
      case 'SX-70': base = 'saturate(1.4) contrast(1.2) brightness(1.05) hue-rotate(-5deg)'; break;
      case '600 Series': base = 'saturate(0.9) contrast(0.9) brightness(1.1) sepia(0.1)'; break;
      case 'Spectra': base = 'saturate(0.8) brightness(1.1) hue-rotate(320deg) blur(0.3px)'; break;
      case 'Go': base = 'saturate(0.7) contrast(0.8) brightness(1.2) blur(1px)'; break;
      case 'Rollfilm': base = 'grayscale(1) contrast(1.5) sepia(0.2)'; break;
      case 'Packfilm': base = 'saturate(1.1) contrast(1.1) brightness(1) sepia(0.05)'; break;
      case 'I-2': base = 'saturate(1.2) contrast(1.1) brightness(1.05)'; break;
      case 'Impulse': base = 'saturate(1) contrast(1) brightness(1.1) sepia(0.05)'; break;
      default: base = 'none';
    }

    // 2. Apply Style-specific overlay
    switch (style) {
      case 'FQS': base += ' sepia(0.4) contrast(1.1)'; break;
      case 'OFM': base += ' grayscale(1) contrast(1.2)'; break;
      case 'retro-grain': base += ' saturate(1.3) contrast(1.1) brightness(1.1)'; break;
      case 'cyberpunk': base += ' hue-rotate(280deg) saturate(1.8) contrast(1.1)'; break;
      case 'vivid': base += ' saturate(2) contrast(1.1)'; break;
      case 'dreamy': base += ' blur(0.5px) brightness(1.1) saturate(0.8)'; break;
      case 'noir': base += ' grayscale(1) contrast(2) brightness(0.8)'; break;
    }

    return base;
  };

  const styleIcons: Record<ShootingStyle, any> = {
    classic: Camera,
    FQS: Sun,
    OFM: Moon,
    'retro-grain': Ghost,
    'cyberpunk': Zap,
    'vivid': Palette,
    'dreamy': Sparkles,
    'noir': Layers
  };

  const cameras: CameraModel[] = ['SX-70', '600 Series', 'Spectra', 'i-Type', 'Go', 'Rollfilm', 'Packfilm', 'Flip', 'I-2', 'Impulse'];

  return (
    <div className="fixed inset-0 bg-stone-100 flex flex-col overflow-hidden safe-top safe-bottom">
      <canvas ref={canvasRef} className="hidden" />

      {step === 'setup' && (
        <div className="flex-1 flex flex-col p-4 md:p-10 overflow-y-auto animate-in fade-in duration-500">
          <header className="text-center py-6">
            <h1 className="text-5xl md:text-7xl font-black italic tracking-tighter text-neutral-900">NOVA BOOTH</h1>
            <p className="text-neutral-500 uppercase tracking-[0.4em] text-[10px] md:text-xs mt-2 font-black">Sketch Your Moment</p>
          </header>

          <div className="max-w-xl mx-auto w-full space-y-6 flex-1 flex flex-col">
            <div className="sketch-card p-6 md:p-10 border-4 border-black space-y-8 flex-1">
              
              <div className="space-y-4">
                <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest flex items-center gap-2">
                  <Camera size={12} className="text-blue-500" /> Select Hardware
                </label>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  {cameras.map(c => (
                    <button key={c} onClick={() => setCameraModel(c)} className={cn(
                      "py-2 rounded-lg border-2 transition-all text-[8px] font-black uppercase",
                      cameraModel === c ? "bg-black border-black text-white" : "border-neutral-100 bg-white text-neutral-500"
                    )}>{c}</button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest flex items-center gap-2">
                  <Layers size={12} className="text-blue-500" /> Style Gallery
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(Object.keys(styleIcons) as ShootingStyle[]).map(s => {
                    const Icon = styleIcons[s];
                    return (
                      <button key={s} onClick={() => setShootingStyle(s)} className={cn(
                        "flex flex-col items-center gap-1 py-2 rounded-xl border-2 transition-all",
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
                        "flex-1 py-3 rounded-xl border-2 transition-all font-black text-lg",
                        frameCount === n ? "bg-black border-black text-white" : "border-neutral-100 bg-white text-neutral-500"
                      )}>{n}</button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest flex items-center gap-2">
                  <Sparkles size={12} className="text-blue-500" /> Caption
                </label>
                <input 
                  type="text" 
                  value={caption} 
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Hand-write something..."
                  className="w-full px-5 py-3 rounded-xl border-3 border-black bg-white text-sm font-bold outline-none"
                />
              </div>
            </div>

            <button onClick={() => { setCapturedFrames([]); setStep('shooting'); }} className="w-full bg-blue-500 text-white font-black py-5 rounded-2xl flex items-center justify-center gap-3 text-xl transition-all active:scale-95 border-3 border-black shadow-[6px_6px_0px_black]">
              JACK IN <ArrowRight />
            </button>
          </div>
        </div>
      )}

      {/* --- SHOOTING --- */}
      {step === 'shooting' && (
        <div className="flex-1 flex flex-col p-4 animate-in zoom-in duration-300">
           <div className="flex-1 flex flex-col items-center justify-center max-w-[450px] mx-auto w-full">
              <div className="relative w-full aspect-[4/5.5] retro-body p-6 flex flex-col items-center shadow-2xl">
                <div className="w-full flex justify-between px-4 mb-4">
                   <div className="w-10 h-10 bg-neutral-800 rounded-xl border-4 border-black flex items-center justify-center">
                      <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-[0_0_10px_red]" />
                   </div>
                   <div className="text-[10px] font-black uppercase text-neutral-400 mt-2">{cameraModel}</div>
                   <div className="w-8 h-16 rainbow-stripe" />
                </div>

                <div className="relative w-full aspect-square rounded-full bg-black border-4 md:border-8 border-black shadow-2xl overflow-hidden ring-8 md:ring-12 ring-white/50">
                  <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1] opacity-80 mix-blend-screen" />
                  {isFlashing && <div className="absolute inset-0 bg-white z-50" />}
                  {isCountingDown && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-40 backdrop-blur-[2px]">
                      <span className="text-white text-8xl md:text-[12rem] font-black italic">{countdown}</span>
                    </div>
                  )}
                </div>

                <div className="mt-8 flex flex-col items-center gap-2">
                   <button 
                    onClick={runCaptureSequence} 
                    disabled={isCountingDown || capturedFrames.length >= frameCount} 
                    className="w-16 h-16 md:w-24 md:h-24 rounded-full bg-red-500 border-4 border-black shadow-[0_6px_0px_#991b1b] flex items-center justify-center active:translate-y-1 active:shadow-none transition-all disabled:opacity-50"
                   >
                     <div className="w-10 h-10 md:w-16 md:h-16 rounded-full border-4 border-white/20" />
                   </button>
                   <p className="text-[8px] font-black tracking-widest text-neutral-400 uppercase">
                      {capturedFrames.length < frameCount ? `Take Shot ${capturedFrames.length + 1} of ${frameCount}` : 'Sequence Done!'}
                   </p>
                </div>

                <div className="absolute -right-8 md:-right-16 top-1/4 flex flex-col gap-2 md:gap-3 scale-75 md:scale-100">
                  {Array.from({ length: frameCount }).map((_, i) => (
                    <div key={i} className="w-12 h-10 md:w-20 md:h-16 bg-white p-0.5 md:p-1 shadow-md rounded-sm border border-black rotate-[-2deg] odd:rotate-[2deg]">
                      {capturedFrames[i] ? <img src={capturedFrames[i]} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-neutral-50 flex items-center justify-center text-[8px] font-black text-neutral-200">{i + 1}</div>}
                    </div>
                  ))}
                </div>
              </div>
              <button onClick={() => setStep('setup')} className="mt-8 text-neutral-400 font-black flex items-center gap-2 uppercase tracking-widest text-[10px]">
                <RefreshCw size={12} /> Reset
              </button>
           </div>
        </div>
      )}

      {/* --- LAB --- */}
      {step === 'lab' && (
        <div className="flex-1 flex flex-col p-4 md:p-10 overflow-y-auto animate-in slide-in-from-bottom duration-500">
          <header className="text-center py-6">
            <h2 className="text-4xl md:text-5xl font-black text-neutral-900 uppercase italic">LAB RESULTS</h2>
            <p className="text-neutral-400 uppercase tracking-[0.4em] text-[10px] mt-2 font-black italic">Simulated {cameraModel} Film</p>
          </header>

          <div className="flex-1 flex flex-col items-center gap-10 pb-32">
             {sessions.map(session => (
               <div key={session.id} className="flex flex-col items-center gap-6 w-full max-w-sm">
                 <div className="photobooth-strip w-full p-4 bg-white border-4 border-black shadow-2xl">
                    {session.frames.map((frame, i) => (
                      <div key={i} className="strip-photo mb-3 last:mb-0 aspect-[4/3] bg-neutral-900 border-2 border-black">
                        <img src={frame} className="w-full h-full object-cover" />
                      </div>
                    ))}
                    <div className="py-4 text-center border-t-3 border-black mt-3">
                       <p className="text-xs font-black text-neutral-800 italic uppercase">
                          {session.caption || `NOVA BOOTH // ${session.camera} // ${session.style}`}
                       </p>
                    </div>
                 </div>
                 <div className="flex gap-4">
                    {isDesktop && (
                      <button onClick={() => handleDownload(session)} className="bg-white p-4 rounded-xl shadow-[3px_3px_0px_black] text-blue-500 border-3 border-black hover:-translate-y-0.5"><Download size={20} /></button>
                    )}
                    <button onClick={() => handleShare(session)} className="bg-white p-4 rounded-xl shadow-[3px_3px_0px_black] text-emerald-500 border-3 border-black hover:-translate-y-0.5"><Share2 size={20} /></button>
                    <button onClick={() => setSessions(prev => prev.filter(s => s.id !== session.id))} className="bg-white p-4 rounded-xl shadow-[3px_3px_0px_black] text-red-500 border-3 border-black hover:-translate-y-0.5"><Trash2 size={20} /></button>
                 </div>
               </div>
             ))}
          </div>
          
          <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-stone-100 via-stone-100/90 to-transparent pointer-events-none">
            <button onClick={() => { setCapturedFrames([]); setCaption(''); setStep('setup'); }} className="w-full max-w-md mx-auto bg-black text-white px-10 py-5 rounded-2xl font-black shadow-[6px_6px_0px_#3b82f6] border-3 border-black flex items-center justify-center gap-3 active:scale-95 transition-all pointer-events-auto uppercase italic">
              <Camera size={20} /> Take More Shots
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
