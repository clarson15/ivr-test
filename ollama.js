import { Ollama } from 'ollama';

export class OllamaClient {

    constructor(host, port, model = 'llama3.1:8b') {
        console.log(`Initializing OllamaClient with host: ${host}, port: ${port}, model: ${model}`);
        this.ollama = new Ollama({ host: `${host}:${port}` });
        this.model = model;
    }

    async generate(prompt, options = {}) {
        try {
            const response = await this.ollama.chat({
                model: this.model,
                messages: [
                    { role: 'system', content: 'You are Stacey. Act and respond exactly like Stacey. Your responses will be read over the phone, so write in a more natural, conversational style.' },
                    { role: 'user', content: prompt }],
                ...options
            });
            return response.message.content;
        } catch (error) {
            console.error('Error generating response from Ollama:', error);
            throw error;
        }
    }
}