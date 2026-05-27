'use client';

import { useEffect, useRef } from 'react';
import type { PoseFrame, Keypoint, KeypointName, FrameAngles } from '@repcheck/shared';
import { JOINT_ANGLE_DEFS, SKELETON_CONNECTIONS } from '@repcheck/shared';

interface SkeletonOverlayProps {
    /** The pose frame to draw (null = draw nothing). */
    poseFrame: PoseFrame | null;
    /** Source coordinate space — the extracted frame dimensions (e.g. 640×1214). */
    sourceWidth: number;
    sourceHeight: number;
    /** Display dimensions — the on-screen video size. */
    displayWidth: number;
    displayHeight: number;
    /** Minimum keypoint score to draw. */
    minScore?: number;
    frameAngles?: FrameAngles | null;   // NEW
    showAngles?: boolean;               // NEW
}

export function SkeletonOverlay({
    poseFrame,
    sourceWidth,
    sourceHeight,
    displayWidth,
    displayHeight,
    minScore = 0.3,
    frameAngles,
    showAngles = false,
}: SkeletonOverlayProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Set canvas internal resolution to match display size.
        // Use devicePixelRatio for crisp lines on high-DPI screens.
        const dpr = window.devicePixelRatio || 1;
        canvas.width = displayWidth * dpr;
        canvas.height = displayHeight * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        // Clear previous frame
        ctx.clearRect(0, 0, displayWidth, displayHeight);

        if (!poseFrame || sourceWidth === 0 || sourceHeight === 0) return;

        // Scale factors: source coordinate space → display space
        const scaleX = displayWidth / sourceWidth;
        const scaleY = displayHeight / sourceHeight;

        // Build a lookup map: name → keypoint, for drawing connections
        const byName = new Map<KeypointName, Keypoint>();
        for (const kp of poseFrame.keypoints) {
            byName.set(kp.name, kp);
        }

        // Draw bones (connections) first, so joints render on top
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(0, 200, 255, 0.85)';
        for (const [a, b] of SKELETON_CONNECTIONS) {
            const kpA = byName.get(a);
            const kpB = byName.get(b);
            if (!kpA || !kpB) continue;
            if (kpA.score < minScore || kpB.score < minScore) continue;

            ctx.beginPath();
            ctx.moveTo(kpA.x * scaleX, kpA.y * scaleY);
            ctx.lineTo(kpB.x * scaleX, kpB.y * scaleY);
            ctx.stroke();
        }

        // Draw joints (keypoints)
        for (const kp of poseFrame.keypoints) {
            if (kp.score < minScore) continue;

            const x = kp.x * scaleX;
            const y = kp.y * scaleY;

            // Color by confidence: green (high) → yellow → red (low)
            const hue = kp.score * 120; // 0=red, 120=green
            ctx.fillStyle = `hsl(${hue}, 90%, 50%)`;

            ctx.beginPath();
            ctx.arc(x, y, 5, 0, Math.PI * 2);
            ctx.fill();
        }

        // Draw angle labels at vertex joints
        if (showAngles && frameAngles) {
            // Map angle name → its vertex keypoint name (from definitions)
            const vertexByAngle = new Map(
                JOINT_ANGLE_DEFS.map((d) => [d.name, d.vertex]),
            );

            ctx.font = '600 13px system-ui, sans-serif';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';

            for (const angle of frameAngles.angles) {
                // Only show reasonably confident angles
                if (angle.confidence < (minScore ?? 0.3)) continue;

                const vertexName = vertexByAngle.get(angle.name);
                if (!vertexName) continue;

                const vertex = byName.get(vertexName as KeypointName);
                if (!vertex) continue;

                const x = vertex.x * scaleX + 8;  // offset right of joint
                const y = vertex.y * scaleY;
                const label = `${Math.round(angle.degrees)}°`;

                // Background pill for readability
                const metrics = ctx.measureText(label);
                const padX = 4;
                const pillH = 16;
                ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
                ctx.fillRect(x - padX, y - pillH / 2, metrics.width + padX * 2, pillH);

                ctx.fillStyle = 'white';
                ctx.fillText(label, x, y);
            }
        }
    }, [poseFrame, sourceWidth, sourceHeight, displayWidth, displayHeight, minScore, frameAngles, showAngles]);

    return (
        <canvas
            ref={canvasRef}
            style={{ width: displayWidth, height: displayHeight }}
            className="absolute inset-0"
        />
    );
}