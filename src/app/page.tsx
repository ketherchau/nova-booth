"use client";

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Camera, RefreshCw, Download, Trash2, Share2, Sparkles, Ghost, Palette, Sun, Moon, Zap, ChevronUp, Loader2, Image as ImageIcon, Settings2, X, Heart, Flower, Star, Instagram, Layout } from 'lucide-react';
import { cn } from '@/lib/utils';
import confetti from 'canvas-confetti';

type ShootingStyle = 'standard' | 'classic' | 'FQS' | 'OFM' | 'retro-grain' | 'cyberpunk' | 'vivid' | 'dreamy' | 'noir';

type CameraModel = 
  | 'Normal' | 'SX-70' | '600 Series' | 'Spectra' | 'i-Type' | 'Go' | 'Rollfilm' | 'Packfilm' | 'Flip' | 'I-2' | 'Impulse';

type FrameDesign = 
  | 'classic-strip' | 'polaroid' | 'minimalist' | 'floral' | 'geometric' | 'instagram' | 'glitter' | 'boho' | 'wedding' | 'comic';

interface PhotoSession {
  id: string;
  frames: string[];
  style: ShootingStyle;
  camera: CameraModel;
  frameDesign: FrameDesign;
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
        setSessions(s => [{ id: Math.random().toString(36).substr(2, 9), frames: next, style: shootingStyle, camera: cameraModel, frameDesign, timestamp: Date.now() }, ...s]);
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

  const cameras: CameraModel[] = ['Normal', 'SX-70', '600 Series', 'Spectra', 'i-Type', 'Go', 'Rollfilm', 'Packfilm', 'Flip', 'I-2', 'Impulse'];
  const styles: ShootingStyle[] = ['standard', 'classic', 'FQS', 'OFM', 'retro-grain', 'cyberpunk', 'vivid', 'dreamy', 'noir'];
  const designs: {id: FrameDesign, icon: any}[] = [
    {id: 'classic-strip', icon: Layout}, {id: 'polaroid', icon: ImageIcon}, {id: 'minimalist', icon: X},
    {id: 'floral', icon: Flower}, {id: 'geometric', icon: Layout}, {id: 'instagram', icon: Instagram},
    {id: 'glitter', icon: Sparkles}, {id: 'boho', icon: Heart}, {id: 'wedding', icon: Star}, {id: 'comic', icon: Zap}
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
                      <div className="text-2xl font-black italic">4 For FREE</div>
                      <div className="text-[7px] font-black uppercase">Photographs</div>
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
            <div><p className="text-[8px] font-black text-white/40 uppercase mb-2 tracking-widest">Frame Design</p>
              <div className="horizontal-scroller">{designs.map(d => <button key={d.id} onClick={() => setFrameDesign(d.id)} className={cn("pill-button capitalize", frameDesign === d.id && "active")}>{d.id.replace('-',' ')}</button>)}</div>
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
          <header className="text-center py-8"><h2 className="text-4xl font-black italic tracking-tighter uppercase">DEVELOPED</h2></header>
          <div className="flex-1 flex flex-col items-center gap-12 pb-32">
            {sessions.map(s => (
              <div key={s.id} className="flex flex-col items-center gap-6 w-full max-w-sm">
                <div className={cn("w-full transition-all duration-500", 
                  s.frameDesign === 'classic-strip' && "bg-black p-4 rounded-sm flex flex-col gap-4",
                  s.frameDesign === 'polaroid' && "bg-white p-4 pb-12 shadow-xl border-b-[20px] border-white",
                  s.frameDesign === 'minimalist' && "bg-transparent border border-black/10 p-2 flex flex-col gap-2",
                  s.frameDesign === 'floral' && "bg-emerald-50 p-6 rounded-3xl border-8 border-emerald-100 flex flex-col gap-4 relative overflow-hidden",
                  s.frameDesign === 'geometric' && "bg-zinc-900 p-4 border-[12px] border-blue-500 flex flex-col gap-4",
                  s.frameDesign === 'instagram' && "bg-white p-3 rounded-lg shadow-md border border-zinc-200 flex flex-col gap-2",
                  s.frameDesign === 'glitter' && "bg-amber-50 p-6 border-4 border-amber-200 shadow-[0_0_20px_rgba(251,191,36,0.3)] flex flex-col gap-4",
                  s.frameDesign === 'boho' && "bg-[#fdf6e3] p-6 border-x-8 border-[#d4af37]/20 flex flex-col gap-4",
                  s.frameDesign === 'wedding' && "bg-white p-8 border-double border-4 border-zinc-200 flex flex-col gap-6",
                  s.frameDesign === 'comic' && "bg-yellow-400 p-4 border-4 border-black flex flex-col gap-4 shadow-[8px_8px_0px_black]"
                )}>
                  {s.frames.map((f, i) => (
                    <div key={i} className={cn("w-full overflow-hidden", 
                      s.frameDesign === 'polaroid' && "aspect-square",
                      s.frameDesign === 'instagram' && "aspect-square rounded-sm",
                      s.frameDesign === 'comic' && "border-2 border-black rotate-1",
                      "aspect-[4/3] bg-zinc-900"
                    )}><img src={f} className="w-full h-full object-cover" /></div>
                  ))}
                  {s.frameDesign === 'instagram' && <div className="flex gap-3 px-1"><Heart size={16} /><Star size={16} /></div>}
                  {s.frameDesign === 'wedding' && <div className="text-center italic font-serif text-sm border-t pt-4">Together Forever</div>}
                </div>
                <div className="flex gap-4">
                  <button onClick={() => {const l=document.createElement('a');l.href=s.frames[0];l.download='strip.jpg';l.click();}} className="hidden md:flex bg-white p-4 rounded-full shadow-lg border-2 border-black"><Download size={20} /></button>
                  <button onClick={async () => {const r=await fetch(s.frames[0]);const b=await r.blob();const f=new File([b],'strip.jpg',{type:'image/jpeg'});navigator.share?.({files:[f]});}} className="bg-white p-4 rounded-full shadow-lg border-2 border-black"><Share2 size={20} /></button>
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
