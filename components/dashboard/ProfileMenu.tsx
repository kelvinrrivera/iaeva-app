'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/browser';
import { User, LogOut, ChevronDown, Building2, Settings } from 'lucide-react';

interface ProfileMenuProps {
    profile: any;
    role: string;
    terminology: any;
    shop: any;
}

export default function ProfileMenu({ profile, role, terminology, shop }: ProfileMenuProps) {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const router = useRouter();
    const supabase = createClient();

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/login');
        setIsOpen(false);
    };

    const getInitials = (name?: string | null) => {
        if (!name) return '??';
        return name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase();
    };

    const roleLabel =
        role === 'PROFESSIONAL' ? terminology.professional.professional
        : role === 'ORG_ADMIN' ? 'Admin'
        : role === 'SUPER_ADMIN' ? 'Super Admin'
        : role === 'TEAM_LEADER' ? 'Líder'
        : role.replace('_', ' ');

    return (
        <div className="relative" ref={menuRef}>
            {/* Trigger */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                aria-label="Menú de perfil"
                aria-expanded={isOpen}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl hover:bg-gray-50 transition-colors group"
            >
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center font-bold text-white text-xs shrink-0 overflow-hidden">
                    {profile?.avatarUrl ? (
                        <img src={profile.avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                    ) : (
                        getInitials(profile?.name)
                    )}
                </div>
                <div className="flex flex-col flex-1 text-left min-w-0">
                    <span className="text-xs font-bold text-charcoal truncate">
                        {profile?.name || 'Usuario'}
                    </span>
                    <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">
                        {roleLabel}
                    </span>
                </div>
                <ChevronDown className={`h-3.5 w-3.5 text-gray-400 transition-transform shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-xl border border-gray-100 shadow-lg overflow-hidden z-50">
                    {/* Header */}
                    <div className="px-3 py-2.5 border-b border-gray-100">
                        <p className="text-xs font-bold text-charcoal">{profile?.name || 'Usuario'}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5 truncate">{profile?.email}</p>
                    </div>

                    {/* Items */}
                    <div className="py-1">
                        <Link
                            href="/dashboard/profile"
                            onClick={() => setIsOpen(false)}
                            className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-gray-600 hover:text-primary hover:bg-gray-50 transition-colors"
                        >
                            <User className="h-3.5 w-3.5" />
                            Mi Perfil
                        </Link>

                        <Link
                            href="/dashboard/settings"
                            onClick={() => setIsOpen(false)}
                            className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-gray-600 hover:text-primary hover:bg-gray-50 transition-colors"
                        >
                            <Settings className="h-3.5 w-3.5" />
                            Configuración
                        </Link>

                        {shop && (
                            <div className="flex items-start gap-2.5 px-3 py-2 bg-gray-50/60">
                                <Building2 className="h-3.5 w-3.5 text-gray-400 mt-0.5 shrink-0" />
                                <div className="min-w-0">
                                    <p className="text-xs font-semibold text-charcoal truncate">{shop.name}</p>
                                    <p className="text-[10px] text-gray-400">{shop.plan} · {shop.shopType.replace('_', ' ')}</p>
                                </div>
                            </div>
                        )}

                        <div className="border-t border-gray-100 my-1" />

                        <button
                            onClick={handleLogout}
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-accent hover:bg-red-50 transition-colors"
                        >
                            <LogOut className="h-3.5 w-3.5" />
                            Cerrar Sesión
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
