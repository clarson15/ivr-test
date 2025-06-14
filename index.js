import http from 'http';
import 'dotenv/config';

import express from 'express';
import { WebSocketServer } from 'ws';
import Vad from 'node-vad';
import net from 'net';

import { answerCall } from './answerCall.js';
import { AudioBuffer } from './audioBuffer.js';
import { setupLogger } from './logger.js';
import { OllamaClient } from './ollama.js';
import { KokoroClient } from './kokoro.js';
import { kokoroToPcmuBase64, pcmuToPcm16Buffer } from './audioConversion.js';

// todo: support streaming to faster whisper, stream ollama responses to kokoro, and stream kokoro responses to telnyx
// todo: split functionality into more files, create a call concept to manage call state and track conversational context


const TELNYX_API_TOKEN = process.env.TELNYX_API_TOKEN;
const TELNYX_STREAM_URL = process.env.TELNYX_STREAM_URL;
const TELNYX_APP_PORT = process.env.TELNYX_APP_PORT || 6000;
const API_HEADERS = {
    'Authorization': `Bearer ${TELNYX_API_TOKEN}`,
    'Content-Type': 'application/json'
};
const COMMAND_ID = "891510ac-f3e4-11e8-af5b-de00688a4901";
const CLIENT_STATE = "aGF2ZSBhIG5pY2UgZGF5ID1d";

setupLogger();
const app = express();
app.use(express.json());
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/websocket" });
const vadInstance = new Vad(Vad.Mode.NORMAL);
const ollamaClient = new OllamaClient(process.env.OLLAMA_HOST, process.env.OLLAMA_PORT);
const kokoroClient = new KokoroClient(process.env.KOKORO_HOST, process.env.KOKORO_PORT);
var speaking = false;
var silenceStart = null;

async function transcribeBuffer(buffer, ws) {
    const wyomSock = new net.Socket();
    wyomSock.connect(process.env.WHISPER_PORT, process.env.WHISPER_HOST);
    wyomSock.on('data', (data) => {
        var dataString = data.toString().trim();
        try {
            var packets = dataString.split("\n");
            for (var packet of packets) {
                var packetJson = JSON.parse(packet);
                if (packetJson.text) {
                    var text = packetJson.text.trim();
                    if (text.length !== 0) {
                        console.log("Transcription received:", text);
                        ollamaClient.generate(text).then(async (response) => {
                            console.log("Ollama response:", response);
                            const kokoroResponse = await kokoroClient.speak(response);
                            kokoroToPcmuBase64(kokoroResponse, (base64Audio) => {
                                ws.send(JSON.stringify({
                                    event: "media",
                                    media: {
                                        payload: base64Audio
                                    }
                                }));
                            });
                        }).catch(err => {
                            console.error("Ollama generation error:", err);
                        });
                    }
                }
            }
        }
        catch (error) {
            console.error("Error parsing response:", error);
        }
        wyomSock.end();
    });

    wyomSock.on('error', (error) => {
        console.error("Socket error:", error);
    });
    const startCommand = {
        type: "audio-start",
        data: { rate: 16000, width: 2, channels: 1, timestamp: 0 },
        data_length: 0,
        payload_length: 0
    };
    wyomSock.write(Buffer.from(JSON.stringify(startCommand) + "\n"));
    const chunkCommand = {
        type: "audio-chunk",
        data: { rate: 16000, width: 2, channels: 1, timestamp: 0 },
        data_length: 0,
        payload_length: buffer.length
    };
    const header3 = Buffer.from(JSON.stringify(chunkCommand) + "\n");
    wyomSock.write(Buffer.concat([header3, buffer]));
    const stopCommand = {
        type: "audio-stop",
        data: { timestamp: 0 },
        data_length: 0,
        payload_length: 0
    };
    wyomSock.write(Buffer.from(JSON.stringify(stopCommand) + "\n"));
    console.log("Transcription request sent");
}

async function setupServer() {

    app.post('/webhook', async (req, res) => {
        const { event_type: eventType, payload } = req.body.data;
        const callControlId = payload?.call_control_id;
        console.log('received webhook:', eventType);

        switch (eventType) {
            case 'call.initiated':
                if (callControlId) {
                    console.log(`Answering call: ${callControlId}`);
                    await answerCall(callControlId, CLIENT_STATE, COMMAND_ID, TELNYX_STREAM_URL, API_HEADERS);
                }
                break;
        }
        res.json({ status: 'received' });
    });

    wss.on('connection', function connection(ws) {
        console.log("WebSocket connection opened");
        var audioBuffer = new AudioBuffer((data) => {
            if (data.length > 60) {
                transcribeBuffer(data, ws).catch(err => {
                    console.error("Transcription error:", err);
                });
            }
        });
        ws.on('message', function incoming(message) {
            const data = JSON.parse(message);

            if (data.event === "media") {
                const chunk = Buffer.from(data.media.payload, 'base64');
                if (!audioBuffer.contains(data.sequence_number)) {
                    pcmuToPcm16Buffer(chunk, (processedChunk) => {
                        if (processedChunk.length === 0) {
                            return;
                        }

                        vadInstance.processAudio(processedChunk, 16000).then((res => {
                            if (silenceStart != null && res === Vad.Event.VOICE) {
                                silenceStart = null;
                                speaking = true;
                            }
                            else if (silenceStart == null && res === Vad.Event.SILENCE) {
                                silenceStart = Date.now();
                            }
                            else if (speaking && silenceStart != null && res === Vad.Event.SILENCE && Date.now() - silenceStart > 500) {
                                audioBuffer.flush();
                                speaking = false;
                            }
                            if (speaking) {
                                audioBuffer.add(processedChunk, data.sequence_number);
                            }
                        }));
                    });
                }
            } else if (data.event === "flush") {
                audioBuffer.flush();
            }
        });
    });

    server.listen(TELNYX_APP_PORT, '0.0.0.0', () => console.log(`HTTP and WebSocket Server started on http://0.0.0.0:${TELNYX_APP_PORT}`));
}

setupServer().catch(console.error);