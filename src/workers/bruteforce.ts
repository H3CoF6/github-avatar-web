import init, { find_matches } from '../lib/wasm-pkg/wasm_bruteforcer';

self.onmessage = async (e: MessageEvent) => {
    const { targetPattern, startId, endId, wasmUrl } = e.data;
    
    console.log(`[Worker] Starting range: ${startId} - ${endId}, Target: ${targetPattern}`);
    
    try {
        await init({ module_or_path: wasmUrl });
        const matches = find_matches(targetPattern, startId, endId);
        console.log(`[Worker] Range ${startId} done. Found ${matches.length} matches.`);
        self.postMessage({ type: 'SUCCESS', matches, startId, endId });
    } catch (error) {
        console.error(`[Worker] Error in range ${startId}:`, error);
        self.postMessage({ type: 'ERROR', error: String(error), startId, endId });
    }
};
