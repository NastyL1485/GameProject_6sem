import { useRef, useEffect, useState } from 'react';
import Webcam from 'react-webcam';
import { Holistic, POSE_CONNECTIONS } from '@mediapipe/holistic';
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils';
import { Camera } from '@mediapipe/camera_utils';
import './App.css';

import waterImg from '../public/water.png';
import donutImg from '../public/donut.png';
import appleImg from '../public/apple.png';
import bananaImg from '../public/banana.png';
import limeImg from '../public/lime.png';
import orangeImg from '../public/orange.png';
import icecreamImg from '../public/ice-cream.png';
import colaImg from '../public/cola.png';

type ObjectType = 'water' | 'donut' | 'apple' | 'banana' | 'lime' | 'orange' | 'icecream' | 'cola';

interface ObjectItem {
  type: ObjectType;
  position: { x: number; y: number };
  isFixed: boolean;
}

const objectTypes: ObjectType[] = ['water', 'donut', 'apple', 'banana', 'lime', 'orange', 'icecream', 'cola'];
const zonePositions = [
  { x: 50, y: 100 }, { x: 950, y: 100 },
  { x: 50, y: 200 }, { x: 950, y: 200 },
  { x: 50, y: 300 }, { x: 950, y: 300 },
  { x: 50, y: 400 }, { x: 950, y: 400 },
];

