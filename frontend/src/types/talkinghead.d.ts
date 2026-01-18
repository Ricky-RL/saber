declare module '@met4citizen/talkinghead' {
  export class TalkingHead {
    constructor(container: HTMLElement, options?: any);
    showAvatar(options: any): Promise<void>;
    speakAudio(audio: Int16Array | ArrayBuffer, options?: any): void;
    speakText(text: string, options?: any): void;
    setMood(mood: string): void;
    dispose(): void;
  }
}
