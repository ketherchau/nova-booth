"use client";

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Camera, RefreshCw, Download, Trash2, Share2, Sparkles, Ghost, Palette, Sun, Moon, Zap, ChevronUp, Loader2, Image as ImageIcon, Settings2, X, Heart, Flower, Star, Instagram, Layout } from 'lucide-react';
import { cn } from '@/lib/utils';
import confetti from 'canvas-confetti';

type ShootingStyle = 'standard' | 'classic' | 'FQS' | 'OFM' | 'retro-grain' | 'cyberpunk' | 'vivid' | 'dreamy' | 'noir';

type CameraModel = 
  | 'Normal' | 'SX-70' | '600 Series' | 'Spectra' | 'i-Type' | 'Go' | 'Rollfilm' | 'Packfilm' | 'Flip' | 'I-2' | 'Impulse';

type FrameDesign = 
  | 'classic-strip' | 'polaroid' | 'minimalist' | 'floral' | 'geometric' | 'instagram' | 'glitter' | 'boho' | 'wedding' | 'comic' | 'film-roll'
  | 'harry-potter' | 'portrait' | 'vintage' | 'sunshine';

interface PhotoSession {
  id: string;
  frames: string[];
  style: ShootingStyle;
  camera: CameraModel;
  timestamp: number;
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
  const [frameDesign, setFrameDesign] = useState<FrameDesign>('classic-strip');
  const [frameCount, setFrameCount] = useState<number>(4);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [capturedFrames, setCapturedFrames] = useState<string[]>([]);
  const [sessions, setSessions] = useState<PhotoSession[]>([]);
  const [isCountingDown, setIsCountingDown] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [isFlashing, setIsFlashing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const livePreviewCanvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(undefined);

  const filterStack = useMemo(() => {
    const stack: string[] = [];
    switch (cameraModel) {
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
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      }
      const constraints = { video: { facingMode, width: 720, height: 720 }, audio: false };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) { console.error(err); }
  }, [facingMode]);

