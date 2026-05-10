'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Search, Users, Shield, Cpu, RefreshCcw, LayoutGrid, Sun, Moon, Hash, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Pipette } from 'lucide-react';
import { UserCard } from '@/components/UserCard';
import { findBestHslMatch, IdenticonData } from '@/lib/utils/image';
import confetti from 'canvas-confetti';
import CryptoJS from 'crypto-js';

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
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [predictId, setPredictId] = useState<string>('');
  const [predictedData, setPredictedData] = useState<IdenticonData | null>(null);
  const [colorTolerance, setColorTolerance] = useState(0.03);
  const [apiError, setApiError] = useState<string | null>(null);
  const [showNonDefault, setShowNonDefault] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const resultsPerPage = 10;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const workersRef = useRef<Worker[]>([]);

  const handlePredict = (id: string) => {
    setPredictId(id);
    const trimmedId = id.trim();
    if (!trimmedId || isNaN(parseInt(trimmedId))) {
      setPredictedData(null);
      return;
    }

    const hash = CryptoJS.MD5(trimmedId).toString();
    const bytes = [];
    for (let c = 0; c < hash.length; c += 2) {
      bytes.push(parseInt(hash.substr(c, 2), 16));
    }

    let pattern = 0;
    for (let i = 0; i < 15; i++) {
      const byteIdx = Math.floor(i / 2);
      const byte = bytes[byteIdx];
      const nibble = i % 2 === 0 ? (byte >> 4) & 0x0f : byte & 0x0f;
      if (nibble % 2 === 0) pattern |= (1 << i);
    }

    const h1 = (bytes[12] & 0x0f) << 8;
    const h2 = bytes[13];
    const h = h1 | h2;
    const s = bytes[14];
    const l = bytes[15];

    setPredictedData({ pattern, h, s, l });
  };

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark');
      root.style.colorScheme = 'light';
    }
  }, [theme]);

  useEffect(() => {
    if (window.matchMedia('(prefers-color-scheme: light)').matches) setTheme('light');
  }, []);

  useEffect(() => {
    fetch('https://api.github.com/users?per_page=1&order=desc')
      .then(res => res.headers.get('link'))
      .then(() => {
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
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      detectIdenticon(ctx, img.width, img.height);
    };
    img.src = src;
  };

  const handleImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!image || !canvasRef.current) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const imgElement = e.currentTarget.querySelector('img');
    if (!imgElement) return;

    const imgRect = imgElement.getBoundingClientRect();
    const scaleX = canvasRef.current.width / imgRect.width;
    const scaleY = canvasRef.current.height / imgRect.height;
    
    const x = (e.clientX - imgRect.left) * scaleX;
    const y = (e.clientY - imgRect.top) * scaleY;
    
    const ctx = canvasRef.current.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    
    const pixel = ctx.getImageData(x, y, 1, 1).data;
    const bestHsl = findBestHslMatch(pixel[0], pixel[1], pixel[2]);
    
    if (targetData) {
      setTargetData({ ...targetData, ...bestHsl });
    } else {
      setTargetData({ pattern: 0, ...bestHsl });
    }
  };

  const detectIdenticon = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const size = Math.min(w, h);
    const blockSize = size / 5;
    let r = 0, g = 0, b = 0, count = 0;
    const bg = ctx.getImageData(0,0,1,1).data;
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 3; col++) {
        const x = Math.floor((col + 0.5) * blockSize);
        const y = Math.floor((row + 0.5) * blockSize);
        const pixel = ctx.getImageData(w/2 - size/2 + x, h/2 - size/2 + y, 1, 1).data;
        const isColored = Math.abs(pixel[0] - bg[0]) > 30 || Math.abs(pixel[1] - bg[1]) > 30 || Math.abs(pixel[2] - bg[2]) > 30;
        if (isColored) { r += pixel[0]; g += pixel[1]; b += pixel[2]; count++; }
      }
    }
    if (count > 0) {
      const bestHsl = findBestHslMatch(r / count, g / count, b / count);
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

  const startScan = async () => {
    if (!targetData) return;
    setScanning(true);
    setProgress(0);
    setMatches([]);
    setUsers([]);
    setCurrentPage(1);
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
          if (completedWorkers === numWorkers) finalizeScan(allMatches);
        } else if (e.data.type === 'ERROR') {
          console.error(e.data.error);
          setScanning(false);
        }
      };
      worker.postMessage({
        targetPattern: targetData.pattern,
        startId: i * chunkSize,
        endId: Math.min((i + 1) * chunkSize, maxId),
        wasmUrl: '/wasm/wasm_bruteforcer_bg.wasm'
      });
    }
  };

  const finalizeScan = async (foundIds: number[]) => {
    if (!targetData) return;
    setScanning(false);
    workersRef.current.forEach(w => w.terminate());
    workersRef.current = [];
    if (foundIds.length === 0) return;
    
    const rankedIds = foundIds.map(id => {
      const hash = CryptoJS.MD5(id.toString()).toString();
      const bytes = new Uint8Array(16);
      for (let i = 0; i < 16; i++) {
        bytes[i] = parseInt(hash.slice(i * 2, i * 2 + 2), 16);
      }
      const h1 = (bytes[12] & 0x0f) << 8;
      const h2 = bytes[13];
      const h = h1 | h2;
      const s = bytes[14];
      const l = bytes[15];
      const dh = Math.abs(h - targetData.h) / 4096;
      const ds = Math.abs(s - targetData.s) / 256;
      const dl = Math.abs(l - targetData.l) / 256;
      const distance = Math.sqrt(dh*dh + ds*ds + dl*dl);
      return { id, distance };
    });
    
    const sorted = [...rankedIds].sort((a,b) => a.distance - b.distance);
    const filtered = sorted.filter(item => item.distance < colorTolerance);
    const sortedIds = filtered.map(item => item.id).slice(0, 50);
    setMatches(sortedIds);

    if (sortedIds.length > 0) {
      confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, colors: ['#00f2ff', '#7000ff', '#ffffff'] });
      setApiError(null);
      const userData = await Promise.all(sortedIds.map(async (id) => {
        try {
          const res = await fetch(`https://api.github.com/user/${id}`);
          if (res.ok) return res.json();
          return null;
        } catch (e) {
          return null;
        }
      }));
      setUsers(userData.filter(u => u !== null));
    }
  };

  const categorizedUsers = useMemo(() => {
    if (!targetData) return { defaultUsers: [], nonDefaultUsers: [] };
    const defaultUsers: GitHubUser[] = [];
    const nonDefaultUsers: GitHubUser[] = [];

    users.forEach(user => {
      const url = new URL(user.avatar_url);
      const isDefaultStyle = !url.searchParams.has('u');
      if (isDefaultStyle) {
        defaultUsers.push(user);
      } else {
        nonDefaultUsers.push(user);
      }
    });

    return { defaultUsers, nonDefaultUsers };
  }, [users, targetData]);

  const totalPages = Math.ceil(categorizedUsers.defaultUsers.length / resultsPerPage);
  const currentDefaultUsers = categorizedUsers.defaultUsers.slice((currentPage - 1) * resultsPerPage, currentPage * resultsPerPage);

  return (
    <main className="min-h-screen bg-white dark:bg-black text-slate-900 dark:text-white selection:bg-cyan-500/30 transition-colors duration-500 pb-20">
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(240,240,255,1),rgba(255,255,255,1))] dark:bg-[radial-gradient(circle_at_50%_50%,rgba(15,15,25,1),rgba(0,0,0,1))]" />
      <div className="fixed inset-0 opacity-[0.03] dark:opacity-[0.02]" style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, currentColor 10px, currentColor 11px)' }} />
      
      <div className="relative z-10 mx-auto max-w-6xl px-6 py-12">
        <div className="absolute right-6 top-6 flex gap-2">
          <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="flex h-10 w-10 items-center justify-center rounded-xl border border-black/5 dark:border-white/5 bg-white/50 dark:bg-white/5 text-slate-900 dark:text-white backdrop-blur-md transition-all hover:scale-110 active:scale-95 shadow-lg">
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>

        <header className="mb-12 text-center">
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="inline-flex items-center gap-2 rounded-full border border-black/5 dark:border-white/5 bg-white/50 dark:bg-white/5 px-4 py-1.5 text-xs font-extrabold uppercase tracking-wider text-cyan-600 dark:text-cyan-400 backdrop-blur-md mb-4">
            <Shield size={14} /> GitHub Identicon Decoder
          </motion.div>
          <h1 className="text-4xl font-extrabold tracking-tighter md:text-6xl text-slate-900 dark:text-white mb-3">
            Trace the <span className="bg-gradient-to-r from-cyan-600 to-violet-600 bg-clip-text text-transparent">Invisible.</span>
          </h1>
          <p className="text-base text-slate-500 dark:text-white/40 font-semibold">Decode any GitHub default avatar into its original user ID.</p>
        </header>

        <div className="grid gap-6 lg:grid-cols-2 mb-12">
          {/* Top Left: Upload & Pattern */}
          <section className="space-y-4">
            <div className="relative group aspect-[4/3] rounded-[1.5rem] overflow-hidden border-2 border-dashed border-slate-300 dark:border-white/10 transition-all hover:border-cyan-500/50">
              <input type="file" ref={fileInputRef} onChange={handleUpload} className="hidden" accept="image/*" />
              
              {!image ? (
                <button onClick={() => fileInputRef.current?.click()} className="w-full h-full flex flex-col items-center justify-center space-y-3 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                  <div className="rounded-2xl bg-slate-100 dark:bg-white/5 p-4 shadow-inner"><Upload className="text-slate-400 dark:text-white/40" size={32} /></div>
                  <div className="text-center"><p className="text-base font-extrabold text-slate-900 dark:text-white">Upload Identicon</p><p className="text-xs text-slate-400 dark:text-white/40 font-semibold">Drop screenshot or click to browse</p></div>
                </button>
              ) : (
                <div className="relative h-full w-full bg-black/5 dark:bg-white/5 cursor-crosshair" onClick={handleImageClick}>
                  <img src={image} className="max-h-full max-w-full object-contain mx-auto pointer-events-none" alt="Upload" />
                  <div className="absolute top-4 left-4 flex gap-2">
                    <div className="px-3 py-1.5 rounded-xl bg-black/60 backdrop-blur-xl text-white text-[10px] font-black flex items-center gap-1.5 shadow-2xl border border-white/10">
                      <Pipette size={12} className="text-cyan-400" /> TAP TO PICK COLOR
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                    className="absolute bottom-4 right-4 p-3 rounded-xl bg-white dark:bg-zinc-900 text-slate-900 dark:text-white shadow-2xl border border-black/5 dark:border-white/10 hover:scale-110 transition-transform active:scale-95 group/btn"
                  >
                    <RefreshCcw size={16} className="group-hover/btn:rotate-180 transition-transform duration-500" />
                  </button>
                </div>
              )}
            </div>

            {targetData && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="rounded-[1.5rem] border border-black/5 dark:border-white/5 bg-white/50 dark:bg-white/5 p-5 backdrop-blur-md shadow-xl">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="flex items-center gap-2 font-extrabold text-slate-900 dark:text-white text-base uppercase tracking-tight"><LayoutGrid size={18} className="text-cyan-500" /> Target Matrix</h3>
                  <div className="h-8 w-16 rounded-xl border-2 border-white dark:border-zinc-800 shadow-xl" style={{ backgroundColor: `hsl(${targetData.h * 360 / 4095}, ${65 - (targetData.s * 20 / 255)}%, ${75 - (targetData.l * 20 / 255)}%)` }} />
                </div>
                <div className="flex gap-6 items-center">
                  <div className="grid grid-cols-5 gap-1.5 w-32">
                    {Array.from({ length: 25 }).map((_, i) => {
                      const row = Math.floor(i / 5);
                      const col = i % 5;
                      const displayCol = col > 2 ? 4 - col : col;
                      const bitIndex = (2 - displayCol) * 5 + row;
                      const isActive = (targetData.pattern >> bitIndex) & 1;
                      return <div key={i} onClick={() => setTargetData({ ...targetData, pattern: targetData.pattern ^ (1 << bitIndex) })} className={`aspect-square rounded-md cursor-pointer transition-all duration-300 ${isActive ? 'bg-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.6)]' : 'bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10'}`} />;
                    })}
                  </div>
                  <div className="flex-1 space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-white/40"><span>Match Precision</span><span>{colorTolerance.toFixed(3)}</span></div>
                      <input type="range" min="0.001" max="0.1" step="0.001" value={colorTolerance} onChange={(e) => setColorTolerance(parseFloat(e.target.value))} className="w-full h-1.5 bg-slate-200 dark:bg-white/10 rounded-full appearance-none cursor-pointer accent-cyan-500" />
                    </div>
                    <button disabled={scanning} onClick={startScan} className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 dark:bg-white py-3 text-sm font-extrabold text-white dark:text-black transition-all hover:scale-[1.03] active:scale-[0.97] disabled:opacity-50 shadow-2xl shadow-cyan-500/10">
                      {scanning ? <><Search className="animate-spin" size={16} />Brute Forcing...</> : <><Cpu size={16} />BRUTE FORCE ID</>}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </section>

          {/* Top Right: ID Predictor */}
          <section>
            <div className="rounded-[1.5rem] border border-black/5 dark:border-white/5 bg-white/50 dark:bg-white/5 p-5 backdrop-blur-md shadow-xl">
              <h2 className="flex items-center gap-2 text-base font-extrabold text-slate-900 dark:text-white mb-5 uppercase tracking-[0.2em]">
                <Hash className="text-violet-500" size={18} /> ID Predictor
              </h2>
              <div className="space-y-5">
                <div className="relative group">
                  <input type="text" placeholder="Enter GitHub ID (e.g. 1)" value={predictId} onChange={(e) => handlePredict(e.target.value)} className="w-full rounded-xl border-2 border-black/5 dark:border-white/5 bg-white dark:bg-black/20 px-4 py-3 text-base font-bold text-slate-900 dark:text-white focus:border-violet-500 focus:outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-white/20 shadow-inner" />
                  <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/20 group-focus-within:text-violet-500 transition-colors" size={18} />
                </div>
                
                <AnimatePresence>
                  {predictedData ? (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} className="space-y-5 p-5 rounded-xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 shadow-inner">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-white/40">Simulation Matrix</span>
                        <button onClick={() => setTargetData(predictedData)} className="text-[10px] font-black text-violet-500 hover:text-white hover:bg-violet-500 transition-all uppercase tracking-widest bg-violet-500/10 px-3 py-1.5 rounded-lg">
                          Use as Target
                        </button>
                      </div>
                      <div className="flex items-center gap-8 justify-center">
                        <div className="grid grid-cols-5 gap-1.5 w-24">
                          {Array.from({ length: 25 }).map((_, i) => {
                            const row = Math.floor(i / 5);
                            const col = i % 5;
                            const displayCol = col > 2 ? 4 - col : col;
                            const bitIndex = (2 - displayCol) * 5 + row;
                            const isActive = (predictedData.pattern >> bitIndex) & 1;
                            return <div key={i} className={`aspect-square rounded-md ${isActive ? 'bg-violet-500 shadow-[0_0_12px_rgba(139,92,246,0.5)]' : 'bg-black/5 dark:bg-white/5'}`} />;
                          })}
                        </div>
                        <div className="h-24 w-24 rounded-xl border-4 border-white dark:border-zinc-800 shadow-xl overflow-hidden" style={{ backgroundColor: `hsl(${predictedData.h * 360 / 4095}, ${65 - (predictedData.s * 20 / 255)}%, ${75 - (predictedData.l * 20 / 255)}%)` }}>
                          <div className="w-full h-full opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]" />
                        </div>
                      </div>
                    </motion.div>
                  ) : (
                    <div className="h-48 flex flex-col items-center justify-center text-center space-y-4 border-2 border-dashed border-black/5 dark:border-white/5 rounded-xl">
                      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5"><Hash className="text-slate-300 dark:text-white/10" size={36} /></div>
                      <p className="text-xs font-bold text-slate-400 dark:text-white/30 uppercase tracking-widest">Input ID to generate matrix</p>
                    </div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </section>
        </div>

        {/* Bottom Section: Results */}
        <section className="space-y-6">
          <div className="flex items-center justify-between border-b-2 border-black/5 dark:border-white/10 pb-4">
            <h2 className="flex items-center gap-3 text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              <Users className="text-cyan-500" size={24} /> FOUND MATCHES
              {users.length > 0 && <span className="ml-2 text-xs font-extrabold px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 uppercase tracking-wide">{users.length}</span>}
            </h2>
            {scanning && (
              <div className="flex items-center gap-4">
                <span className="text-base font-extrabold text-cyan-500 tabular-nums">{progress}%</span>
                <div className="w-40 h-2 bg-black/5 dark:bg-white/5 rounded-full overflow-hidden shadow-inner">
                  <motion.div className="h-full bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.5)]" initial={{ width: 0 }} animate={{ width: `${progress}%` }} />
                </div>
              </div>
            )}
          </div>

          <AnimatePresence mode="wait">
            {scanning ? (
              <div className="flex flex-col items-center justify-center py-24 space-y-6">
                <div className="relative">
                  <div className="h-16 w-16 rounded-full border-4 border-cyan-500/10 border-t-cyan-500 animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center"><Search className="text-cyan-500 animate-pulse" size={24} /></div>
                </div>
                <div className="text-center space-y-1">
                  <h3 className="text-xl font-extrabold text-slate-900 dark:text-white uppercase tracking-wide">Cracking the code</h3>
                  <p className="text-slate-500 dark:text-white/40 font-semibold uppercase tracking-[0.3em] text-[10px]">Testing {maxId.toLocaleString()} candidates</p>
                </div>
              </div>
            ) : users.length > 0 ? (
              <div className="space-y-8">
                <div className="flex flex-col gap-4">
                  {currentDefaultUsers.map((user) => <UserCard key={user.id} user={user} type="default" />)}
                </div>
                
                {totalPages > 1 && (
                  <div className="flex justify-center items-center gap-4">
                    <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="p-3 rounded-xl border-2 border-black/5 dark:border-white/5 hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-20 transition-all shadow-lg active:scale-90">
                      <ChevronLeft size={18} />
                    </button>
                    <span className="text-sm font-black tabular-nums">Page {currentPage} / {totalPages}</span>
                    <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="p-3 rounded-xl border-2 border-black/5 dark:border-white/5 hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-20 transition-all shadow-lg active:scale-90">
                      <ChevronRight size={18} />
                    </button>
                  </div>
                )}

                {categorizedUsers.nonDefaultUsers.length > 0 && (
                  <div className="pt-6">
                    <button onClick={() => setShowNonDefault(!showNonDefault)} className="flex items-center justify-between w-full p-4 rounded-xl border-2 border-black/5 dark:border-white/5 bg-black/[0.03] dark:bg-white/[0.03] hover:bg-black/[0.05] dark:hover:bg-white/[0.05] transition-all group">
                      <span className="text-xs font-black uppercase tracking-[0.3em] flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-violet-500/10 text-violet-500"><Users size={16} /></div>
                        Custom Avatar Matches ({categorizedUsers.nonDefaultUsers.length})
                      </span>
                      <div className="p-2 rounded-xl bg-black/5 dark:bg-white/5 group-hover:bg-black/10 transition-colors">
                        {showNonDefault ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </div>
                    </button>
                    <AnimatePresence>
                      {showNonDefault && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                          <div className="flex flex-col gap-4 pt-6">
                            {categorizedUsers.nonDefaultUsers.map((user) => <UserCard key={user.id} user={user} type="custom" />)}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-24 text-center space-y-4">
                <div className="mx-auto w-24 h-24 rounded-xl bg-slate-50 dark:bg-white/5 flex items-center justify-center"><Search className="text-slate-200 dark:text-white/10" size={48} /></div>
                <p className="text-xs font-black text-slate-300 dark:text-white/20 uppercase tracking-[0.5em]">No data matching your query</p>
              </div>
            )}
          </AnimatePresence>
        </section>
      </div>
      <canvas ref={canvasRef} className="hidden" />
    </main>
  );
}
