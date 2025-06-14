import { spawn } from 'child_process';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from '@ffmpeg-installer/ffmpeg';

ffmpeg.setFfmpegPath(ffmpegPath.path);

export function kokoroToPcmuBase64(kokoroBuffer, callback) {
    const ff = spawn(ffmpegPath.path, [
        '-f', 's16le',
        '-ar', '24000',
        '-ac', '1',
        '-i', 'pipe:0',
        '-ar', '8000',
        '-ac', '1',
        '-f', 'mulaw',
        'pipe:1'
    ], { stdio: ['pipe', 'pipe', 'ignore'] });

    const chunks = [];
    ff.stdout.on('data', c => chunks.push(c));
    ff.on('close', code => {
        if (code !== 0) {
            console.error(`ffmpeg exited ${code}`);
            console.error(`Error output: ${Buffer.concat(errorChunks).toString()}`);
            return;
        }
        const muLawBuffer = Buffer.concat(chunks);
        callback(muLawBuffer.toString('base64'));
    });

    // feed raw PCM into ffmpeg stdin
    ff.stdin.write(kokoroBuffer);
    ff.stdin.end();
}

export function pcmuToPcm16Buffer(pcmuBuffer, callback) {
    const ff = spawn(ffmpegPath.path, [
        '-f', 'mulaw',
        '-ar', '8000',
        '-ac', '1',
        '-i', 'pipe:0',
        '-f', 's16le',
        '-ar', '16000',
        '-ac', '1',
        'pipe:1'
    ], { stdio: ['pipe', 'pipe', 'ignore'] });

    const chunks = [];
    ff.stdout.on('data', c => chunks.push(c));
    ff.on('close', code => {
        if (code !== 0) console.error(`ffmpeg exited ${code}`);
        else callback(Buffer.concat(chunks));
    });

    ff.stdin.write(pcmuBuffer);
    ff.stdin.end();
}