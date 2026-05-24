"use client";

import Avatar from 'boring-avatars';

const PALETTE = ['#0E2A47', '#1B4D80', '#2C7DA0', '#A9D6E5', '#FFB703'];

interface Props {
    name: string | null;
    phoneNumber?: string;
    size?: number;
    className?: string;
}

/**
 * Geometric, deterministic avatar based on the client's name+phone.
 * Falls back to phone number if no name. Always renders the same colors
 * for the same input, so each client has a stable visual identity.
 */
export default function ClientAvatar({ name, phoneNumber, size = 40, className = '' }: Props) {
    const seed = `${name || ''}::${phoneNumber || ''}` || 'unknown';
    return (
        <div className={className} style={{ width: size, height: size }}>
            <Avatar
                size={size}
                name={seed}
                variant="beam"
                colors={PALETTE}
            />
        </div>
    );
}
