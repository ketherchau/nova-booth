"use client";

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Camera, RefreshCw, Download, Trash2, Upload, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import confetti from 'canvas-confetti';

interface Photo {
  id: string;
  url: string;
  timestamp: number;
}

export default function PhotoBooth() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isFlashing, setIsFlashing] = useState(false);
  const [isEjecting, setIsEjecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<'camera' | 'upload'>('camera');
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const startCamera = useCallback(async () => {
    try {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 800, height: 800 },
        audio: false
      });
      
      setStream(newStream);
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }
      setPreviewMode('camera');
      setError(null);
    } catch (err) {
      console.error("Camera error:", err);
      setError("Camera access denied.");
    }
  }, [stream]);

  useEffect(() => {
    startCamera();
    return () => {
      if (stream) stream.getTracks().forEach(track => track.stop());
    };
  }, []);

  const handleCapture = () => {
    if (isEjecting) return;
    
    setIsFlashing(true);
    setTimeout(() => setIsFlashing(false), 400);
    
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const context = canvas.getContext('2d');
    if (context) {
      canvas.width = 800;
      canvas.height = 800;
      
      // Mirror for camera
      context.translate(800, 0);
      context.scale(-1, 1);
      
      const size = Math.min(video.videoWidth, video.videoHeight);
      const x = (video.videoWidth - size) / 2;
      const y = (video.videoHeight - size) / 2;
      
      context.drawImage(video, x, y, size, size, 0, 0, 800, 800);
      processAndEject(canvas.toDataURL('image/jpeg', 0.9));
    }
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = canvasRef.current;
          if (!canvas) return;
          const ctx = canvas.getContext('2d');
          if (!ctx) return;
          
          canvas.width = 800;
          canvas.height = 800;
          
          // Draw image to square canvas
          const size = Math.min(img.width, img.height);
          const x = (img.width - size) / 2;
          const y = (img.height - size) / 2;
          ctx.drawImage(img, x, y, size, size, 0, 0, 800, 800);
          
          processAndEject(canvas.toDataURL('image/jpeg', 0.9));
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const processAndEject = (url: string) => {
    setIsEjecting(true);
    
    const newPhoto: Photo = {
      id: Math.random().toString(36).substr(2, 9),
      url: url,
      timestamp: Date.now()
    };

    setTimeout(() => {
      setPhotos(prev => [newPhoto, ...prev]);
      setIsEjecting(false);
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.8 } });
    }, 1500);
  };

  return (
    <div className="min-h-screen py-10 px-4 flex flex-col items-center">
      {/* The Classic Camera Body */}
      <div className="relative w-full max-w-[450px] aspect-[4/5] retro-body rounded-[40px] p-8 flex flex-col items-center border-b-[12px] border-gray-300">
        
        {/* Flash & Viewfinder Row */}
        <div className="w-full flex justify-between items-start mb-8 px-4">
          <div className="w-16 h-16 bg-gray-200 rounded-xl border-4 border-white shadow-inner flex items-center justify-center overflow-hidden">
             <div className="w-full h-full bg-gradient-to-br from-white to-gray-400 opacity-50" />
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="w-12 h-12 bg-black rounded-lg border-2 border-gray-400 flex items-center justify-center">
              <div className="w-4 h-4 bg-blue-900/50 rounded-sm" />
            </div>
            {/* Rainbow Stripe */}
            <div className="w-12 h-20 rainbow-stripe rounded-sm shadow-sm" />
          </div>
        </div>

        {/* The Lens Container */}
        <div className="relative w-64 h-64 rounded-full bg-black border-[10px] border-gray-200 shadow-2xl flex items-center justify-center group overflow-hidden">
          <div className="absolute inset-0 lens-glass" />
          
          {/* Viewfinder/Preview Window inside Lens */}
          <div className="z-10 w-full h-full relative overflow-hidden">
             {previewMode === 'camera' && !error ? (
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1] opacity-60 mix-blend-screen" />
             ) : (
                <div className="w-full h-full flex items-center justify-center bg-blue-950/20">
                  <Upload className="text-white/30 h-12 w-12" />
                </div>
             )}
          </div>
          
          {/* Flash Effect Layer */}
          {isFlashing && <div className="absolute inset-0 bg-white camera-flash z-30" />}
        </div>

        {/* Controls Row */}
        <div className="w-full mt-10 flex justify-around items-center px-4">
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="w-12 h-12 rounded-full bg-gray-800 text-white flex items-center justify-center shadow-lg hover:bg-black transition-colors"
          >
            <Upload size={20} />
          </button>
          
          {/* The Red Shutter Button */}
          <button 
            onClick={handleCapture}
            disabled={isEjecting}
            className="w-20 h-20 rounded-full bg-red-600 border-b-8 border-red-800 active:border-b-0 active:translate-y-2 shadow-xl transition-all flex items-center justify-center"
          >
            <div className="w-16 h-16 rounded-full border-4 border-red-500/50" />
          </button>

          <button 
            onClick={startCamera}
            className="w-12 h-12 rounded-full bg-gray-800 text-white flex items-center justify-center shadow-lg hover:bg-black transition-colors"
          >
            <RefreshCw size={20} />
          </button>
        </div>

        {/* The Ejection Slot */}
        <div className="absolute bottom-12 w-3/4 h-3 bg-black rounded-full shadow-inner overflow-visible">
          {isEjecting && (
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-4/5 photo-eject z-50">
              <div className="polaroid-print w-full aspect-square bg-gray-200 animate-pulse" />
            </div>
          )}
        </div>

        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          accept="image/*" 
          onChange={handleUpload} 
        />
      </div>

      {/* Film Strip Display */}
      <div className="mt-20 w-full max-w-5xl">
        <h2 className="text-2xl font-bold mb-8 text-gray-400 uppercase tracking-widest text-center">Development Lab</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10">
          {photos.map((photo) => (
            <div key={photo.id} className="relative group flex justify-center">
              <div className="polaroid-print w-72 transition-transform hover:scale-105 hover:rotate-0 rotate-1 shadow-2xl">
                <div className="aspect-square overflow-hidden bg-black relative">
                  <img 
                    src={photo.url} 
                    alt="Captured" 
                    className="w-full h-full object-cover vintage-filter" 
                  />
                </div>
                <div className="mt-4 flex justify-between items-center text-gray-400 italic text-sm font-serif">
                   <span>{new Date(photo.timestamp).toLocaleDateString()}</span>
                   <div className="flex gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => {
                        const link = document.createElement('a');
                        link.href = photo.url;
                        link.download = `polaroid-${photo.id}.jpg`;
                        link.click();
                      }} className="text-blue-500"><Download size={18} /></button>
                      <button onClick={() => setPhotos(prev => prev.filter(p => p.id !== photo.id))} className="text-red-500"><Trash2 size={18} /></button>
                   </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
