export class AudioBuffer {

    constructor(flushCallback, flushInterval = -1) {
        if (typeof flushCallback !== 'function') {
            throw new Error('flushCallback must be a function');
        }
        if (typeof flushInterval !== 'number') {
            throw new Error('flushInterval must be a number');
        }

        this.buffer = {};
        this.flushCallback = flushCallback;
        this.lastFlushTime = Date.now();
        this.flushInterval = flushInterval;
    }

    add(chunk, sequenceNumber) {
        this.buffer[sequenceNumber] = chunk;

        const currentTime = Date.now();
        if (this.flushInterval > 0 && currentTime - this.lastFlushTime > this.flushInterval) {
            this.flush();
        }
    }

    flush() {
        var keys = Object.keys(this.buffer).map(Number);
        keys.sort((a, b) => a - b);
        var chunksToFlush = keys.map(key => this.buffer[key]);
        if (chunksToFlush.length > 0) {
            try {
                const combinedChunks = Buffer.concat(chunksToFlush);
                this.flushCallback(combinedChunks);
            } catch (error) {
                console.error('Error flushing audio buffer:', error);
            } finally {
                this.buffer = {};
                this.lastFlushTime = Date.now();
            }
        }
    }

    contains(sequenceNumber) {
        return this.buffer[sequenceNumber] !== undefined;
    }

    isBufferEmpty() {
        return Object.keys(this.buffer).length === 0;
    }

    getBufferSize() {
        return Object.keys(this.buffer).length;
    }
}