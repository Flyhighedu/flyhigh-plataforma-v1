import React, { useMemo } from 'react';
import { createAvatar } from '@dicebear/core';
import { avataaars } from '@dicebear/collection';

export function MiniAvatar({ config, size = 64, className = "" }) {
    const avatarUri = useMemo(() => {
        if (!config) return null;
        
        const avatar = createAvatar(avataaars, {
            seed: 'master',
            size: size * 2, // renderize internally larger for crispness
            top: [config.top === 'baseballCap' ? 'shortFlat' : config.top],
            hairColor: [config.hairColor],
            mouth: [config.mouth],
            eyes: [config.eyes],
            eyebrows: [config.eyebrows],
            skinColor: [config.skinColor],
            clothing: [config.clothing || 'shirtCrewNeck'],
            clothesColor: [config.clothesColor || 'ffffff'],
            facialHair: [config.facialHair],
            facialHairColor: [config.hairColor || '2c1b18'],
            facialHairProbability: config.facialHairProbability,
            accessories: [config.accessories],
            accessoriesProbability: config.accessoriesProbability,
            backgroundColor: ['transparent'],
            // pass hatColor if supported or it will be ignored by avataaars directly
        });
        return avatar.toDataUri();
    }, [config, size]);

    if (!config || !avatarUri) {
        return null;
    }

    return (
        <div className={`relative flex items-center justify-center shrink-0 ${className}`} style={{ width: size, height: size }}>
            <img src={avatarUri} alt="Avatar" className="w-[120%] h-[120%] object-contain" />
            
            {/* INJECT CUSTOM BASEBALL CAP SUPERPOSITION IF NEEDED */}
            {config.top === 'baseballCap' && (
                <svg viewBox="0 0 100 100" className="absolute top-0 left-0 w-[120%] h-[120%] drop-shadow-sm pointer-events-none" style={{ transform: 'translateY(1%) scale(1.05)' }}>
                    <path d="M 28 28 C 28 5, 72 5, 72 28 Z" fill={`#${config.hatColor || '262e33'}`} />
                    <path d="M 50 28 L 50 8" stroke="#000000" strokeWidth="0.5" opacity="0.15" />
                    <path d="M 38 28 Q 44 18, 50 8" stroke="#000000" strokeWidth="0.5" opacity="0.15" />
                    <path d="M 62 28 Q 56 18, 50 8" stroke="#000000" strokeWidth="0.5" opacity="0.15" />
                    <path d="M 15 28 Q 50 20, 85 28 Q 50 38, 15 28 Z" fill={`#${config.hatColor || '262e33'}`} opacity="0.95" />
                    <path d="M 15 28 Q 50 38, 85 28 Q 50 35, 15 28 Z" fill="#000000" opacity="0.2" />
                    <circle cx="50" cy="8" r="2.5" fill="#000000" opacity="0.2" />
                </svg>
            )}

            {/* FLYHIGH LOGO OVERLAY */}
            <div className={`absolute pointer-events-none opacity-90 ${['262e33', '25557c', '3c4f5c', 'ff5c5c', '8b5cf6', '10b981', '000000'].includes(config.clothesColor) ? '' : 'mix-blend-darken'}`} 
                 style={{ bottom: '12%', left: '28%' }}>
                <span className={`font-black tracking-tighter drop-shadow-sm ${['262e33', '25557c', '3c4f5c', 'ff5c5c', '8b5cf6', '10b981', '000000'].includes(config.clothesColor) ? 'text-white' : 'text-black'}`} style={{ fontSize: `${size * 0.05}px` }}>
                    FLYHIGH
                </span>
            </div>
        </div>
    );
}