  useEffect(() => {
    if (step === 'shooting') startCamera();
    return () => {
      if (videoRef.current?.srcObject) (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
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
      canvas.height = 480;
    }
    ctx.save();
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.restore();
    if (window.pixelsJS && filterStack[0] !== 'none') {
      let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      filterStack.forEach(f => imageData = window.pixelsJS.filterImgData(imageData, f));
      ctx.putImageData(imageData, 0, 0);
    }
    requestRef.current = requestAnimationFrame(renderLivePreview);
  }, [filterStack]);

  useEffect(() => {
    if (step === 'shooting') requestRef.current = requestAnimationFrame(renderLivePreview);
    return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
  }, [step, renderLivePreview]);

  const captureFrame = () => {
    const canvas = livePreviewCanvasRef.current;
    if (!canvas) return;
    setIsFlashing(true);
    setTimeout(() => setIsFlashing(false), 200);
    const url = canvas.toDataURL('image/jpeg', 0.8);
    setCapturedFrames(prev => {
      const next = [...prev, url];
      if (next.length === frameCount) {
        setSessions(s => [{ id: Math.random().toString(36).substr(2, 9), frames: next, style: shootingStyle, camera: cameraModel, timestamp: Date.now() }, ...s]);
        setTimeout(() => { setStep('lab'); confetti(); }, 500);
      }
      return next;
    });
  };

  const runSequence = () => {
    if (isCountingDown) return;
    setCapturedFrames([]);
    const shoot = (idx: number) => {
      setIsCountingDown(true);
      let count = 3;
      setCountdown(count);
      const timer = setInterval(() => {
        count--;
        setCountdown(count);
        if (count === 0) {
          clearInterval(timer);
          setIsCountingDown(false);
          captureFrame();
          if (idx + 1 < frameCount) setTimeout(() => shoot(idx + 1), 1500);
        }
      }, 800);
    };
    shoot(0);
  };

  const generateStrip = async (session: PhotoSession, design: FrameDesign): Promise<string> => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve("");

      const fw = 800;
      const fh = 800; // Fixed square for modern feel, or 4/3 as used in shooting
      const padding = 60;
      const gap = 30;

      // Calculate canvas size based on design
      if (design === 'classic-strip') {
        canvas.width = fw + (padding * 2);
        canvas.height = (fh * session.frames.length) + (gap * (session.frames.length - 1)) + (padding * 2);
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      } else if (design === 'polaroid') {
        canvas.width = fw + (padding * 2);
        canvas.height = (fh * session.frames.length) + (gap * (session.frames.length - 1)) + (padding * 2) + 120; // extra bottom tab
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      } else {
        // Default generic strip
        canvas.width = fw + (padding * 2);
        canvas.height = (fh * session.frames.length) + (gap * (session.frames.length - 1)) + (padding * 2);
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      let loaded = 0;
      session.frames.forEach((src, i) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          const y = padding + (i * (fh + gap));
          ctx.drawImage(img, padding, y, fw, fh);
          loaded++;
          if (loaded === session.frames.length) {
             resolve(canvas.toDataURL('image/jpeg', 0.9));
          }
        };
        img.src = src;
      });
    });
  };

  const handleSave = async (session: PhotoSession) => {
    setIsGenerating(true);
    try {
      const stripUrl = await generateStrip(session, frameDesign);
      const l = document.createElement('a');
      l.href = stripUrl;
      l.download = `nova-booth-${session.id}.jpg`;
      document.body.appendChild(l);
      l.click();
      document.body.removeChild(l);
    } catch (e) {
      console.error(e);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleShare = async (session: PhotoSession) => {
    setIsGenerating(true);
    try {
      const stripUrl = await generateStrip(session, frameDesign);
      const r = await fetch(stripUrl);
      const b = await r.blob();
      const f = new File([b], `nova-booth-${session.id}.jpg`, { type: 'image/jpeg' });
      if (navigator.share) {
        await navigator.share({ files: [f], title: 'Nova Booth' });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsGenerating(false);
    }
  };

  const cameras: CameraModel[] = ['Normal', 'SX-70', '600 Series', 'Spectra', 'i-Type', 'Go', 'Rollfilm', 'Packfilm', 'Flip', 'I-2', 'Impulse'];
  const styles: ShootingStyle[] = ['standard', 'classic', 'FQS', 'OFM', 'retro-grain', 'cyberpunk', 'vivid', 'dreamy', 'noir'];
  const designs: {id: FrameDesign, icon: any}[] = [
    {id: 'classic-strip', icon: Layout}, {id: 'film-roll', icon: ImageIcon}, {id: 'polaroid', icon: ImageIcon}, {id: 'minimalist', icon: X},
    {id: 'floral', icon: Flower}, {id: 'geometric', icon: Layout}, {id: 'instagram', icon: Instagram},
    {id: 'glitter', icon: Sparkles}, {id: 'boho', icon: Heart}, {id: 'wedding', icon: Star}, {id: 'comic', icon: Zap},
    {id: 'harry-potter', icon: Zap}, {id: 'portrait', icon: ImageIcon}, {id: 'vintage', icon: RefreshCw}, {id: 'sunshine', icon: Sun}
  ];

  return (
    <div className="fixed inset-0 bg-[#f4e4bc] flex flex-col overflow-hidden safe-top safe-bottom touch-none font-mono">
      {step === 'setup' && (
        <div className="flex-1 flex flex-col items-center justify-center p-4 animate-in fade-in duration-500">
          <div className="booth-container">
            <div className="booth-frame-outer">
              <div className="booth-frame-inner">
                <div className="booth-sign-main">Photographs</div>
                <div className="flex flex-1 border-t-8 border-[#0c0c0c] rounded-b-[30px] overflow-hidden">
                  <div className="w-20 border-r-8 border-[#0c0c0c] flex flex-col">
                    <div className="booth-paper-sign text-center border-b-4 border-[#0c0c0c] py-4">
                      <div className="text-lg font-black italic font-serif">4 For FREE</div>
                    </div>
                    <div className="flex-1 p-2 bg-[#d6ded9] flex flex-col gap-1 opacity-20">
                      {[1,2,3,4].map(i => <div key={i} className="w-full aspect-[3/4] bg-neutral-800" />)}
                    </div>
                  </div>
                  <div className="flex-1 booth-curtain-container flex items-center justify-center">
                    <div className="booth-curtain-fabric" />
                    <button onClick={() => setStep('shooting')} className="absolute z-10 bg-white text-black font-black px-6 py-4 border-4 border-black rounded-xl shadow-[6px_6px_0px_black] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all uppercase italic text-lg tracking-tighter">Step Inside</button>
                  </div>
                  <div className="w-16 border-l-8 border-[#0c0c0c] bg-[#d6ded9] p-2 flex flex-col items-center text-[8px] font-black uppercase tracking-tighter text-neutral-600">
                    <div className="mt-4">W<br/>H<br/>I<br/>L<br/>E</div>
                    <div className="text-2xl my-4 text-neutral-800">U</div>
                    <div>W<br/>A<br/>I<br/>T</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {step === 'shooting' && (
        <div className="flex-1 flex flex-col bg-black animate-in zoom-in duration-300">
          <video ref={videoRef} autoPlay playsInline muted className="hidden" />
          <div className="flex-1 relative flex flex-col items-center justify-center overflow-hidden">
            <canvas ref={livePreviewCanvasRef} className="w-full h-full object-cover" />
            {isFlashing && <div className="absolute inset-0 bg-white z-50" />}
            {isCountingDown && <div className="absolute inset-0 flex items-center justify-center bg-black/20 z-40"><span className="text-white text-9xl font-black italic">{countdown}</span></div>}
            <div className="absolute top-0 left-0 right-0 p-4 safe-top flex justify-between items-center pointer-events-none">
              <div className="flex items-center gap-2 pointer-events-auto">
                <div className="bg-black/50 backdrop-blur-md px-3 py-1 rounded-full text-[10px] text-white font-black uppercase border border-white/20">SHOT {capturedFrames.length+1}/{frameCount}</div>
                {capturedFrames.length === 0 && !isCountingDown && (
                  <div className="flex bg-black/50 backdrop-blur-md rounded-full border border-white/20 p-1">
                    {[1,2,3,4].map(n => <button key={n} onClick={() => setFrameCount(n)} className={cn("w-6 h-6 rounded-full text-[10px] font-black", frameCount === n ? "bg-white text-black" : "text-white/50")}>{n}</button>)}
                  </div>
                )}
              </div>
              <button onClick={() => setStep('setup')} className="p-2 bg-black/50 rounded-full text-white pointer-events-auto border border-white/20"><X size={20} /></button>
            </div>
          </div>
          <div className="control-bar-horizontal">
            <div><p className="text-[8px] font-black text-white/40 uppercase mb-2 tracking-widest">Hardware</p>
              <div className="horizontal-scroller">{cameras.map(c => <button key={c} onClick={() => setCameraModel(c)} className={cn("pill-button", cameraModel === c && "active")}>{c}</button>)}</div>
            </div>
            <div><p className="text-[8px] font-black text-white/40 uppercase mb-2 tracking-widest">Style</p>
              <div className="horizontal-scroller">{styles.map(s => <button key={s} onClick={() => setShootingStyle(s)} className={cn("pill-button", shootingStyle === s && "active")}>{s}</button>)}</div>
            </div>
          </div>
          <div className="shooting-footer safe-bottom">
            <div className="flex-1 flex justify-center"><button onClick={() => setFacingMode(f => f === 'user' ? 'environment' : 'user')} className="p-4 text-white/60"><RefreshCw size={24} /></button></div>
            <div className="flex-1 flex justify-center"><button onClick={runSequence} disabled={isCountingDown || capturedFrames.length >= frameCount} className="shutter-btn" /></div>
            <div className="flex-1 flex justify-center" />
          </div>
        </div>
      )}

      {step === 'lab' && (
        <div className="flex-1 flex flex-col p-4 overflow-y-auto safe-bottom">
          <header className="text-center py-8">
            <h2 className="text-4xl font-black italic tracking-tighter uppercase">DEVELOPED</h2>
            <div className="mt-4 flex flex-col items-center">
              <p className="text-[8px] font-black text-neutral-400 uppercase mb-2 tracking-widest">Select Frame Design</p>
              <div className="horizontal-scroller w-full max-w-sm">
                {designs.map(d => (
                  <button 
                    key={d.id} 
                    onClick={() => setFrameDesign(d.id)} 
                    className={cn(
                      "pill-button capitalize border-black/20 text-black", 
                      frameDesign === d.id && "bg-black text-white border-black"
                    )}
                  >
                    {d.id.replace('-',' ')}
                  </button>
                ))}
              </div>
            </div>
          </header>
          <div className="flex-1 flex flex-col items-center gap-12 pb-32">
            {sessions.map(s => (
              <div key={s.id} className="flex flex-col items-center gap-6 w-full max-w-sm">
                {/* Film Roll Overlay (Conditional) */}
                {frameDesign === 'film-roll' ? (
                  <div className="w-full bg-[#96988d] p-8 flex gap-4 items-center animate-in fade-in duration-500 rounded-lg">
                    <div className="flex-1 vertical-text font-black text-6xl text-white opacity-90 tracking-tighter mix-blend-overlay">
                      memories
                    </div>
                    <div className="photobooth-strip-film bg-black p-2 flex flex-col gap-2 border-x-[12px] border-black relative">
                       {/* Film Sprocket Holes (CSS generated) */}
                       <div className="absolute top-0 bottom-0 -left-10 w-8 flex flex-col justify-around py-4 opacity-70">
                          {Array.from({length: 12}).map((_, i) => <div key={i} className="w-4 h-3 bg-white/90 rounded-sm" />)}
                       </div>
                       <div className="absolute top-0 bottom-0 -right-10 w-8 flex flex-col justify-around py-4 opacity-70">
                          {Array.from({length: 12}).map((_, i) => <div key={i} className="w-4 h-3 bg-white/90 rounded-sm" />)}
                       </div>
                       {s.frames.map((f, i) => (
                        <div key={i} className="w-48 aspect-square overflow-hidden bg-zinc-900 border-y-4 border-black">
                          <img src={f} className="w-full h-full object-cover grayscale-[0.2] contrast-[1.1]" />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className={cn("w-full transition-all duration-500 relative", 
                    frameDesign === 'classic-strip' && "bg-black p-4 rounded-sm flex flex-col gap-4",
                    frameDesign === 'polaroid' && "bg-white p-4 pb-12 shadow-xl border-b-[20px] border-white",
                    frameDesign === 'minimalist' && "bg-transparent border border-black/10 p-2 flex flex-col gap-2",
                    frameDesign === 'floral' && "bg-emerald-50 p-6 rounded-3xl border-8 border-emerald-100 flex flex-col gap-4 relative overflow-hidden",
                    frameDesign === 'geometric' && "bg-zinc-900 p-4 border-[12px] border-blue-500 flex flex-col gap-4",
                    frameDesign === 'instagram' && "bg-white p-3 rounded-lg shadow-md border border-zinc-200 flex flex-col gap-2",
                    frameDesign === 'glitter' && "bg-amber-50 p-6 border-4 border-amber-200 shadow-[0_0_20px_rgba(251,191,36,0.3)] flex flex-col gap-4",
                    frameDesign === 'boho' && "bg-[#fdf6e3] p-6 border-x-8 border-[#d4af37]/20 flex flex-col gap-4",
                    frameDesign === 'wedding' && "bg-white p-8 border-double border-4 border-zinc-200 flex flex-col gap-6",
                    frameDesign === 'comic' && "bg-yellow-400 p-4 border-4 border-black flex flex-col gap-4 shadow-[8px_8px_0px_black]",
                    frameDesign === 'harry-potter' && "bg-[#2a1a14] p-6 border-[12px] border-[#d4af37]/40 shadow-2xl flex flex-col gap-4 font-serif text-[#d4af37]",
                    frameDesign === 'portrait' && "bg-stone-100 p-10 shadow-[0_20px_50px_rgba(0,0,0,0.1)] flex flex-col gap-8 border-t-[40px] border-stone-200",
                    frameDesign === 'vintage' && "bg-[#eaddca] p-5 border-[1px] border-[#c19a6b] flex flex-col gap-4 shadow-inner",
                    frameDesign === 'sunshine' && "bg-gradient-to-br from-yellow-200 to-orange-200 p-6 rounded-[40px] border-8 border-white flex flex-col gap-4"
                  )}>
                    {frameDesign === 'harry-potter' && <div className="absolute top-2 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-[0.3em] font-bold opacity-50">Ministry of Magic</div>}
                    {frameDesign === 'sunshine' && <div className="absolute -top-4 -right-4 text-4xl animate-pulse">☀️</div>}
                    {frameDesign === 'sunshine' && <div className="absolute -bottom-2 -left-2 text-2xl">🌻</div>}
                    
                    {s.frames.map((f, i) => (
                      <div key={i} className={cn("w-full overflow-hidden aspect-[4/3] bg-zinc-900 relative", 
                        frameDesign === 'polaroid' && "aspect-square",
                        frameDesign === 'instagram' && "aspect-square rounded-sm",
                        frameDesign === 'comic' && "border-2 border-black rotate-1",
                        frameDesign === 'harry-potter' && "sepia-[0.5] contrast-[1.2] border border-[#d4af37]/30",
                        frameDesign === 'vintage' && "grayscale-[0.3] contrast-[0.9] brightness-[1.05]",
                        frameDesign === 'portrait' && "aspect-[2/3] shadow-inner"
                      )}>
                        <img src={f} className="w-full h-full object-cover" />
                        {frameDesign === 'harry-potter' && <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />}
                      </div>
                    ))}
                    {frameDesign === 'instagram' && <div className="flex gap-3 px-1"><Heart size={16} /><Star size={16} /></div>}
                    {frameDesign === 'wedding' && <div className="text-center italic font-serif text-sm border-t pt-4">Together Forever</div>}
                    {frameDesign === 'harry-potter' && <div className="text-center italic text-xl mt-2 tracking-widest font-serif">Have You Seen This Wizard?</div>}
                    {frameDesign === 'vintage' && <div className="text-right text-[10px] font-serif opacity-40 italic">Nov. 1974</div>}
                  </div>
                )}
                <div className="flex gap-4">
                  <button onClick={() => handleSave(s)} className="hidden md:flex bg-white p-4 rounded-full shadow-lg border-2 border-black disabled:opacity-50" disabled={isGenerating}>
                    {isGenerating ? <Loader2 className="animate-spin" size={20} /> : <Download size={20} />}
                  </button>
                  <button onClick={() => handleShare(s)} className="bg-white p-4 rounded-full shadow-lg border-2 border-black disabled:opacity-50" disabled={isGenerating}>
                    {isGenerating ? <Loader2 className="animate-spin" size={20} /> : <Share2 size={20} />}
                  </button>
                  <button onClick={() => setSessions(prev => prev.filter(x => x.id !== s.id))} className="bg-white p-4 rounded-full shadow-lg border-2 border-black text-red-500"><Trash2 size={20} /></button>
                </div>
              </div>
            ))}
          </div>
          <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-[#f4e4bc] to-transparent pointer-events-none">
            <button onClick={() => { setCapturedFrames([]); setStep('setup'); }} className="w-full max-w-md mx-auto bg-black text-white py-6 rounded-full border-4 border-black shadow-2xl flex items-center justify-center gap-3 active:scale-95 transition-all pointer-events-auto uppercase italic font-black">New Session</button>
          </div>
        </div>
      )}
    </div>
  );
}
