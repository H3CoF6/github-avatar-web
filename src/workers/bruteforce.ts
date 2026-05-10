import init, { find_matches } from '../lib/wasm-pkg/wasm_bruteforcer';

self.onmessage = async (e: MessageEvent) => {
    const { targetPattern, targetH, targetS, targetL, startId, endId, wasmUrl } = e.data;
    
    try {
        await init(wasmUrl);
        const matches = find_matches(targetPattern, targetH, targetS, targetL, startId, endId);
        self.postMessage({ type: 'SUCCESS', matches, startId, endId });
    } catch (error) {
        self.postMessage({ type: 'ERROR', error: String(error), startId, endId });
    }
};
