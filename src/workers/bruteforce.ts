import init, { find_matches } from '../lib/wasm-pkg/wasm_bruteforcer';

self.onmessage = async (e: MessageEvent) => {
    const { targetPattern, startId, endId, wasmUrl } = e.data;

    console.log(`[Worker] Starting range: ${startId} - ${endId}`);
    console.log(`[Worker] Target pattern: ${targetPattern} (binary: ${targetPattern.toString(2).padStart(15, '0')}, hex: 0x${targetPattern.toString(16)})`);

    try {
        console.log(`[Worker] Initializing WASM from: ${wasmUrl}`);
        await init({ module_or_path: wasmUrl });
        console.log(`[Worker] WASM initialized successfully`);

        const matches = find_matches(targetPattern, startId, endId);
        console.log(`[Worker] Range ${startId}-${endId} done. Found ${matches.length} matches.`);

        if (matches.length > 0) {
            console.log(`[Worker] Matches found:`, Array.from(matches).slice(0, 10));
        }

        self.postMessage({ type: 'SUCCESS', matches, startId, endId });
    } catch (error) {
        console.error(`[Worker] Error in range ${startId}:`, error);
        self.postMessage({ type: 'ERROR', error: String(error), startId, endId });
    }
};
