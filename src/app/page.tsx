'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Search, Users, Shield, Cpu, RefreshCcw, LayoutGrid, Sun, Moon, Hash } from 'lucide-react';
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

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const workersRef = useRef<Worker[]>([]);

  const testPatternMatch = async () => {
    const testId = 1;
    const testIdStr = testId.toString();

    console.log(`[Test] ========== Testing ID ${testId} ==========`);
    console.log(`[Test] Input string: "${testIdStr}"`);

    // Calculate hash
    const hash = CryptoJS.MD5(testIdStr).toString();
    console.log(`[Test] MD5 hash: ${hash}`);
    console.log(`[Test] Expected:  c4ca4238a0b923820dcc509a6f75849b`);
    console.log(`[Test] Match: ${hash === 'c4ca4238a0b923820dcc509a6f75849b' ? '✅' : '❌'}`);

    // Extract bytes
    const bytes = [];
    for (let c = 0; c < hash.length; c += 2) {
      bytes.push(parseInt(hash.substr(c, 2), 16));
    }
    console.log(`[Test] First 8 bytes:`, bytes.slice(0, 8).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));

    // Calculate pattern
    let pattern = 0;
    const nibbles = [];
    for (let i = 0; i < 15; i++) {
      const byteIdx = Math.floor(i / 2);
      const byte = bytes[byteIdx];
      const nibble = i % 2 === 0 ? (byte >> 4) & 0x0f : byte & 0x0f;
      nibbles.push(nibble);
      if (nibble % 2 === 0) pattern |= (1 << i);
    }
    console.log(`[Test] Nibbles:`, nibbles.map(n => n.toString(16)).join(' '));
    console.log(`[Test] Pattern: ${pattern} (binary: ${pattern.toString(2).padStart(15, '0')}, hex: 0x${pattern.toString(16)})`);
    console.log(`[Test] Expected pattern: 21439 (binary: 101001110111111, hex: 0x53bf)`);
    console.log(`[Test] Pattern match: ${pattern === 21439 ? '✅' : '❌'}`);

    // Test with WASM
    console.log(`[Test] Now testing with WASM...`);
    const worker = new Worker(new URL('../workers/bruteforce.ts', import.meta.url));
    worker.onmessage = (e) => {
      if (e.data.type === 'SUCCESS') {
        console.log(`[Test] WASM returned ${e.data.matches.length} matches:`, Array.from(e.data.matches));
        if (e.data.matches.includes(testId)) {
          console.log(`[Test] ✅ SUCCESS! WASM found ID ${testId}`);
        } else {
          console.log(`[Test] ❌ FAILED! WASM did not find ID ${testId}`);
          console.log(`[Test] This means the WASM is calculating a different pattern for ID ${testId}`);
        }
      } else if (e.data.type === 'ERROR') {
        console.error(`[Test] ❌ WASM Error:`, e.data.error);
      }
      worker.terminate();
    };
    worker.postMessage({
      targetPattern: pattern,
      startId: testId,
      endId: testId,
      wasmUrl: '/wasm/wasm_bruteforcer_bg.wasm'
    });
  };

  const handlePredict = (id: string) => {
    setPredictId(id);
    const trimmedId = id.trim();
    if (!trimmedId || isNaN(parseInt(trimmedId))) {
      setPredictedData(null);
      return;
    }

    const hash = CryptoJS.MD5(trimmedId).toString();
    console.log(`[Predict] ID: "${trimmedId}", MD5: ${hash}`);
    const bytes = [];
    for (let c = 0; c < hash.length; c += 2) {
      bytes.push(parseInt(hash.substr(c, 2), 16));
    }
    console.log(`[Predict] First 8 bytes:`, bytes.slice(0, 8).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));

    let pattern = 0;
    const nibbles = [];
    for (let i = 0; i < 15; i++) {
      const byteIdx = Math.floor(i / 2);
      const byte = bytes[byteIdx];
      const nibble = i % 2 === 0 ? (byte >> 4) & 0x0f : byte & 0x0f;
      nibbles.push(nibble);
      if (nibble % 2 === 0) pattern |= (1 << i);
    }
    console.log(`[Predict] Nibbles:`, nibbles.map(n => n.toString(16)).join(' '));
    console.log(`[Predict] Pattern: ${pattern} (binary: ${pattern.toString(2).padStart(15, '0')}), hex: 0x${pattern.toString(16)}`);

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
    console.log(`[Scan] WASM found ${foundIds.length} shape matches.`);
    setScanning(false);
    workersRef.current.forEach(w => w.terminate());
    workersRef.current = [];
    if (foundIds.length === 0) { console.warn("[Scan] No shape matches found."); return; }
    
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
      return { id, distance, h, s, l };
    });
    
    const sorted = [...rankedIds].sort((a,b) => a.distance - b.distance);
    console.log("[Scan] Top 5 closest matches:", sorted.slice(0, 5));

    const filtered = sorted.filter(item => item.distance < colorTolerance);
    const sortedIds = filtered.map(item => item.id).slice(0, 50);
    setMatches(sortedIds);
    console.log(`[Scan] After color filtering (tolerance ${colorTolerance}): ${sortedIds.length} matches`);

    if (sortedIds.length > 0) {
      confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, colors: ['#00f2ff', '#7000ff', '#ffffff'] });
      setApiError(null);
      let successCount = 0;
      let errorCount = 0;
      const userData = await Promise.all(sortedIds.map(async (id) => {
        try {
          const res = await fetch(`https://api.github.com/user/${id}`);
          if (res.ok) {
            successCount++;
            return res.json();
          } else if (res.status === 403) {
            errorCount++;
            return null;
          }
          return null;
        } catch (e) {
          errorCount++;
          return null;
        }
      }));

      if (errorCount > 0) {
        setApiError(`GitHub API限速：成功${successCount}个，失败${errorCount}个。匹配的ID: ${sortedIds.slice(0, 10).join(', ')}${sortedIds.length > 10 ? '...' : ''}`);
      }

      setUsers(userData.filter(u => u !== null));
    }
  };

  return (
    <main className="min-h-screen bg-white dark:bg-black text-slate-900 dark:text-white selection:bg-cyan-500/30 transition-colors duration-500">
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(240,240,255,1),rgba(255,255,255,1))] dark:bg-[radial-gradient(circle_at_50%_50%,rgba(20,20,30,1),rgba(0,0,0,1))]" />
      <div className="fixed inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.05] dark:opacity-20 pointer-events-none" />

      <div className="relative z-10 mx-auto max-w-6xl px-6 py-12 md:py-24">
        <div className="absolute right-6 top-6 flex gap-2">
          <button onClick={testPatternMatch} className="flex h-12 px-4 items-center justify-center rounded-2xl border border-black/10 dark:border-white/10 bg-white/50 dark:bg-white/5 text-slate-900 dark:text-white backdrop-blur-md transition-all hover:scale-110 active:scale-95 text-xs font-bold">
            TEST
          </button>
          <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="flex h-12 w-12 items-center justify-center rounded-2xl border border-black/10 dark:border-white/10 bg-white/50 dark:bg-white/5 text-slate-900 dark:text-white backdrop-blur-md transition-all hover:scale-110 active:scale-95">
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>

        <header className="mb-16 text-center">
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="inline-flex items-center gap-2 rounded-full border border-black/10 dark:border-white/10 bg-white/50 dark:bg-white/5 px-4 py-1.5 text-sm font-medium text-cyan-600 dark:text-cyan-400 backdrop-blur-md">
            <Shield size={14} /> GitHub Identicon Decoder
          </motion.div>
          <h1 className="mt-6 text-5xl font-bold tracking-tight md:text-7xl text-slate-900 dark:text-white">
            Trace the <span className="bg-gradient-to-r from-cyan-600 to-violet-600 dark:from-cyan-400 dark:to-violet-500 bg-clip-text text-transparent">Invisible.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-500 dark:text-white/50">
            Upload a GitHub default avatar to brute-force the user ID using client-side WebAssembly.
          </p>
        </header>

        <div className="grid gap-12 lg:grid-cols-2">
          <section className="space-y-8">
            <div className="rounded-3xl border border-black/10 dark:border-white/10 bg-white/50 dark:bg-white/5 p-8 backdrop-blur-md">
              <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900 dark:text-white mb-6">
                <Hash className="text-cyan-500" size={20} /> ID Predictor
              </h2>
              <div className="space-y-4">
                <input type="text" placeholder="Enter GitHub ID (e.g. 1)" value={predictId} onChange={(e) => handlePredict(e.target.value)} className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-white/50 dark:bg-black/20 px-4 py-3 text-slate-900 dark:text-white focus:border-cyan-500 focus:outline-none transition-all" />
                {predictedData && (
                  <div className="space-y-6 pt-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-500 dark:text-white/40">Predicted Result</span>
                      <button onClick={() => setTargetData(predictedData)} className="text-xs font-bold text-cyan-500 hover:text-cyan-400 transition-colors uppercase tracking-widest">Set as Target</button>
                    </div>
                    <div className="flex items-center gap-8 justify-center p-6 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5">
                      <div className="grid grid-cols-5 gap-1 w-24">
                        {Array.from({ length: 25 }).map((_, i) => {
                          const row = Math.floor(i / 5);
                          const col = i % 5;
                          const displayCol = col > 2 ? 4 - col : col;
                          const bitIndex = (2 - displayCol) * 5 + row;
                          const isActive = (predictedData.pattern >> bitIndex) & 1;
                          return <div key={i} className={`aspect-square rounded-sm ${isActive ? 'bg-cyan-500' : 'bg-black/10 dark:bg-white/10'}`} />;
                        })}
                      </div>
                      <div className="h-24 w-24 rounded-2xl border border-black/10 dark:border-white/20 shadow-xl" style={{ backgroundColor: `hsl(${predictedData.h * 360 / 4095}, ${65 - (predictedData.s * 20 / 255)}%, ${75 - (predictedData.l * 20 / 255)}%)` }} />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className={`group relative aspect-square cursor-pointer overflow-hidden rounded-3xl border-2 border-dashed transition-all ${image ? 'border-slate-200 dark:border-white/20' : 'border-slate-300 dark:border-white/10 hover:border-cyan-500/50 hover:bg-slate-50 dark:hover:bg-white/5'}`} onClick={() => fileInputRef.current?.click()}>
              <input type="file" ref={fileInputRef} onChange={handleUpload} className="hidden" accept="image/*" />
              {image ? (
                <div className="relative h-full w-full"><img src={image} className="h-full w-full object-contain" alt="Upload" /><div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"><RefreshCcw className="text-white" /></div></div>
              ) : (
                <div className="flex h-full flex-col items-center justify-center space-y-4">
                  <div className="rounded-full bg-slate-100 dark:bg-white/5 p-4 group-hover:scale-110 transition-transform"><Upload className="text-slate-400 dark:text-white/40" size={32} /></div>
                  <div className="text-center"><p className="font-medium text-slate-900 dark:text-white">Drop screenshot here</p><p className="text-sm text-slate-400 dark:text-white/40">or click to browse</p></div>
                </div>
              )}
            </div>

            {targetData && (
              <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white/50 dark:bg-white/5 p-6 backdrop-blur-md">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white"><LayoutGrid size={18} /> Extracted Pattern</h3>
                  <div className="h-6 w-12 rounded-full border border-black/10 dark:border-white/20" style={{ backgroundColor: `hsl(${targetData.h * 360 / 4095}, ${65 - (targetData.s * 20 / 255)}%, ${75 - (targetData.l * 20 / 255)}%)` }} />
                </div>
                <div className="grid grid-cols-5 gap-1 aspect-square w-32 mx-auto">
                  {Array.from({ length: 25 }).map((_, i) => {
                    const row = Math.floor(i / 5);
                    const col = i % 5;
                    const displayCol = col > 2 ? 4 - col : col;
                    const bitIndex = (2 - displayCol) * 5 + row;
                    const isActive = (targetData.pattern >> bitIndex) & 1;
                    return <div key={i} onClick={() => setTargetData({ ...targetData, pattern: targetData.pattern ^ (1 << bitIndex) })} className={`rounded-sm cursor-pointer transition-colors duration-200 ${isActive ? 'bg-cyan-500 hover:bg-cyan-400' : 'bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10'}`} />;
                  })}
                </div>
                <div className="mt-6 space-y-4">
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-white/40"><span>Hue: {targetData.h}</span><span>Sat: {targetData.s}</span><span>Lum: {targetData.l}</span></div>
                  <div className="space-y-2">
                    <input type="range" min="0" max="4095" value={targetData.h} onChange={(e) => setTargetData({...targetData, h: parseInt(e.target.value)})} className="w-full h-1 bg-slate-200 dark:bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-500" />
                    <input type="range" min="0" max="255" value={targetData.s} onChange={(e) => setTargetData({...targetData, s: parseInt(e.target.value)})} className="w-full h-1 bg-slate-200 dark:bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-500" />
                    <input type="range" min="0" max="255" value={targetData.l} onChange={(e) => setTargetData({...targetData, l: parseInt(e.target.value)})} className="w-full h-1 bg-slate-200 dark:bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-500" />
                  </div>
                  <div className="pt-2 border-t border-black/5 dark:border-white/5">
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-white/40 mb-2">
                      <span>颜色容差</span>
                      <span className="font-mono">{colorTolerance.toFixed(2)}</span>
                    </div>
                    <input type="range" min="0.01" max="0.5" step="0.01" value={colorTolerance} onChange={(e) => setColorTolerance(parseFloat(e.target.value))} className="w-full h-1 bg-slate-200 dark:bg-white/10 rounded-lg appearance-none cursor-pointer accent-violet-500" />
                    <div className="flex justify-between text-xs text-slate-400 dark:text-white/30 mt-1">
                      <span>严格</span>
                      <span>宽松</span>
                    </div>
                  </div>
                </div>
                <button disabled={scanning} onClick={startScan} className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 dark:bg-white py-3 font-bold text-white dark:text-black transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50">
                  {scanning ? <><Search className="animate-spin" size={18} />Scanning {progress}%...</> : <><Cpu size={18} />Brute Force IDs</>}
                </button>
              </div>
            )}
          </section>

          <section className="space-y-6">
            <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900 dark:text-white"><Users size={20} /> Results {matches.length > 0 && <span className="ml-2 text-sm font-normal text-cyan-600 dark:text-cyan-400">{matches.length} matches</span>}</h2>
            {apiError && (
              <div className="rounded-2xl border border-orange-500/20 bg-orange-500/10 p-4 backdrop-blur-md">
                <p className="text-sm text-orange-600 dark:text-orange-400">{apiError}</p>
              </div>
            )}
            <div className="min-h-[400px] rounded-3xl border border-black/10 dark:border-white/10 bg-white/50 dark:bg-white/5 p-2 backdrop-blur-md">
              <AnimatePresence mode="popLayout">
                {scanning ? (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex h-full flex-col items-center justify-center space-y-6 py-20">
                    <div className="relative"><div className="h-24 w-24 rounded-full border-t-2 border-cyan-500 animate-spin" /><Search className="absolute inset-0 m-auto text-cyan-500" size={32} /></div>
                    <div className="text-center"><p className="text-lg font-medium text-slate-900 dark:text-white">Scanning {maxId.toLocaleString()} IDs</p><p className="text-sm text-slate-500 dark:text-white/40">Multi-core WASM acceleration</p></div>
                    <div className="w-64 h-1.5 bg-black/5 dark:bg-white/5 rounded-full overflow-hidden"><motion.div className="h-full bg-cyan-500" initial={{ width: 0 }} animate={{ width: `${progress}%` }} /></div>
                  </motion.div>
                ) : users.length > 0 ? (
                  <div className="space-y-4 p-4">
                    <div className="space-y-4">{users.map((user) => <UserCard key={user.id} user={user} type="default" />)}</div>
                  </div>
                ) : <div className="flex h-full flex-col items-center justify-center py-40 text-center space-y-4"><p className="text-slate-400 dark:text-white/40">{!image ? "Upload an image to start searching" : "No matches found yet."}</p></div>}
              </AnimatePresence>
            </div>
          </section>
        </div>
      </div>
      <canvas ref={canvasRef} className="hidden" />
    </main>
  );
}
