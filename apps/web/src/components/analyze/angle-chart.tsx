'use client';

import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    ReferenceLine,
    ReferenceDot,
} from 'recharts';
import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
    type ChartConfig,
} from '@/components/ui/chart';
import type { FrameAngles, RepSegmentation } from '@repcheck/shared';

interface AngleChartProps {
    frameAngles: FrameAngles[];
    segmentation: RepSegmentation;
    currentTime: number;
    onSeek?: (timeSec: number) => void;
}

const chartConfig = {
    angle: {
        label: 'Angle',
        color: 'var(--chart-1)',
    },
} satisfies ChartConfig;

export function AngleChart({
    frameAngles,
    segmentation,
    currentTime,
    onSeek,
}: AngleChartProps) {
    if (!segmentation.jointName) {
        return (
            <p className="text-sm text-muted-foreground">
                Not enough movement to detect reps.
            </p>
        );
    }

    const data = frameAngles
        .map((frame) => {
            const angle = frame.angles.find((a) => a.name === segmentation.jointName);
            if (!angle) return null;
            return {
                time: Number(frame.timestamp.toFixed(2)),
                angle: Math.round(angle.degrees),
            };
        })
        .filter((d): d is NonNullable<typeof d> => d !== null);

    return (
        <div className="space-y-2">
            <h3 className="text-sm font-semibold">
                {segmentation.jointName.replace('_', ' ')} angle ·{' '}
                <span className="text-muted-foreground">
                    {segmentation.repCount} reps detected
                </span>
            </h3>

            <ChartContainer config={chartConfig} className="h-64 w-full">
                <LineChart
                    data={data}
                    margin={{ top: 10, right: 10, bottom: 10, left: 0 }}
                    onClick={(e) => {
                        if (e?.activeLabel !== undefined && onSeek) {
                            onSeek(Number(e.activeLabel));
                        }
                    }}
                >
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis
                        dataKey="time"
                        type="number"
                        domain={['dataMin', 'dataMax']}
                        tickFormatter={(t) => `${t}s`}
                        fontSize={11}
                    />
                    <YAxis
                        domain={[0, 180]}
                        ticks={[0, 45, 90, 135, 180]}
                        tickFormatter={(v) => `${v}°`}
                        fontSize={11}
                    />
                    <ChartTooltip
                        content={
                            <ChartTooltipContent
                                labelFormatter={(_, payload) => {
                                    const time = payload?.[0]?.payload?.time;
                                    return typeof time === 'number' ? `${time.toFixed(2)}s` : '';
                                }}
                                formatter={(value) => (
                                    <span className="font-mono">
                                        {value}° angle
                                    </span>
                                )}
                            />
                        }
                    />

                    <Line
                        type="monotone"
                        dataKey="angle"
                        stroke="var(--color-angle)"
                        strokeWidth={2}
                        dot={false}
                        isAnimationActive={false}
                    />

                    {segmentation.reps.map((rep) => (
                        <ReferenceDot
                            key={`bottom-${rep.index}`}
                            x={Number(rep.bottomTime.toFixed(2))}
                            y={rep.bottomAngle}
                            r={5}
                            fill="var(--destructive)"
                            stroke="var(--background)"
                            strokeWidth={1.5}
                            label={{
                                value: `${rep.index + 1}`,
                                position: 'top',
                                fontSize: 11,
                                fill: 'var(--destructive)',
                            }}
                        />
                    ))}

                    <ReferenceLine
                        x={Number(currentTime.toFixed(2))}
                        stroke="var(--primary)"
                        strokeWidth={2}
                        strokeDasharray="3 3"
                    />
                </LineChart>
            </ChartContainer>
        </div>
    );
}