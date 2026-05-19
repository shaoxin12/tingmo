import React, { useRef, useEffect } from 'react';

interface Props {
  audioLevel: number;
}

export const Waveform: React.FC<Props> = ({ audioLevel }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const historyRef = useRef<number[]>(Array(64).fill(0));

  useEffect(() => {
    historyRef.current.push(audioLevel);
    if (historyRef.current.length > 64) {
      historyRef.current.shift();
    }
  }, [audioLevel]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    let animId: number;

    const draw = () => {
      const w = rect.width;
      const h = rect.height;
      const history = historyRef.current;

      ctx.clearRect(0, 0, w, h);

      const barWidth = (w - 8) / history.length;
      const centerY = h / 2;

      for (let i = 0; i < history.length; i++) {
        const level = history[i];
        const barHeight = Math.max(2, level * h * 0.8);
        const x = 4 + i * barWidth;
        const y = centerY - barHeight / 2;

        ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth - 1.5, barHeight, 2);
        ctx.fill();
      }

      animId = requestAnimationFrame(draw);
    };

    draw();

    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <div className="waveform-container">
      <canvas ref={canvasRef} />
    </div>
  );
};
