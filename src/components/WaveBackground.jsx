import React, { useEffect, useRef } from 'react';

const lightWaves = [
    { color: 'rgba(0, 102, 255, 0.15)', yOffset: 0.3, amplitude: 180, speed: 0.4, frequency: 0.0015 },
    { color: 'rgba(50, 150, 255, 0.25)', yOffset: 0.5, amplitude: 220, speed: 0.3, frequency: 0.002 },
    { color: 'rgba(0, 119, 255, 0.2)', yOffset: 0.65, amplitude: 160, speed: 0.5, frequency: 0.0025 },
    { color: 'rgba(100, 180, 255, 0.3)', yOffset: 0.8, amplitude: 120, speed: 0.6, frequency: 0.003 }
];

const darkWaves = [
    { color: 'rgba(30, 58, 138, 0.3)', yOffset: 0.3, amplitude: 180, speed: 0.4, frequency: 0.0015 },
    { color: 'rgba(49, 46, 129, 0.4)', yOffset: 0.5, amplitude: 220, speed: 0.3, frequency: 0.002 },
    { color: 'rgba(55, 48, 163, 0.3)', yOffset: 0.65, amplitude: 160, speed: 0.5, frequency: 0.0025 },
    { color: 'rgba(67, 56, 202, 0.4)', yOffset: 0.8, amplitude: 120, speed: 0.6, frequency: 0.003 }
];

export default function WaveBackground({ className, isDark }) {
    const canvasRef = useRef(null);
    const timeRef = useRef(0);
    const animationFrameId = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        let width = 0;
        let height = 0;

        const resizeCanvas = () => {
            const parent = canvas.parentElement;
            if (parent) {
                width = parent.clientWidth + 40;
                height = parent.clientHeight + 40;
                canvas.width = width;
                canvas.height = height;
            }
        };

        window.addEventListener('resize', resizeCanvas);
        resizeCanvas();

        const animate = () => {
            animationFrameId.current = requestAnimationFrame(animate);
            timeRef.current += 0.02;

            const activeWaves = isDark ? darkWaves : lightWaves;
            const strokeColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.6)';

            ctx.clearRect(0, 0, width, height);

            activeWaves.forEach(wave => {
                ctx.beginPath();
                ctx.moveTo(0, height);
                ctx.lineTo(0, height * wave.yOffset);
                
                for (let i = 0; i <= width; i += 5) {
                    let primaryWave = Math.sin(i * wave.frequency + timeRef.current * wave.speed);
                    let secondaryWave = Math.sin(i * wave.frequency * 1.5 - timeRef.current * wave.speed * 0.8) * 0.4;
                    
                    let y = (height * wave.yOffset) + (primaryWave + secondaryWave) * wave.amplitude;
                    ctx.lineTo(i, y);
                }
                
                ctx.lineTo(width, height);
                ctx.closePath();
                
                ctx.fillStyle = wave.color;
                ctx.fill();

                ctx.lineWidth = 1.5;
                ctx.strokeStyle = strokeColor;
                ctx.stroke();
            });
        };

        animate();

        return () => {
            window.removeEventListener('resize', resizeCanvas);
            if (animationFrameId.current) {
                cancelAnimationFrame(animationFrameId.current);
            }
        };
    }, [isDark]);

    return <canvas ref={canvasRef} className={className} />;
}
