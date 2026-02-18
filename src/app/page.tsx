"use client";

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Camera, RefreshCw, Download, Trash2, Upload, Share2, Grid, Layers, Zap, ArrowRight, LayoutGrid } from 'lucide-react';
import { cn } from '@/lib/utils';
import confetti from 'canvas-confetti';

type ShootingStyle = 'classic' | 'FQS' | 'OFM' | 'retro-grain';

interface PhotoSession {
  id: string;
  frames: string[]; // URLs of captured frames
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
        video: { facingMode: 'user', width: 1080, height: 1080 },
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

  // --- SHOOTING LOGIC ---
  const captureFrame = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    setIsFlashing(true);
    setTimeout(() => setIsFlashing(false), 300);

    const ctx = canvas.getContext('2d');
    if (ctx) {
      canvas.width = 800;
      canvas.height = 600; // Classic 4:3 for photobooth strips
      
      // Mirror
      ctx.translate(800, 0);
      ctx.scale(-1, 1);
      
      const videoRatio = video.videoWidth / video.videoHeight;
      const targetRatio = 800 / 600;
      
      let sourceWidth, sourceHeight, sourceX, sourceY;
      if (videoRatio > targetRatio) {
        sourceHeight = video.videoHeight;
        sourceWidth = video.videoHeight * targetRatio;
        sourceX = (video.videoWidth - sourceWidth) / 2;
        sourceY = 0;
      } else {
        sourceWidth = video.videoWidth;
        sourceHeight = video.videoWidth / targetRatio;
        sourceX = 0;
        sourceY = (video.videoHeight - sourceHeight) / 2;
      }

      ctx.drawImage(video, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, 800, 600);
      
      // Apply CSS Filters based on style
      const frameUrl = canvas.toDataURL('image/jpeg', 0.9);
      setCapturedFrames(prev => [...prev, frameUrl]);
    }
  };

  const startSequence = () => {
    if (isCountingDown) return;
    setCapturedFrames([]);
    runCaptureCycle(0);
  };

  const runCaptureCycle = (index: number) => {
    if (index >= frameCount) {
      setTimeout(() => setStep('lab'), 1000);
      return;
    }

    setIsCountingDown(true);
    setCountdown(3);

    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          setIsCountingDown(false);
          captureFrame();
          // Schedule next capture
          setTimeout(() => runCaptureCycle(index + 1), 1000);
          return 3;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // --- FINISH SESSION ---
  useEffect(() => {
    if (step === 'lab' && capturedFrames.length === frameCount) {
      const newSession: PhotoSession = {
        id: Math.random().toString(36).substr(2, 9),
        frames: capturedFrames,
        style: shootingStyle,
        timestamp: Date.now()
      };
      setSessions(prev => [newSession, ...prev]);
      confetti({ particleCount: 150, spread: 100, origin: { y: 0.6 } });
    }
  }, [step]);

  // --- RENDER HELPERS ---
  const getStyleClass = (style: ShootingStyle) => {
    switch (style) {
      case 'FQS': return 'sepia contrast-125';
      case 'OFM': return 'grayscale brightness-110 contrast-125';
      case 'retro-grain': return 'saturate-150 contrast-110 brightness-105';
      default: return 'brightness-105 contrast-105';
    }
  };

  return (
    <div className="min-h-screen bg-neutral-100 flex flex-col items-center">
      {/* 1. SETUP PAGE */}
      {step === 'setup' && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 max-w-xl w-full text-center space-y-10">
          <header>
            <h1 className="text-6xl font-black italic tracking-tighter text-neutral-900">NOVA BOOTH</h1>
            <p className="text-neutral-500 uppercase tracking-widest text-sm mt-2">Personalize Your Sequence</p>
          </header>

          <div className="w-full space-y-8 bg-white p-8 rounded-[40px] shadow-2xl border border-neutral-200">
            <div className="space-y-4">
              <label className="text-xs font-bold text-neutral-400 uppercase flex items-center gap-2">
                <Layers size={14} /> Shooting Style
              </label>
              <div className="grid grid-cols-2 gap-3">
                {(['classic', 'FQS', 'OFM', 'retro-grain'] as ShootingStyle[]).map(style => (
                  <button 
                    key={style}
                    onClick={() => setShootingStyle(style)}
                    className={cn(
                      "py-4 px-2 rounded-2xl border-2 transition-all font-bold text-sm",
                      shootingStyle === style ? "bg-blue-600 border-blue-600 text-white shadow-lg" : "border-neutral-100 bg-neutral-50 text-neutral-600 hover:border-neutral-300"
                    )}
                  >
                    {style.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-xs font-bold text-neutral-400 uppercase flex items-center gap-2">
                <Grid size={14} /> Frame Count
              </label>
              <div className="flex justify-between gap-3">
                {[1, 2, 3, 4].map(num => (
                  <button 
                    key={num}
                    onClick={() => setFrameCount(num)}
                    className={cn(
                      "flex-1 py-4 rounded-2xl border-2 transition-all font-black text-xl",
                      frameCount === num ? "bg-neutral-900 border-neutral-900 text-white" : "border-neutral-100 bg-neutral-50 text-neutral-600 hover:border-neutral-300"
                    )}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>

            <button 
              onClick={() => setStep('shooting')}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-6 rounded-3xl flex items-center justify-center gap-3 text-xl transition-all active:scale-95 shadow-xl"
            >
              JACK IN <ArrowRight />
            </button>
          </div>
        </div>
      )}

      {/* 2. SHOOTING PAGE (The Camera Body UI) */}
      {step === 'shooting' && (
        <div className="flex-1 flex flex-col items-center py-12 px-4 w-full">
           <div className="relative w-full max-w-[500px] aspect-[4/5.5] retro-body rounded-[50px] p-8 flex flex-col items-center border-b-[16px] border-neutral-300">
              {/* Header Details */}
              <div className="w-full flex justify-between px-6 mb-8">
                 <div className="w-12 h-12 bg-neutral-800 rounded-lg border-2 border-neutral-600 shadow-inner flex items-center justify-center">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                 </div>
                 <div className="w-10 h-24 rainbow-stripe rounded-full opacity-80" />
              </div>

              {/* Viewfinder / Lens */}
              <div className="relative w-72 h-72 rounded-full bg-black border-[12px] border-neutral-200 shadow-2xl overflow-hidden">
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1] opacity-70 mix-blend-screen" />
                
                {isFlashing && <div className="absolute inset-0 bg-white camera-flash z-50" />}
                {isCountingDown && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-40 backdrop-blur-[2px]">
                    <span className="text-white text-9xl font-black italic">{countdown}</span>
                  </div>
                )}
                
                <div className="absolute inset-0 border-[40px] border-black/20 pointer-events-none" />
              </div>

              {/* Shutter Button */}
              <div className="mt-12 flex flex-col items-center gap-4">
                 <button 
                  onClick={startSequence}
                  disabled={isCountingDown}
                  className="w-24 h-24 rounded-full bg-red-600 border-b-8 border-red-800 active:border-b-0 active:translate-y-2 shadow-2xl transition-all flex items-center justify-center"
                 >
                   <div className="w-16 h-16 rounded-full border-4 border-red-400/30" />
                 </button>
                 <p className="text-[10px] font-black tracking-[0.2em] text-neutral-400 uppercase">Shutter Release</p>
              </div>

              {/* Current Progress Strip */}
              <div className="absolute -right-12 top-1/4 flex flex-col gap-2 scale-75 lg:scale-100">
                {Array.from({ length: frameCount }).map((_, i) => (
                  <div key={i} className="w-16 h-12 bg-white p-1 shadow-lg rounded-sm border border-neutral-200">
                    {capturedFrames[i] ? (
                      <img src={capturedFrames[i]} className={cn("w-full h-full object-cover", getStyleClass(shootingStyle))} />
                    ) : (
                      <div className="w-full h-full bg-neutral-100 flex items-center justify-center text-[10px] font-bold text-neutral-300">
                        {i + 1}
                      </div>
                    )}
                  </div>
                ))}
              </div>
           </div>
           
           <button onClick={() => setStep('setup')} className="mt-8 text-neutral-400 font-bold flex items-center gap-2 hover:text-neutral-900 transition-colors">
              <RefreshCw size={16} /> Reset Configuration
           </button>
        </div>
      )}

      {/* 3. LAB PAGE (The Result Strip & Polaroid) */}
      {step === 'lab' && (
        <div className="flex-1 w-full max-w-6xl p-6 py-12 flex flex-col items-center space-y-12">
          <header className="text-center">
            <h2 className="text-4xl font-black text-neutral-900">FILM STRIP</h2>
            <p className="text-neutral-500 uppercase tracking-widest text-xs mt-1">Successfully Developed</p>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12 items-start">
             {sessions.map(session => (
               <div key={session.id} className="flex flex-col items-center space-y-6">
                 {/* The Vertical Photobooth Strip */}
                 <div className="photobooth-strip w-64">
                    {session.frames.map((frame, i) => (
                      <div key={i} className="strip-photo">
                        <img src={frame} className={cn("w-full h-full object-cover", getStyleClass(session.style))} />
                      </div>
                    ))}
                    <div className="py-2 text-center border-t border-neutral-100 mt-2">
                       <p className="text-[10px] font-black text-neutral-300 italic">NOVA BOOTH // {session.style.toUpperCase()}</p>
                    </div>
                 </div>

                 {/* Controls */}
                 <div className="flex gap-4">
                    <button onClick={() => {
                      const link = document.createElement('a');
                      link.href = session.frames[0]; // Temporary: download first frame
                      link.download = `nova-${session.id}.jpg`;
                      link.click();
                    }} className="bg-white p-3 rounded-full shadow-lg text-blue-600 hover:scale-110 transition-all"><Download size={20} /></button>
                    
                    <button className="bg-white p-3 rounded-full shadow-lg text-emerald-600 hover:scale-110 transition-all"><Share2 size={20} /></button>
                    
                    <button onClick={() => {
                      setSessions(prev => prev.filter(s => s.id !== session.id));
                      if (sessions.length <= 1) setStep('setup');
                    }} className="bg-white p-3 rounded-full shadow-lg text-red-600 hover:scale-110 transition-all"><Trash2 size={20} /></button>
                 </div>
               </div>
             ))}
          </div>

          <button 
            onClick={() => { setStep('setup'); setCapturedFrames([]); }}
            className="fixed bottom-8 bg-neutral-900 text-white px-8 py-4 rounded-full font-black shadow-2xl flex items-center gap-2 hover:scale-105 transition-all"
          >
            <Camera size={20} /> TAKE MORE SHOTS
          </button>
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
