import OpenAI from 'openai';

export class KokoroClient {

    constructor(host, port, voice = 'af_nova+af_river') {
        console.log(`Initializing KokoroClient with host: ${host}, port: ${port}, voice: ${voice}`);
        this.client = new OpenAI.OpenAI({
            baseURL: `http://${host}:${port}/v1`,
            apiKey: 'not_needed'
        });
        this.voice = voice;
    }

    async speak(text) {
        try {
            const response = await this.client.audio.speech.create({
                model: 'kokoro',
                voice: this.voice,
                input: text,
                response_format: 'pcm'
            });
            var arrayBuffer = await response.arrayBuffer();
            return Buffer.from(arrayBuffer);
        } catch (error) {
            console.error('Error generating speech:', error);
            throw error;
        }
    }
}