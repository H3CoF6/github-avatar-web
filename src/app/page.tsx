'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Search, Users, Shield, Cpu, RefreshCcw, LayoutGrid } from 'lucide-react';
import { UserCard } from '@/components/UserCard';
import { findBestHslMatch, IdenticonData } from '@/lib/utils/image';
import confetti from 'canvas-confetti';

const MAX_ID_FALLBACK = 210000000;

interface GitHubUser {
  login: string;
  id: number;
  name: string;
  bio: string;
  location: string;
  avatar_url: string;
  html_url: string;
}

export default function Home() {
  const [image, setImage] = useState<string | null>(null);
  const [targetData, setTargetData] = useState<IdenticonData | null>(null);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [maxId, setMaxId] = useState(MAX_ID_FALLBACK);
  const [matches, setMatches] = useState<number[]>([]);
  const [users, setUsers] = useState<GitHubUser[]>([]);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const workersRef = useRef<Worker[]>([]);

  // 1. Fetch Max ID
  useEffect(() => {
    fetch('https://api.github.com/users?per_page=1&order=desc')
      .then(res => res.headers.get('link'))
      .then(() => {
        // Simplified approach: just start high and binary search or use a known high point
        // For now, use fallback or a simple recent user check
        fetch('https://api.github.com/users?since=210000000')
          .then(res => res.json())
          .then(data => {
            if (Array.isArray(data) && data.length > 0) {
              setMaxId(Math.max(MAX_ID_FALLBACK, ...data.map((u: GitHubUser) => u.id)));
            }
          });
      })
      .catch(() => {});
  }, []);

  // 2. Handle Image Upload & Processing
  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setImage(event.target?.result as string);
      processImage(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const processImage = (src: string) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      // Draw and auto-crop/detect (Simplified: assume it's the avatar or user crops it)
      // Real implementation would look for a 5x5 grid of similar colored blocks
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      // Manual selection is better for accuracy, but let's try a center-weighted heuristic
      detectIdenticon(ctx, img.width, img.height);
    };
    img.src = src;
  };

  const detectIdenticon = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    // We look for a square area with a 5x5 grid.
    // For simplicity, we'll ask the user to click or just use the center 
    // if the image is already small.
    const size = Math.min(w, h);
    
    // Grid detection logic:
    const blockSize = size / 5;
    let r = 0, g = 0, b = 0, count = 0;

    // Get background color (top left pixel)
    const bg = ctx.getImageData(0,0,1,1).data;

    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 3; col++) {
        const x = Math.floor((col + 0.5) * blockSize);
        const y = Math.floor((row + 0.5) * blockSize);
        const pixel = ctx.getImageData(w/2 - size/2 + x, h/2 - size/2 + y, 1, 1).data;
        
        // If different from background, it's 'on'
        const isColored = Math.abs(pixel[0] - bg[0]) > 30 || Math.abs(pixel[1] - bg[1]) > 30 || Math.abs(pixel[2] - bg[2]) > 30;
        
        if (isColored) {
          r += pixel[0]; g += pixel[1]; b += pixel[2];
          count++;
        }
      }
    }

    if (count > 0) {
      const bestHsl = findBestHslMatch(r / count, g / count, b / count);
      // Adjust pattern mapping to match Rust logic (nibbles)
      // Rust logic: col + (row * 5). But we only care about first 3 columns.
      // Wait, let's align the pattern bitmask perfectly.
      // Rust nibbles loop: for col in (0..3).rev() { for row in 0..5 { ... next_nibble() } }
      // So nibble 0 is col 2, row 0. Nibble 1 is col 2, row 1...
      
      let alignedPattern = 0;
      let bit = 0;
      for (let col = 2; col >= 0; col--) {
        for (let row = 0; row < 5; row++) {
          const x = Math.floor((col + 0.5) * blockSize);
          const y = Math.floor((row + 0.5) * blockSize);
          const pixel = ctx.getImageData(w/2 - size/2 + x, h/2 - size/2 + y, 1, 1).data;
          const isColored = Math.abs(pixel[0] - bg[0]) > 30;
          if (isColored) alignedPattern |= (1 << bit);
          bit++;
        }
      }

      setTargetData({ pattern: alignedPattern, ...bestHsl });
    }
  };

  // 3. Brute Force Execution
  const startScan = async () => {
    if (!targetData) return;
    setScanning(true);
    setProgress(0);
    setMatches([]);
    setUsers([]);

    const numWorkers = navigator.hardwareConcurrency || 4;
    const chunkSize = Math.ceil(maxId / numWorkers);
    let completedWorkers = 0;
    const allMatches: number[] = [];

    for (let i = 0; i < numWorkers; i++) {
      const worker = new Worker(new URL('../workers/bruteforce.ts', import.meta.url));
      workersRef.current.push(worker);

      worker.onmessage = (e) => {
        if (e.data.type === 'SUCCESS') {
          allMatches.push(...e.data.matches);
          completedWorkers++;
          setProgress(Math.round((completedWorkers / numWorkers) * 100));
          
          if (completedWorkers === numWorkers) {
            finalizeScan(allMatches);
          }
        } else if (e.data.type === 'ERROR') {
          console.error(e.data.error);
          setScanning(false);
        }
      };

      worker.postMessage({
        targetPattern: targetData.pattern,
        targetH: targetData.h,
        targetS: targetData.s,
        targetL: targetData.l,
        startId: i * chunkSize,
        endId: Math.min((i + 1) * chunkSize, maxId),
        wasmUrl: '/wasm/wasm_bruteforcer_bg.wasm'
      });
    }
  };

  const finalizeScan = async (foundIds: number[]) => {
    setScanning(false);
    setMatches(foundIds);
    workersRef.current.forEach(w => w.terminate());
    workersRef.current = [];

    if (foundIds.length > 0) {
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#00f2ff', '#7000ff', '#ffffff']
      });

      // Fetch user data
      const userData = await Promise.all(
        foundIds.map(async (id) => {
          const res = await fetch(`https://api.github.com/user/${id}`);
          return res.ok ? res.json() : null;
        })
      );
      setUsers(userData.filter(u => u !== null));
    }
  };

  return (
    <main className="min-h-screen bg-white dark:bg-black text-slate-900 dark:text-white selection:bg-cyan-500/30 transition-colors duration-500">
      {/* Background Effect */}
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(240,240,255,1),rgba(255,255,255,1))] dark:bg-[radial-gradient(circle_at_50%_50%,rgba(20,20,30,1),rgba(0,0,0,1))]" />
      <div className="fixed inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.05] dark:opacity-20 pointer-events-none" />

      <div className="relative z-10 mx-auto max-w-6xl px-6 py-12 md:py-24">
        {/* Header */}
        <header className="mb-16 text-center">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 rounded-full border border-black/5 dark:border-white/10 bg-black/5 dark:bg-white/5 px-4 py-1.5 text-sm font-medium text-cyan-600 dark:text-cyan-400 backdrop-blur-md"
          >
            <Shield size={14} /> GitHub Identicon Decoder
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mt-6 text-5xl font-bold tracking-tight md:text-7xl text-slate-900 dark:text-white"
          >
            Trace the <span className="bg-gradient-to-r from-cyan-600 to-violet-600 dark:from-cyan-400 dark:to-violet-500 bg-clip-text text-transparent">Invisible.</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="mx-auto mt-6 max-w-2xl text-lg text-slate-500 dark:text-white/50"
          >
            Upload a GitHub default avatar to brute-force the user ID using client-side WebAssembly.
          </motion.p>
        </header>

        <div className="grid gap-12 lg:grid-cols-2">
          {/* Upload Section */}
          <section className="space-y-8">
            <div 
              className={`group relative aspect-square cursor-pointer overflow-hidden rounded-3xl border-2 border-dashed transition-all ${
                image ? 'border-white/20' : 'border-white/10 hover:border-cyan-500/50 hover:bg-white/5'
              }`}
              onClick={() => fileInputRef.current?.click()}
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleUpload} 
                className="hidden" 
                accept="image/*"
              />
              
              {image ? (
                <div className="relative h-full w-full">
                  <img src={image} className="h-full w-full object-contain" alt="Upload" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <RefreshCcw className="text-white" />
                  </div>
                </div>
              ) : (
                <div className="flex h-full flex-col items-center justify-center space-y-4">
                  <div className="rounded-full bg-white/5 p-4 group-hover:scale-110 transition-transform">
                    <Upload className="text-white/40" size={32} />
                  </div>
                  <div className="text-center">
                    <p className="font-medium">Drop screenshot here</p>
                    <p className="text-sm text-white/40">or click to browse</p>
                  </div>
                </div>
              )}
            </div>

            {targetData && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="flex items-center gap-2 font-semibold">
                    <LayoutGrid size={18} /> Extracted Pattern
                  </h3>
                  <div 
                    className="h-6 w-12 rounded-full border border-white/20"
                    style={{ backgroundColor: `hsl(${targetData.h * 360 / 4095}, ${65 - (targetData.s * 20 / 255)}%, ${75 - (targetData.l * 20 / 255)}%)` }}
                  />
                </div>
                
                <div className="grid grid-cols-5 gap-1 aspect-square w-32 mx-auto">
                  {Array.from({ length: 25 }).map((_, i) => {
                    const row = Math.floor(i / 5);
                    const col = i % 5;
                    const displayCol = col > 2 ? 4 - col : col;
                    const bitIndex = (2 - displayCol) * 5 + row;
                    const isActive = (targetData.pattern >> bitIndex) & 1;
                    
                    return (
                      <div 
                        key={i}
                        className={`rounded-sm transition-colors duration-500 ${
                          isActive ? 'bg-cyan-500' : 'bg-white/5'
                        }`}
                      />
                    );
                  })}
                </div>

                <button
                  disabled={scanning}
                  onClick={startScan}
                  className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3 font-bold text-black transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                >
                  {scanning ? (
                    <>
                      <Search className="animate-spin" size={18} />
                      Scanning {progress}%...
                    </>
                  ) : (
                    <>
                      <Cpu size={18} />
                      Brute Force IDs
                    </>
                  )}
                </button>
              </motion.div>
            )}
          </section>

          {/* Results Section */}
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-xl font-bold">
                <Users size={20} /> Results
                {matches.length > 0 && <span className="ml-2 text-sm font-normal text-cyan-400">{matches.length} matches found</span>}
              </h2>
            </div>

            <div className="min-h-[400px] rounded-3xl border border-white/10 bg-white/5 p-2 backdrop-blur-md">
              <AnimatePresence mode="popLayout">
                {scanning ? (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex h-full flex-col items-center justify-center space-y-6 py-20"
                  >
                    <div className="relative">
                      <div className="h-24 w-24 rounded-full border-t-2 border-cyan-500 animate-spin" />
                      <Search className="absolute inset-0 m-auto text-cyan-500" size={32} />
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-medium">Scanning {maxId.toLocaleString()} IDs</p>
                      <p className="text-sm text-white/40">Leveraging multi-core WASM acceleration</p>
                    </div>
                    <div className="w-64 h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <motion.div 
                        className="h-full bg-cyan-500"
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                      />
                    </div>
                  </motion.div>
                ) : users.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 h-full">
                    <div className="space-y-4">
                      <h3 className="flex items-center gap-2 text-sm font-semibold text-white/40 mb-4 px-2 uppercase tracking-wider">
                        Default Avatars
                      </h3>
                      <div className="space-y-4">
                        {users.filter(u => u.avatar_url.includes('identicons')).map((user) => (
                          <UserCard key={user.id} user={user} type="default" />
                        ))}
                        {users.filter(u => u.avatar_url.includes('identicons')).length === 0 && (
                          <p className="text-sm text-white/20 text-center py-8 italic">None found</p>
                        )}
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <h3 className="flex items-center gap-2 text-sm font-semibold text-white/40 mb-4 px-2 uppercase tracking-wider">
                        Custom Avatars
                      </h3>
                      <div className="space-y-4">
                        {users.filter(u => !u.avatar_url.includes('identicons')).map((user) => (
                          <UserCard key={user.id} user={user} type="custom" />
                        ))}
                        {users.filter(u => !u.avatar_url.includes('identicons')).length === 0 && (
                          <p className="text-sm text-white/20 text-center py-8 italic">None found</p>
                        )}
                      </div>
                    </div>
                  </div>
                ) : !image ? (
                  <div className="flex h-full flex-col items-center justify-center py-40 text-center space-y-4">
                    <div className="rounded-full bg-white/5 p-4 text-white/20">
                      <Upload size={32} />
                    </div>
                    <p className="text-white/40">Upload an image to start searching</p>
                  </div>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center py-40 text-center space-y-4">
                    <p className="text-white/40">No matches found yet.</p>
                  </div>
                )}
              </AnimatePresence>
            </div>
          </section>
        </div>
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </main>
  );
}
