import { AppSettings, getSettings } from './settings';

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  images?: string[]; // base64 strings
}

export interface LLMOptions {
  temperature?: number;
  maxTokens?: number;
}

export async function generateText(prompt: string, options: LLMOptions = {}): Promise<string> {
  const settings = await getSettings();
  const messages: LLMMessage[] = [{ role: 'user', content: prompt }];
  return chat(messages, options);
}

export async function chat(messages: LLMMessage[], options: LLMOptions = {}): Promise<string> {
  const settings = await getSettings();
  const provider = settings.llm_provider || 'ollama';

  switch (provider) {
    case 'openai':
      return chatOpenAI(messages, settings, options);
    case 'anthropic':
      return chatAnthropic(messages, settings, options);
    case 'gemini':
      return chatGemini(messages, settings, options);
    case 'ollama':
    default:
      return chatOllama(messages, settings, options);
  }
}

async function chatOllama(messages: LLMMessage[], settings: AppSettings, options: LLMOptions): Promise<string> {
  const url = settings.ollama_url || "http://localhost:11434";
  const model = settings.ollama_model || "llama3";

  const response = await fetch(`${url}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: messages.map(m => ({ role: m.role, content: m.content, images: m.images })),
      stream: false,
      options: {
        temperature: options.temperature ?? 0.7,
        num_predict: options.maxTokens,
      }
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Ollama API error: ${errorText}`);
  }

  const data = await response.json();
  return data.message.content;
}

async function chatOpenAI(messages: LLMMessage[], settings: AppSettings, options: LLMOptions): Promise<string> {
  const apiKey = settings.openai_api_key;
  const model = settings.openai_model || "gpt-4o";

  if (!apiKey) throw new Error("OpenAI API key is not configured.");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: messages.map(m => {
        if (m.images && m.images.length > 0) {
          return {
            role: m.role,
            content: [
              { type: 'text', text: m.content },
              ...m.images.map(img => ({
                type: 'image_url',
                image_url: { url: `data:image/jpeg;base64,${img}` }
              }))
            ]
          };
        }
        return { role: m.role, content: m.content };
      }),
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`OpenAI API error: ${errorData.error?.message || response.statusText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

async function chatAnthropic(messages: LLMMessage[], settings: AppSettings, options: LLMOptions): Promise<string> {
  const apiKey = settings.anthropic_api_key;
  const model = settings.anthropic_model || "claude-3-5-sonnet-20240620";

  if (!apiKey) throw new Error("Anthropic API key is not configured.");

  const systemMessage = messages.find(m => m.role === 'system')?.content;
  const otherMessages = messages.filter(m => m.role !== 'system');

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model,
      system: systemMessage,
      messages: otherMessages.map(m => {
        if (m.images && m.images.length > 0) {
          return {
            role: m.role === 'user' ? 'user' : 'assistant',
            content: [
              ...m.images.map(img => ({
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/jpeg',
                  data: img
                }
              })),
              { type: 'text', text: m.content }
            ]
          };
        }
        return { role: m.role === 'user' ? 'user' : 'assistant', content: m.content };
      }),
      max_tokens: options.maxTokens || 4096,
      temperature: options.temperature ?? 0.7,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Anthropic API error: ${errorData.error?.message || response.statusText}`);
  }

  const data = await response.json();
  return data.content[0].text;
}

async function chatGemini(messages: LLMMessage[], settings: AppSettings, options: LLMOptions): Promise<string> {
  const apiKey = settings.gemini_api_key;
  const model = settings.gemini_model || "gemini-1.5-pro";

  if (!apiKey) throw new Error("Gemini API key is not configured.");

  const systemMessage = messages.find(m => m.role === 'system')?.content;
  const otherMessages = messages.filter(m => m.role !== 'system');

  // Gemini doesn't have a direct "system" role in the messages array in the same way, 
  // but we can use systemInstruction in the v1beta API or just prepend to the first message.
  // We'll use the v1beta API which supports system_instruction.
  
  const contents = otherMessages.map(m => {
    const parts: any[] = [{ text: m.content }];
    if (m.images && m.images.length > 0) {
      m.images.forEach(img => {
        parts.push({
          inline_data: {
            mime_type: 'image/jpeg',
            data: img
          }
        });
      });
    }
    return {
      role: m.role === 'user' ? 'user' : 'model',
      parts
    };
  });

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents,
      system_instruction: systemMessage ? { parts: [{ text: systemMessage }] } : undefined,
      generationConfig: {
        temperature: options.temperature ?? 0.7,
        maxOutputTokens: options.maxTokens,
      }
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Gemini API error: ${errorData.error?.message || response.statusText}`);
  }

  const data = await response.json();
  return data.candidates[0].content.parts[0].text;
}
