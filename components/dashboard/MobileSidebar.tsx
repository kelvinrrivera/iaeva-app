"use client";

import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";
import SidebarNav from "./SidebarNav";
import type { NavItem } from "./SidebarNav";

interface MobileSidebarProps {
    navItems: NavItem[];
    shopName?: string;
    shopTypeBadge?: string;
    planLabel?: string;
}

export default function MobileSidebar({
    navItems,
    shopName,
    shopTypeBadge,
    planLabel,
}: MobileSidebarProps) {
    const [open, setOpen] = useState(false);

    // Close on route change
    useEffect(() => {
        const handleRouteChange = () => setOpen(false);
        window.addEventListener("popstate", handleRouteChange);
        return () => window.removeEventListener("popstate", handleRouteChange);
    }, []);

    // Prevent body scroll when open
    useEffect(() => {
        if (open) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
        return () => { document.body.style.overflow = ""; };
    }, [open]);

    return (
        <>
            {/* Hamburger button — only visible on mobile */}
            <button
                onClick={() => setOpen(true)}
                className="md:hidden p-2 rounded-lg text-gray-400 hover:text-charcoal hover:bg-gray-100 transition-all"
                aria-label="Abrir menú"
            >
                <Menu className="h-5 w-5" />
            </button>

            {/* Overlay */}
            {open && (
                <div
                    className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm md:hidden"
                    onClick={() => setOpen(false)}
                />
            )}

            {/* Drawer */}
            <aside
                className={`fixed top-0 left-0 h-full w-72 bg-white z-50 flex flex-col shadow-2xl transition-transform duration-300 md:hidden ${
                    open ? "translate-x-0" : "-translate-x-full"
                }`}
            >
                {/* Header */}
                <div className="px-5 py-5 flex items-center justify-between border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white shadow-sm shrink-0">
                            <span className="text-xs font-black">DC</span>
                        </div>
                        <div>
                            <span className="block text-sm font-bold text-charcoal">DomiCita</span>
                            {shopTypeBadge && (
                                <span className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                                    {shopTypeBadge}
                                </span>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={() => setOpen(false)}
                        aria-label="Cerrar menú"
                        className="p-1.5 rounded-lg text-gray-400 hover:text-charcoal hover:bg-gray-100 transition-all"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Shop info */}
                {shopName && (
                    <div className="px-5 py-3 border-b border-gray-100">
                        <p className="text-xs font-bold text-charcoal truncate">{shopName}</p>
                        {planLabel && (
                            <p className="text-[10px] text-gray-400 mt-0.5 font-medium uppercase tracking-wide">Plan {planLabel}</p>
                        )}
                    </div>
                )}

                {/* Nav — clicking any item closes the drawer */}
                <div onClick={() => setOpen(false)}>
                    <SidebarNav items={navItems} />
                </div>

                {/* Help link */}
                <div className="px-3 mt-auto pb-4">
                    <a
                        href="/guia"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-gray-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
                    >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
                        </svg>
                        Guía de uso
                    </a>
                </div>
            </aside>
        </>
    );
}
