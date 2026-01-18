import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export default function Avatar() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [text, setText] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const sceneRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    controls: OrbitControls | null;
    animationId: number | null;
  } | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const elevenSocketRef = useRef<WebSocket | null>(null);
  const fbxModelRef = useRef<THREE.Group | null>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);

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

    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    sceneRef.current = {
      scene,
      camera,
      renderer,
      controls,
      animationId: null,
    };

    const fbxLoader = new FBXLoader();
    fbxLoader.load('/avatar_dance.fbx', (fbx) => {
      fbx.scale.setScalar(0.01);
      fbx.position.set(0, 0, 0);
      
      fbx.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          if (mesh.material) {
            const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            materials.forEach((mat) => {
              if (mat instanceof THREE.MeshStandardMaterial) {
                mat.metalness = 0.2;
                mat.roughness = 0.8;
              }
            });
          }
        }
      });
      
      fbxModelRef.current = fbx;
      scene.add(fbx);

      if (fbx.animations && fbx.animations.length > 0) {
        const mixer = new THREE.AnimationMixer(fbx);
        mixerRef.current = mixer;

        const clip = fbx.animations[0];
        const action = mixer.clipAction(clip);
        action.setLoop(THREE.LoopRepeat, Infinity);
        action.play();
      }

      const box = new THREE.Box3().setFromObject(fbx);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const distance = maxDim * 2;
      camera.position.set(center.x, center.y + size.y * 0.3, center.z + distance);
      camera.lookAt(center.x, center.y + size.y * 0.3, center.z);
      controls.target.set(center.x, center.y + size.y * 0.3, center.z);
      controls.update();
    });

    const animate = () => {
      if (sceneRef.current) {
        sceneRef.current.controls?.update();
        if (mixerRef.current) {
          mixerRef.current.update(0.016);
        }
        sceneRef.current.renderer.render(sceneRef.current.scene, sceneRef.current.camera);
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
  }, []);

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

    if (elevenSocketRef.current) {
      elevenSocketRef.current.close();
      elevenSocketRef.current = null;
    }

    setIsSpeaking(true);

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext({ sampleRate: 22050 });
    }
    
    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }

    const voiceId = 'G3zrXA9moYrFCgwBAvxJ';
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
        if (r.alignment && !outputMsg) {
          outputMsg = { audio: [] };
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

        source.onended = () => {
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
        className="w-full max-w-2xl h-96 border border-gray-700 rounded-lg mb-4"
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
