import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

interface AvatarProps {
  modelUrl?: string;
}

export default function Avatar({ modelUrl }: AvatarProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [text, setText] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const sceneRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    model: THREE.Group | null;
    mouth: THREE.Object3D | null;
    animationId: number | null;
  } | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const elevenSocketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x202020);

    const camera = new THREE.PerspectiveCamera(
      75,
      canvas.clientWidth / canvas.clientHeight,
      0.1,
      1000
    );
    camera.position.z = 5;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);

    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(5, 5, 5);
    scene.add(light);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    sceneRef.current = {
      scene,
      camera,
      renderer,
      model: null,
      mouth: null,
      animationId: null,
    };

    const loadModel = async (url?: string) => {
      if (url) {
        const loader = new GLTFLoader();
        try {
          const gltf = await loader.loadAsync(url);
          if (sceneRef.current) {
            if (sceneRef.current.model) {
              sceneRef.current.scene.remove(sceneRef.current.model);
            }
            sceneRef.current.model = gltf.scene;
            sceneRef.current.scene.add(gltf.scene);
            
            const findMouth = (obj: THREE.Object3D): THREE.Object3D | null => {
              if (obj.name.toLowerCase().includes('mouth') || obj.name.toLowerCase().includes('jaw')) {
                return obj;
              }
              for (const child of obj.children) {
                const found = findMouth(child);
                if (found) return found;
              }
              return null;
            };
            
            sceneRef.current.mouth = findMouth(gltf.scene);
            
            const box = new THREE.Box3().setFromObject(gltf.scene);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            const distance = maxDim * 2;
            sceneRef.current.camera.position.set(center.x, center.y, center.z + distance);
            sceneRef.current.camera.lookAt(center);
          }
        } catch (error) {
          console.error('Failed to load model:', error);
          createDefaultAvatar();
        }
      } else {
        createDefaultAvatar();
      }
    };

    const createDefaultAvatar = () => {
      const headGeometry = new THREE.SphereGeometry(1, 32, 32);
      const headMaterial = new THREE.MeshStandardMaterial({ color: 0xffdbac });
      const head = new THREE.Mesh(headGeometry, headMaterial);
      scene.add(head);

      const eyeGeometry = new THREE.SphereGeometry(0.1, 16, 16);
      const eyeMaterial = new THREE.MeshStandardMaterial({ color: 0x000000 });
      
      const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
      leftEye.position.set(-0.3, 0.2, 0.9);
      scene.add(leftEye);

      const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
      rightEye.position.set(0.3, 0.2, 0.9);
      scene.add(rightEye);

      const mouthGeometry = new THREE.SphereGeometry(0.15, 16, 16);
      const mouthMaterial = new THREE.MeshStandardMaterial({ color: 0x8b0000 });
      const mouth = new THREE.Mesh(mouthGeometry, mouthMaterial);
      mouth.position.set(0, -0.3, 0.9);
      scene.add(mouth);

      if (sceneRef.current) {
        sceneRef.current.model = head;
        sceneRef.current.mouth = mouth;
      }
    };

    loadModel(modelUrl);

    const animate = () => {
      if (sceneRef.current && sceneRef.current.model) {
        sceneRef.current.model.rotation.y += 0.01;
        sceneRef.current.renderer.render(
          sceneRef.current.scene,
          sceneRef.current.camera
        );
        sceneRef.current.animationId = requestAnimationFrame(animate);
      }
    };
    animate();

    const handleResize = () => {
      if (!canvasRef.current || !sceneRef.current) return;
      const width = canvasRef.current.clientWidth;
      const height = canvasRef.current.clientHeight;
      sceneRef.current.camera.aspect = width / height;
      sceneRef.current.camera.updateProjectionMatrix();
      sceneRef.current.renderer.setSize(width, height);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (sceneRef.current?.animationId) {
        cancelAnimationFrame(sceneRef.current.animationId);
      }
      if (elevenSocketRef.current) {
        elevenSocketRef.current.close();
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [modelUrl]);

  const b64ToArrayBuffer = (base64: string): ArrayBuffer => {
    const binaryString = window.atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  };

  const speakText = async () => {
    if (!text.trim() || isSpeaking) return;

    setIsSpeaking(true);

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext({ sampleRate: 22050 });
    }
    
    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }

    const voiceId = '21m00Tcm4TlvDq8ikWAM';
    const jwtEndpoint = '/app/jwt/get';

    let jwt = '';
    try {
      const response = await fetch(jwtEndpoint, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      jwt = data.jwt || '';
      if (!jwt) {
        throw new Error('JWT token is empty');
      }
    } catch (error) {
      console.error('Failed to get JWT:', error);
      setIsSpeaking(false);
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/elevenlabs/${jwt}/v1/text-to-speech/${voiceId}/stream-input?model_id=eleven_turbo_v2_5&output_format=pcm_22050&auto_mode=true&apply_text_normalization=off`;

    const elevenBOS = {
      text: ' ',
      voice_settings: { stability: 0.8, similarity_boost: true },
      generation_config: {
        chunk_length_schedule: [500, 500, 500, 500],
      },
    };

    const socket = new WebSocket(wsUrl);
    elevenSocketRef.current = socket;

    let outputMsg: {
      audio: ArrayBuffer[];
      words: string[];
      wtimes: number[];
      wdurations: number[];
    } | null = null;

    socket.onopen = () => {
      socket.send(JSON.stringify(elevenBOS));
      socket.send(
        JSON.stringify({
          text: text,
          try_trigger_generation: false,
          flush: true,
        })
      );
    };

    socket.onmessage = (event) => {
      let r;
      try {
        r = JSON.parse(event.data);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
        return;
      }

      if (!r.isFinal) {
        if (r.alignment) {
          outputMsg = { audio: [], words: [], wtimes: [], wdurations: [] };

          let word = '';
          let time = 0;
          let duration = 0;
          for (let i = 0; i < r.alignment.chars.length; i++) {
            if (word.length === 0) time = r.alignment.charStartTimesMs[i];
            if (word.length && r.alignment.chars[i] === ' ') {
              outputMsg.words.push(word);
              outputMsg.wtimes.push(time);
              outputMsg.wdurations.push(duration);
              word = '';
              duration = 0;
            } else {
              duration += r.alignment.charDurationsMs[i];
              word += r.alignment.chars[i];
            }
          }
          if (word.length) {
            outputMsg.words.push(word);
            outputMsg.wtimes.push(time);
            outputMsg.wdurations.push(duration);
          }
        }

        if (r.audio && outputMsg) {
          outputMsg.audio.push(b64ToArrayBuffer(r.audio));
        }
      }

      if ((r.isFinal || r.normalizedAlignment) && outputMsg && outputMsg.audio.length > 0) {
        const audioBuffer = audioContextRef.current!.createBuffer(
          1,
          outputMsg.audio.reduce((sum, chunk) => sum + chunk.byteLength / 2, 0),
          22050
        );
        const channelData = audioBuffer.getChannelData(0);
        let offset = 0;
        for (const chunk of outputMsg.audio) {
          const int16Array = new Int16Array(chunk);
          for (let i = 0; i < int16Array.length; i++) {
            channelData[offset + i] = int16Array[i] / 32768;
          }
          offset += int16Array.length;
        }

        const source = audioContextRef.current!.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContextRef.current!.destination);
        source.start();

        const startTime = audioContextRef.current!.currentTime;
        const duration = audioBuffer.duration;
        const animateMouth = () => {
          if (!sceneRef.current || !sceneRef.current.mouth) return;
          const elapsed = audioContextRef.current!.currentTime - startTime;
          if (elapsed < duration) {
            const scale = 1 + Math.sin(elapsed * 10) * 0.3;
            sceneRef.current.mouth.scale.set(1, scale, 1);
            requestAnimationFrame(animateMouth);
          } else {
            sceneRef.current.mouth.scale.set(1, 1, 1);
            setIsSpeaking(false);
          }
        };
        animateMouth();

        source.onended = () => {
          if (sceneRef.current && sceneRef.current.mouth) {
            sceneRef.current.mouth.scale.set(1, 1, 1);
          }
          setIsSpeaking(false);
        };

        outputMsg = null;
      }
    };

    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
      setIsSpeaking(false);
      elevenSocketRef.current = null;
    };

    socket.onclose = (event) => {
      console.log('WebSocket closed:', event.code, event.reason);
      setIsSpeaking(false);
      elevenSocketRef.current = null;
    };
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 bg-gray-900">
      <canvas
        ref={canvasRef}
        className="w-full max-w-2xl h-96 border border-gray-700 rounded-lg mb-8"
      />
      <div className="w-full max-w-2xl flex gap-4">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              speakText();
            }
          }}
          placeholder="Enter text to speak..."
          className="flex-1 px-4 py-2 bg-gray-800 text-white border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
          disabled={isSpeaking}
        />
        <button
          onClick={speakText}
          disabled={isSpeaking || !text.trim()}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed"
        >
          {isSpeaking ? 'Speaking...' : 'Speak'}
        </button>
      </div>
    </div>
  );
}
