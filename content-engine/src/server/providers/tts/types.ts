export type TTSResult = { audio: Buffer; mimeType: "audio/wav" | "audio/mpeg"; durationMs: number; ext: "wav" | "mp3" };

export interface TTSProvider {
  readonly name: string;
  synthesize(text: string, opts?: { voice?: string; speed?: number }): Promise<TTSResult>;
}
