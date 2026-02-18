"use client";

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Camera, RefreshCw, Download, Trash2, Share2, Layers, Grid, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import confetti from 'canvas-confetti';

type ShootingStyle = 'classic' | 'FQS' | 'OFM' | 'retro-grain';

interface PhotoSession {
  id: string;
  frames: string[];
  style: ShootingStyle;
  timestamp: number;
  caption?: string;
  stripUrl?: string;
}

export default function PhotoBooth() {
  const [step, setStep] = useState<'setup' | 'shooting' | 'lab'>('setup');
  const [shootingStyle, setShootingStyle] = useState<ShootingStyle>('classic');
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
      
      const filter = getStyleClass(shootingStyle);
      if (filter !== 'none') {
        ctx.filter = filter;
        ctx.drawImage(canvas, 0, 0);
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
          const bottomText = caption || `NOVA BOOTH // ${shootingStyle.toUpperCase()}`;
          ctx.fillText(bottomText, canvas.width / 2, canvas.height - 40);

          const stripUrl = canvas.toDataURL('image/jpeg', 0.9);
          setSessions(current => [{
            id: Math.random().toString(36).substr(2, 9),
            frames: frames,
            style: shootingStyle,
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
          text: 'Check out my photobooth strip! 📸',
        });
      } catch (err) { console.error("Share failed", err); }
    } else {
      handleDownload(session);
    }
  };

  const getStyleClass = (style: ShootingStyle) => {
    switch (style) {
      case 'FQS': return 'sepia(0.5) contrast(1.2) brightness(1.1)';
      case 'OFM': return 'grayscale(1) contrast(1.3) brightness(1.1)';
      case 'retro-grain': return 'saturate(1.5) contrast(1.1) brightness(1.1)';
      default: return 'none';
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center">
      <canvas ref={canvasRef} className="hidden" />

      {step === 'setup' && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 max-w-xl w-full space-y-10 animate-in fade-in zoom-in duration-500">
          <header className="text-center relative">
            <div className="absolute -top-6 -left-12 rotate-[-15deg] opacity-20 hidden md:block">
               <Camera size={80} className="text-blue-500" />
            </div>
            <h1 className="text-7xl font-black italic tracking-tighter text-neutral-900 filter drop-shadow-lg">NOVA BOOTH</h1>
            <p className="text-neutral-500 uppercase tracking-[0.4em] text-xs mt-2 font-black">Sketch Your Moment</p>
          </header>

          <div className="w-full space-y-8 sketch-card p-10 border-4 border-black">
            <div className="space-y-4">
              <label className="text-xs font-black text-neutral-400 uppercase tracking-widest flex items-center gap-2">
                <Layers size={14} className="text-blue-500" /> Shooting Style
              </label>
              <div className="grid grid-cols-2 gap-4">
                {(['classic', 'FQS', 'OFM', 'retro-grain'] as ShootingStyle[]).map(s => (
                  <button key={s} onClick={() => setShootingStyle(s)} className={cn(
                    "py-4 px-2 rounded-xl border-3 transition-all font-black text-sm",
                    shootingStyle === s ? "bg-blue-500 border-black text-white shadow-[4px_4px_0px_black] -translate-x-1 -translate-y-1" : "border-neutral-200 bg-white text-neutral-600 hover:border-black"
                  )}>{s.toUpperCase()}</button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-xs font-black text-neutral-400 uppercase tracking-widest flex items-center gap-2">
                <Grid size={14} className="text-blue-500" /> Frame Count
              </label>
              <div className="flex gap-4">
                {[1, 2, 3, 4].map(n => (
                  <button key={n} onClick={() => setFrameCount(n)} className={cn(
                    "flex-1 py-4 rounded-xl border-3 transition-all font-black text-xl",
                    frameCount === n ? "bg-black border-black text-white shadow-[4px_4px_0px_rgba(0,0,0,0.3)] -translate-x-1 -translate-y-1" : "border-neutral-200 bg-white text-neutral-600 hover:border-black"
                  )}>{n}</button>
                ))}
              </div>
            </div>

            <div className="space-y-4 text-left">
              <label className="text-xs font-black text-neutral-400 uppercase tracking-widest flex items-center gap-2">
                <Camera size={14} className="text-blue-500" /> Custom Caption
              </label>
              <input 
                type="text" 
                value={caption} 
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Hand-write something here..."
                className="w-full px-5 py-4 rounded-xl border-3 border-black bg-white text-sm font-bold focus:shadow-[4px_4px_0px_#3b82f6] outline-none transition-all placeholder:text-neutral-300"
              />
            </div>

            <button onClick={() => { setCapturedFrames([]); setStep('shooting'); }} className="w-full bg-blue-500 hover:bg-blue-600 text-white font-black py-6 rounded-2xl flex items-center justify-center gap-3 text-2xl transition-all active:scale-95 border-3 border-black shadow-[6px_6px_0px_black] hover:shadow-[4px_4px_0px_black] hover:-translate-x-1 hover:-translate-y-1">
              JACK IN <ArrowRight />
            </button>
          </div>
        </div>
      )}

      {/* --- SHOOTING --- */}
      {step === 'shooting' && (
        <div className="flex-1 flex flex-col items-center py-12 px-4 w-full animate-in zoom-in duration-300">
           <div className="relative w-full max-w-[500px] aspect-[4/5.8] retro-body p-8 flex flex-col items-center">
              <div className="w-full flex justify-between px-6 mb-8">
                 <div className="w-14 h-14 bg-neutral-800 rounded-xl border-4 border-black flex items-center justify-center">
                    <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse shadow-[0_0_10px_red]" />
                 </div>
                 <div className="w-10 h-24 rainbow-stripe" />
              </div>

              <div className="relative w-80 h-80 rounded-full bg-black border-8 border-black shadow-2xl overflow-hidden ring-12 ring-white/50">
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1] opacity-80 mix-blend-screen" />
                {isFlashing && <div className="absolute inset-0 bg-white z-50" />}
                {isCountingDown && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-40 backdrop-blur-[2px]">
                    <span className="text-white text-[12rem] font-black italic drop-shadow-[0_10px_10px_black]">{countdown}</span>
                  </div>
                )}
                <div className="absolute inset-0 border-[30px] border-black/10 pointer-events-none" />
              </div>

              <div className="mt-12 flex flex-col items-center gap-4">
                 <button 
                  onClick={runCaptureSequence} 
                  disabled={isCountingDown || capturedFrames.length >= frameCount} 
                  className="w-24 h-24 rounded-full bg-red-500 border-4 border-black active:shadow-inner active:translate-y-1 shadow-[0_8px_0px_#991b1b] flex items-center justify-center disabled:opacity-50"
                 >
                   <div className="w-16 h-16 rounded-full border-4 border-white/20" />
                 </button>
                 <p className="text-xs font-black tracking-widest text-neutral-400 uppercase">
                    {capturedFrames.length < frameCount ? `Take Shot ${capturedFrames.length + 1} of ${frameCount}` : 'Sequence Done!'}
                 </p>
              </div>

              <div className="absolute -right-16 top-1/4 flex flex-col gap-3 scale-75 lg:scale-110">
                {Array.from({ length: frameCount }).map((_, i) => (
                  <div key={i} className="w-20 h-16 bg-white p-1 shadow-[5px_5px_0px_rgba(0,0,0,0.1)] rounded-sm border-2 border-black rotate-[-2deg] odd:rotate-[2deg]">
                    {capturedFrames[i] ? (
                      <img src={capturedFrames[i]} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-neutral-50 flex items-center justify-center text-xs font-black text-neutral-200 italic">{i + 1}</div>
                    )}
                  </div>
                ))}
              </div>
           </div>
           <button onClick={() => setStep('setup')} className="mt-12 text-neutral-400 font-black flex items-center gap-2 hover:text-black transition-colors uppercase tracking-widest text-xs">
              <RefreshCw size={14} /> Back to Setup
           </button>
        </div>
      )}

      {/* --- LAB --- */}
      {step === 'lab' && (
        <div className="flex-1 w-full max-w-6xl p-6 py-12 flex flex-col items-center space-y-12 animate-in slide-in-from-bottom duration-500">
          <header className="text-center">
            <h2 className="text-5xl font-black text-neutral-900 uppercase italic drop-shadow-sm">LAB RESULTS</h2>
            <p className="text-neutral-400 uppercase tracking-[0.4em] text-[10px] mt-2 font-black italic">Hand-crafted at Nova Studio</p>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-16 items-start w-full">
             {sessions.map(session => (
               <div key={session.id} className="flex flex-col items-center space-y-8 animate-in zoom-in duration-500">
                 <div className="photobooth-strip w-72 p-4 bg-white border-4 border-black shadow-[15px_15px_0px_rgba(0,0,0,0.05)] transform hover:rotate-0 transition-transform duration-300">
                    {session.frames.map((frame, i) => (
                      <div key={i} className="strip-photo mb-3 last:mb-0 aspect-[4/3] bg-neutral-900 border-2 border-black">
                        <img src={frame} className="w-full h-full object-cover" />
                      </div>
                    ))}
                    <div className="py-4 text-center border-t-3 border-black mt-3">
                       <p className="text-sm font-black text-neutral-800 italic uppercase">
                          {session.caption || `NOVA BOOTH // ${session.style}`}
                       </p>
                    </div>
                 </div>
                 <div className="flex gap-4">
                    {isDesktop && (
                      <button onClick={() => handleDownload(session)} className="bg-white p-4 rounded-xl shadow-[4px_4px_0px_black] text-blue-500 border-3 border-black hover:-translate-y-1 active:translate-y-0 active:shadow-none transition-all"><Download size={24} /></button>
                    )}
                    <button onClick={() => handleShare(session)} className="bg-white p-4 rounded-xl shadow-[4px_4px_0px_black] text-emerald-500 border-3 border-black hover:-translate-y-1 active:translate-y-0 active:shadow-none transition-all"><Share2 size={24} /></button>
                    <button onClick={() => setSessions(prev => prev.filter(s => s.id !== session.id))} className="bg-white p-4 rounded-xl shadow-[4px_4px_0px_black] text-red-500 border-3 border-black hover:-translate-y-1 active:translate-y-0 active:shadow-none transition-all"><Trash2 size={24} /></button>
                 </div>
               </div>
             ))}
          </div>
          <button onClick={() => { setCapturedFrames([]); setCaption(''); setStep('setup'); }} className="fixed bottom-10 bg-black text-white px-10 py-5 rounded-2xl font-black shadow-[8px_8px_0px_#3b82f6] border-3 border-black flex items-center gap-3 hover:scale-105 transition-all z-[100] uppercase italic tracking-tighter">
            <Camera size={24} /> Take More Shots
          </button>
        </div>
      )}
    </div>
  );
}