export default function MPStart() {
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [currentObject, setCurrentObject] = useState<ObjectItem | null>(null);
  const [score, setScore] = useState(0);
  const [zoneGrid, setZoneGrid] = useState<(ObjectItem | null)[][]>(Array(4).fill(null).map(() => Array(2).fill(null)));
  const [fixedObjects, setFixedObjects] = useState<ObjectItem[]>([]);
  const objectImagesRef = useRef<Record<ObjectType, HTMLImageElement>>({} as any);
  const draggedObjectRef = useRef<ObjectItem | null>(null);
  const isDraggingRef = useRef(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60);
  const [gameEnded, setGameEnded] = useState(false);

  useEffect(() => {
    const images: Record<ObjectType, HTMLImageElement> = {
      water: new Image(), donut: new Image(), apple: new Image(), banana: new Image(),
      lime: new Image(), orange: new Image(), icecream: new Image(), cola: new Image()
    };
    images.water.src = waterImg;
    images.donut.src = donutImg;
    images.apple.src = appleImg;
    images.banana.src = bananaImg;
    images.lime.src = limeImg;
    images.orange.src = orangeImg;
    images.icecream.src = icecreamImg;
    images.cola.src = colaImg;
    objectImagesRef.current = images;
  }, []);

  const spawnNewObject = () => {
    const type = objectTypes[Math.floor(Math.random() * objectTypes.length)];
    const available = zoneGrid.flat().filter(o => !o || o.type !== type);
    if (available.length === 0) {
      alert('Игра окончена!');
      return;
    }
    setCurrentObject({ type, position: { x: 540, y: 320 }, isFixed: false });
  };

  useEffect(() => {
    if (gameStarted && !currentObject) spawnNewObject();
  }, [currentObject, gameStarted]);

  useEffect(() => {
    if (!gameStarted) return;

    setTimeLeft(60);
    setGameEnded(false);
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          setGameStarted(false);
          setGameEnded(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [gameStarted]);

  useEffect(() => {
    if (!gameStarted) return;

    const holistic = new Holistic({ locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}` });
    holistic.setOptions({ modelComplexity: 1, smoothLandmarks: true, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });

    holistic.onResults((results: any) => {
      const canvas = canvasRef.current!;
      const video = webcamRef.current?.video!;
      const ctx = canvas.getContext('2d')!;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      if (results.poseLandmarks) {
        drawConnectors(ctx, results.poseLandmarks, POSE_CONNECTIONS, { color: 'white' });
        drawLandmarks(ctx, results.poseLandmarks, { color: 'white', fillColor: 'rgb(255,138,0)' });
      }

      zonePositions.forEach(pos => {
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 30, 0, 2 * Math.PI);
        ctx.strokeStyle = 'yellow';
        ctx.stroke();
      });

      fixedObjects.forEach(obj => {
        const img = objectImagesRef.current[obj.type];
        if (img.complete) ctx.drawImage(img, obj.position.x - 25, obj.position.y - 25, 50, 50);
      });

      const obj = draggedObjectRef.current || currentObject;
      if (obj && !obj.isFixed) {
        const img = objectImagesRef.current[obj.type];
        if (img.complete) ctx.drawImage(img, obj.position.x - 25, obj.position.y - 25, 50, 50);
      }

      const hands = results.leftHandLandmarks || results.rightHandLandmarks;
      if (hands) {
        const index = hands[8];
        const pos = { x: index.x * canvas.width, y: index.y * canvas.height };

        if (obj && !isDraggingRef.current && Math.abs(pos.x - obj.position.x) < 30 && Math.abs(pos.y - obj.position.y) < 30) {
          isDraggingRef.current = true;
          draggedObjectRef.current = obj;
          setCurrentObject(null);
        }

        if (isDraggingRef.current && draggedObjectRef.current) {
          draggedObjectRef.current.position = pos;

          zonePositions.forEach((zone, i) => {
            if (Math.abs(zone.x - pos.x) < 30 && Math.abs(zone.y - pos.y) < 30) {
              const row = Math.floor(i / 2);
              const col = i % 2;
              if (!zoneGrid[row][col]) {
                const newObj = { ...draggedObjectRef.current!, isFixed: true, position: zone };
                const updatedGrid = zoneGrid.map(r => [...r]);
                updatedGrid[row][col] = newObj;
                setZoneGrid(updatedGrid);
                setFixedObjects(prev => [...prev, newObj]);
                draggedObjectRef.current = null;
                isDraggingRef.current = false;
                checkScore(updatedGrid);
                spawnNewObject();
              }
            }
          });
        }
      } else {
        if (isDraggingRef.current && draggedObjectRef.current) {
          setCurrentObject(draggedObjectRef.current);
          draggedObjectRef.current = null;
          isDraggingRef.current = false;
        }
      }
    });

    if (webcamRef.current?.video) {
      const camera = new Camera(webcamRef.current.video, {
        onFrame: async () => holistic.send({ image: webcamRef.current!.video! }),
        width: 1080,
        height: 640
      });
      camera.start();
      return () => {
        camera.stop();
        holistic.close();
      };
    }
  }, [currentObject, zoneGrid, fixedObjects, gameStarted]);

  const checkScore = (grid: (ObjectItem | null)[][]) => {
    const newGrid = [...grid.map(row => [...row])];
    let newFixed = [...fixedObjects];
    let delta = 0;

    for (let i = 0; i < 4; i++) {
      if (grid[i][0] && grid[i][1]) {
        delta += 450;
        newGrid[i][0] = null;
        newGrid[i][1] = null;
        newFixed = newFixed.filter(obj =>
          !(obj.position.x === zonePositions[i * 2].x && obj.position.y === zonePositions[i * 2].y) &&
          !(obj.position.x === zonePositions[i * 2 + 1].x && obj.position.y === zonePositions[i * 2 + 1].y)
        );
      }
    }

    for (let j = 0; j < 2; j++) {
      if (grid[0][j] && grid[1][j] && grid[2][j] && grid[3][j]) {
        delta += 200;
        for (let i = 0; i < 4; i++) {
          newGrid[i][j] = null;
          newFixed = newFixed.filter(obj => obj.position.x !== zonePositions[i * 2 + j].x || obj.position.y !== zonePositions[i * 2 + j].y);
        }
      }
    }

    if (delta > 0) {
      setZoneGrid(newGrid);
      setFixedObjects(newFixed);
      setScore(prev => prev + delta);
    }
  };

  if (!gameStarted) {
    return (
      <div className="container" style={{ width: '100%', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
        {gameEnded ? (
          <>
            <h1 style={{ fontSize: 48, marginBottom: 16 }}>Время вышло!</h1>
            <div style={{ fontSize: 24, marginBottom: 24 }}>Ваш счёт: {score}</div>
            <button
              onClick={() => {
                setGameStarted(true);
                setScore(0);
                setZoneGrid(Array(4).fill(null).map(() => Array(2).fill(null)));
                setFixedObjects([]);
                draggedObjectRef.current = null;
              }}
              style={{ padding: '20px 40px', fontSize: 32, borderRadius: 12, backgroundColor: '#007bff', color: 'white', border: 'none', cursor: 'pointer' }}
            >
              Играть снова
            </button>
          </>
        ) : (
          <>
            <h1 style={{ fontSize: 48, marginBottom: 32 }}>Добро пожаловать!</h1>
            <button
              onClick={() => setGameStarted(true)}
              style={{ padding: '20px 40px', fontSize: 32, borderRadius: 12, backgroundColor: '#28a745', color: 'white', border: 'none', cursor: 'pointer' }}
            >
              Старт
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="container">
      <div style={{ fontSize: 24, marginBottom: 8 }}>Счёт: {score}</div>
      <div style={{ fontSize: 20, marginBottom: 8 }}>Время: {timeLeft} сек</div>
      <Webcam ref={webcamRef} mirrored audio={false} style={{ display: 'none' }} />
      <canvas ref={canvasRef} width={1080} height={640} style={{ border: '1px solid black' }} />
    </div>
  );
}