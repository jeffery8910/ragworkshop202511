'use client';

export default function Skeleton({ className }: { className?: string }) {
    return (
        <div className={`animate-pulse rounded bg-gray-200 ${className || ''}`} />
    );
}
