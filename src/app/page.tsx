"use client";

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Camera, RefreshCw, Download, Trash2, Share2, Layers, Grid, ArrowRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import confetti from 'canvas-confetti';

type ShootingStyle = 'classic' | 'FQS' | 'OFM' | 'retro-grain';

interface PhotoSession {
  id: string;
  frames: string[];
  style: ShootingStyle;
  timestamp: number;
}

export default function PhotoBooth() {
  const [step, setStep] = useState<'setup' | 'shooting' | 'lab'>('setup');
  const [shootingStyle, setShootingStyle] = useState<ShootingStyle>('classic');
  const [frameCount, setFrameCount] = useState<number>(4);
  const [capturedFrames, setCapturedFrames] = useState<string[]>([]);
  const [sessions, setSessions] = useState<PhotoSession[]>([]);
  
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isFlashing, setIsFlashing] = useState(false);
  const [isCountingDown, setIsCountingDown] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [error, setError] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // --- CAMERA LOGIC ---
  const startCamera = useCallback(async () => {
    try {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'user', 
          width: { ideal: 1080 }, 
          height: { ideal: 1080 } 
        },
        audio: false
      });
      setStream(newStream);
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }
      setError(null);
    } catch (err) {
      console.error("Camera error:", err);
      setError("Camera access denied. Please check permissions.");
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

  // --- SHOOTING LOGIC ---
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
      
      const frameUrl = canvas.toDataURL('image/jpeg', 0.9);
      setCapturedFrames(prev => {
        const next = [...prev, frameUrl];
        // If this was the last frame, transition to lab
        if (next.length === frameCount) {
          setTimeout(() => {
            setSessions(current => [{
              id: Math.random().toString(36).substr(2, 9),
              frames: next,
              style: shootingStyle,
              timestamp: Date.now()
            }, ...current]);
            setStep('lab');
            confetti({ particleCount: 150, spread: 100, origin: { y: 0.6 } });
          }, 1000);
        }
        return next;
      });
    }
  };

  const runCaptureSequence = () => {
    if (isCountingDown) return;
    
    let currentIdx = capturedFrames.length;
    if (currentIdx >= frameCount) return;

    const startOne = () => {
      setIsCountingDown(true);
      setCountdown(3);

      const timer = setInterval(() => {
        setCountdown(c => {
          if (c <= 1) {
            clearInterval(timer);
            setIsCountingDown(false);
            captureFrame();
            
            // Trigger next one if needed
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

  const handleShare = async (session: PhotoSession) => {
    if (navigator.share) {
      try {
        const res = await fetch(session.frames[0]);
        const blob = await res.blob();
        const file = new File([blob], `nova-booth-${session.id}.jpg`, { type: 'image/jpeg' });
        await navigator.share({
          files: [file],
          title: 'Nova Booth',
          text: 'Check out my photobooth sequence! 📸',
        });
      } catch (err) { console.error(err); }
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
    <div className="min-h-screen bg-stone-100 flex flex-col items-center">
      <canvas ref={canvasRef} className="hidden" />

      {/* --- SETUP --- */}
      {step === 'setup' && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 max-w-xl w-full space-y-10">
          <header className="text-center">
            <h1 className="text-6xl font-black italic tracking-tighter text-neutral-900">NOVA BOOTH</h1>
            <p className="text-neutral-500 uppercase tracking-[0.3em] text-xs mt-2">Initialize Sequence</p>
          </header>

          <div className="w-full space-y-8 bg-white p-8 rounded-[40px] shadow-2xl border border-stone-200">
            <div className="space-y-4">
              <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest flex items-center gap-2">
                <Layers size={12} /> Shooting Style
              </label>
              <div className="grid grid-cols-2 gap-3">
                {(['classic', 'FQS', 'OFM', 'retro-grain'] as ShootingStyle[]).map(s => (
                  <button key={s} onClick={() => setShootingStyle(s)} className={cn(
                    "py-4 rounded-2xl border-2 transition-all font-bold text-sm",
                    shootingStyle === s ? "bg-blue-600 border-blue-600 text-white shadow-lg" : "border-stone-100 bg-stone-50 text-stone-600"
                  )}>{s.toUpperCase()}</button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest flex items-center gap-2">
                <Grid size={12} /> Frame Count
              </label>
              <div className="flex gap-3">
                {[1, 2, 3, 4].map(n => (
                  <button key={n} onClick={() => setFrameCount(n)} className={cn(
                    "flex-1 py-4 rounded-2xl border-2 transition-all font-black text-xl",
                    frameCount === n ? "bg-neutral-900 border-neutral-900 text-white" : "border-stone-100 bg-stone-50 text-stone-600"
                  )}>{n}</button>
                ))}
              </div>
            </div>

            <button onClick={() => { setCapturedFrames([]); setStep('shooting'); }} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-6 rounded-3xl flex items-center justify-center gap-3 text-xl transition-all active:scale-95 shadow-xl">
              JACK IN <ArrowRight />
            </button>
          </div>
        </div>
      )}

      {/* --- SHOOTING --- */}
      {step === 'shooting' && (
        <div className="flex-1 flex flex-col items-center py-12 px-4 w-full">
           <div className="relative w-full max-w-[500px] aspect-[4/5.5] retro-body rounded-[50px] p-8 flex flex-col items-center border-b-[16px] border-stone-300">
              <div className="w-full flex justify-between px-6 mb-8">
                 <div className="w-12 h-12 bg-stone-800 rounded-lg border-2 border-stone-600 flex items-center justify-center">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                 </div>
                 <div className="w-10 h-24 rainbow-stripe rounded-full opacity-80" />
              </div>

              <div className="relative w-72 h-72 rounded-full bg-black border-[12px] border-stone-200 shadow-2xl overflow-hidden">
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
                {isFlashing && <div className="absolute inset-0 bg-white z-50" />}
                {isCountingDown && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-40 backdrop-blur-sm">
                    <span className="text-white text-9xl font-black italic">{countdown}</span>
                  </div>
                )}
              </div>

              <div className="mt-12 flex flex-col items-center gap-4">
                 <button 
                  onClick={runCaptureSequence}
                  disabled={isCountingDown || capturedFrames.length >= frameCount}
                  className="w-24 h-24 rounded-full bg-red-600 border-b-8 border-red-800 active:border-b-0 active:translate-y-2 shadow-2xl flex items-center justify-center disabled:opacity-50"
                 >
                   <div className="w-16 h-16 rounded-full border-4 border-red-400/30" />
                 </button>
                 <p className="text-[10px] font-black tracking-[0.2em] text-stone-400 uppercase">
                    {capturedFrames.length < frameCount ? `Capture ${capturedFrames.length + 1} of ${frameCount}` : 'Sequence Complete'}
                 </p>
              </div>

              <div className="absolute -right-12 top-1/4 flex flex-col gap-2 scale-75 lg:scale-100">
                {Array.from({ length: frameCount }).map((_, i) => (
                  <div key={i} className="w-16 h-12 bg-white p-1 shadow-lg rounded-sm border border-stone-200">
                    {capturedFrames[i] ? (
                      <img src={capturedFrames[i]} className="w-full h-full object-cover" style={{ filter: getStyleClass(shootingStyle) }} />
                    ) : (
                      <div className="w-full h-full bg-stone-100 flex items-center justify-center text-[10px] font-bold text-stone-300">{i + 1}</div>
                    )}
                  </div>
                ))}
              </div>
           </div>
           
           <button onClick={() => setStep('setup')} className="mt-8 text-stone-400 font-bold flex items-center gap-2 hover:text-stone-900 transition-colors">
              <RefreshCw size={16} /> Reset
           </button>
        </div>
      )}

      {/* --- LAB --- */}
      {step === 'lab' && (
        <div className="flex-1 w-full max-w-6xl p-6 py-12 flex flex-col items-center space-y-12">
          <header className="text-center">
            <h2 className="text-4xl font-black text-stone-900">FILM STRIP</h2>
            <p className="text-stone-500 uppercase tracking-widest text-xs mt-1 italic">Developed at Nova Lab</p>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12 items-start w-full">
             {sessions.map(session => (
               <div key={session.id} className="flex flex-col items-center space-y-6">
                 <div className="photobooth-strip w-64 p-3 bg-white shadow-2xl">
                    {session.frames.map((frame, i) => (
                      <div key={i} className="strip-photo mb-3 last:mb-0 aspect-[4/3] bg-stone-900 overflow-hidden">
                        <img src={frame} className="w-full h-full object-cover" style={{ filter: getStyleClass(session.style) }} />
                      </div>
                    ))}
                    <div className="py-2 text-center border-t border-stone-100 mt-2">
                       <p className="text-[9px] font-black text-stone-300 italic uppercase">NOVA BOOTH // {session.style} // {new Date(session.timestamp).toLocaleTimeString()}</p>
                    </div>
                 </div>

                 <div className="flex gap-4">
                    <button onClick={() => {
                      const link = document.createElement('a');
                      link.href = session.frames[0];
                      link.download = `nova-${session.id}.jpg`;
                      link.click();
                    }} className="bg-white p-3 rounded-full shadow-lg text-blue-600 hover:scale-110 transition-all"><Download size={20} /></button>
                    <button onClick={() => handleShare(session)} className="bg-white p-3 rounded-full shadow-lg text-emerald-600 hover:scale-110 transition-all"><Share2 size={20} /></button>
                    <button onClick={() => setSessions(prev => prev.filter(s => s.id !== session.id))} className="bg-white p-3 rounded-full shadow-lg text-red-600 hover:scale-110 transition-all"><Trash2 size={20} /></button>
                 </div>
               </div>
             ))}
          </div>

          <div className="h-24" />
          <button 
            onClick={() => { setCapturedFrames([]); setStep('setup'); }}
            className="fixed bottom-8 bg-neutral-900 text-white px-8 py-4 rounded-full font-black shadow-2xl flex items-center gap-2 hover:scale-105 transition-all z-[100]"
          >
            <Camera size={20} /> TAKE MORE SHOTS
          </button>
        </div>
      )}
    </div>
  );
}
