"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    Calendar,
    Clock,
    Settings,
    Users,
    LayoutDashboard,
    Scissors,
    Sparkles,
    MessageSquare,
    Palette,
    ListOrdered,
    Zap,
    DollarSign,
    Ticket,
} from "lucide-react";

const ICON_MAP: Record<string, React.ElementType> = {
    Calendar,
    Clock,
    Settings,
    Users,
    LayoutDashboard,
    Scissors,
    Sparkles,
    MessageSquare,
    Palette,
    ListOrdered,
    Zap,
    DollarSign,
    Ticket,
};

export interface NavItem {
    name: string;
    iconName: string;
    href: string;
}

export default function SidebarNav({ items }: { items: NavItem[] }) {
    const pathname = usePathname();

    return (
        <nav className="flex-1 px-3 py-5 space-y-0.5 overflow-y-auto">
            {items.map((item) => {
                const isActive =
                    item.href === "/dashboard"
                        ? pathname === "/dashboard"
                        : pathname.startsWith(item.href);

                const Icon = ICON_MAP[item.iconName] ?? LayoutDashboard;

                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 group font-medium text-sm ${
                            isActive
                                ? "bg-primary/8 text-primary"
                                : "text-gray-500 hover:text-charcoal hover:bg-gray-100"
                        }`}
                        aria-current={isActive ? "page" : undefined}
                    >
                        {isActive && (
                            <span aria-hidden="true" className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-primary" />
                        )}
                        <Icon
                            className={`shrink-0 transition-colors duration-150 ${
                                isActive ? "text-primary" : "text-gray-400 group-hover:text-charcoal"
                            }`}
                            size={17}
                        />
                        <span className={`flex-1 truncate ${isActive ? "font-semibold" : ""}`}>{item.name}</span>
                    </Link>
                );
            })}
        </nav>
    );
}
