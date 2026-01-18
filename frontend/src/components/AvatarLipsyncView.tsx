import { useEffect, useRef } from 'react';
import { TalkingHead } from '@met4citizen/talkinghead';

interface AvatarLipsyncViewProps {
  containerRef: React.RefObject<HTMLDivElement>;
}

export default function AvatarLipsyncView({ containerRef }: AvatarLipsyncViewProps) {
  const headRef = useRef<any>(null);

  useEffect(() => {
    const initTalkingHead = async () => {
      if (!containerRef.current || headRef.current) return;

      try {
        const head = new TalkingHead(containerRef.current, {
          ttsEndpoint: "https://texttospeech.googleapis.com/v1/text:synthesize",
          cameraView: 'upper',
          avatarMood: 'neutral',
          lipsyncModules: ["en"]
        });

        if (head?.renderer?.setClearColor) {
          head.renderer.setClearColor(0x000000, 0);
        }

        containerRef.current.style.background = 'transparent';

        await head.showAvatar({
          url: 'https://models.readyplayer.me/696c0b59b01cd8746d2eb787.glb?morphTargets=ARKit,Oculus+Visemes,mouthOpen,mouthSmile,eyesClosed,eyesLookUp,eyesLookDown&textureSizeLimit=1024&textureFormat=png',
          body: 'F',
          avatarMood: 'neutral',
          ttsLang: "en-GB",
          ttsVoice: "en-GB-Standard-A",
          lipsyncLang: 'en'
        });

        const canvas = containerRef.current.querySelector('canvas');
        if (canvas) {
          canvas.style.background = 'transparent';
        }

        headRef.current = head;
      } catch (error) {
        console.error('Error initializing TalkingHead:', error);
      }
    };

    initTalkingHead();

    return () => {
      if (headRef.current) {
        headRef.current = null;
      }
    };
  }, [containerRef]);

  return null;
}
