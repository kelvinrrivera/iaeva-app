import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import {
    Scissors as BarberIcon,
    Sparkles as BeautyIcon,
    Palette as HybridIcon,
} from "lucide-react";
import { getProfileWithMembership } from "@/lib/auth-utils";
import { TerminologyProvider } from "@/contexts/TerminologyContext";
import { getTerminology } from "@/lib/terminology";
import ProfileMenu from "@/components/dashboard/ProfileMenu";
import SidebarNav from "@/components/dashboard/SidebarNav";
import MobileSidebar from "@/components/dashboard/MobileSidebar";
import { DashboardProviders } from "@/components/dashboard/DashboardProviders";

function getShopIcon(shopType?: string) {
    switch (shopType) {
        case "BARBERSHOP": return BarberIcon;
        case "BEAUTY_SALON": return BeautyIcon;
        case "HYBRID": return HybridIcon;
        default: return BarberIcon;
    }
}

function getShopTypeBadge(shopType?: string): string {
    switch (shopType) {
        case "BARBERSHOP": return "Barbería";
        case "BEAUTY_SALON": return "Belleza";
        case "HYBRID": return "Unisex";
        default: return "Negocio";
    }
}

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const profile = await getProfileWithMembership();

    const membership = profile?.memberships[0];
    const role = membership?.role || "PROFESSIONAL";
    const shop = membership?.shop;

    // New users with no shop/membership must complete onboarding first
    if (!membership || !shop) {
        redirect('/onboarding');
    }

    const shopType = shop?.shopType || "BARBERSHOP";
    const plan = shop?.plan || "TEAM";

    const terminology = getTerminology(shopType as any);
    const ShopIcon = getShopIcon(shopType);

    // Helper to check if a feature is available for the current plan
    const canAccessByPlan = (minPlan: "SOLO" | "TEAM" | "BUSINESS"): boolean => {
        const planOrder: Record<string, number> = { SOLO: 1, TEAM: 2, BUSINESS: 3 };
        return planOrder[plan] >= planOrder[minPlan];
    };

    const allNavItems = [
        { name: "Dashboard", iconName: "LayoutDashboard", href: "/dashboard", roles: ["SUPER_ADMIN", "ORG_ADMIN", "TEAM_LEADER"], minPlan: "SOLO" as const },
        { name: "Calendario", iconName: "Calendar", href: "/dashboard/calendar", roles: ["SUPER_ADMIN", "ORG_ADMIN", "TEAM_LEADER", "PROFESSIONAL"], minPlan: "SOLO" as const },
        { name: "Disponibilidad", iconName: "Clock", href: "/dashboard/availability", roles: ["SUPER_ADMIN", "ORG_ADMIN", "TEAM_LEADER", "PROFESSIONAL"], minPlan: "SOLO" as const },
        { name: "Servicios", iconName: "Scissors", href: "/dashboard/services", roles: ["SUPER_ADMIN", "ORG_ADMIN"], minPlan: "SOLO" as const },
        { name: "Clientes", iconName: "Users", href: "/dashboard/clients", roles: ["SUPER_ADMIN", "ORG_ADMIN", "TEAM_LEADER"], minPlan: "SOLO" as const },
        { name: terminology.professional.professionals, iconName: "Users", href: "/dashboard/team", roles: ["SUPER_ADMIN", "ORG_ADMIN", "TEAM_LEADER"], minPlan: "TEAM" as const },
        { name: "Cola del Día", iconName: "ListOrdered", href: "/dashboard/walkins", roles: ["SUPER_ADMIN", "ORG_ADMIN", "TEAM_LEADER", "PROFESSIONAL"], minPlan: "SOLO" as const },
        { name: "Membresías", iconName: "Ticket", href: "/dashboard/memberships", roles: ["SUPER_ADMIN", "ORG_ADMIN"], minPlan: "TEAM" as const },
        { name: "Finanzas", iconName: "DollarSign", href: "/dashboard/finance", roles: ["SUPER_ADMIN", "ORG_ADMIN"], minPlan: "SOLO" as const },
        { name: "Chatbot", iconName: "MessageSquare", href: "/dashboard/chatbot", roles: ["SUPER_ADMIN", "ORG_ADMIN"], minPlan: "SOLO" as const },
        { name: "Planes", iconName: "Zap", href: "/dashboard/plans", roles: ["SUPER_ADMIN", "ORG_ADMIN"], minPlan: "SOLO" as const },
        { name: "Ajustes", iconName: "Settings", href: "/dashboard/settings", roles: ["SUPER_ADMIN", "ORG_ADMIN"], minPlan: "SOLO" as const },
    ];

    const navItems = allNavItems
        .filter((item) => {
            // Check role permission
            if (!item.roles.includes(role)) return false;
            // Check plan permission
            if (!canAccessByPlan(item.minPlan)) return false;
            return true;
        })
        .map(({ name, iconName, href }) => ({ name, iconName, href }));

    return (
        <TerminologyProvider shopType={shopType as any}>
        <DashboardProviders>
            <a href="#main-content" className="skip-to-content">Saltar al contenido</a>
            <div className="flex h-screen bg-[#F5F7FA] overflow-hidden text-sm">
                {/* ── Sidebar ── */}
                <aside className="hidden md:flex w-60 bg-white border-r border-gray-100 flex-col shrink-0">
                    {/* Logo */}
                    <div className="px-5 py-5 flex items-center gap-3 border-b border-gray-100">
                        <div className="w-8 h-8 shrink-0">
                            <Image src="/logo-icon.svg" alt="DomiCita" width={32} height={32} />
                        </div>
                        <div className="min-w-0">
                            <span className="block text-sm font-bold text-charcoal leading-tight">DomiCita</span>
                            <span className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                                {getShopTypeBadge(shopType)}
                            </span>
                        </div>
                    </div>

                    {/* Shop info */}
                    {shop && (
                        <div className="px-5 py-3 border-b border-gray-100">
                            <p className="text-xs font-bold text-charcoal truncate">{shop.name}</p>
                            <p className="text-[10px] text-gray-400 mt-0.5 font-medium uppercase tracking-wide">Plan {shop.plan}</p>
                        </div>
                    )}

                    {/* Nav */}
                    <SidebarNav items={navItems} />

                    {/* Help link */}
                    <div className="px-3 mt-auto">
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

                    {/* Profile */}
                    <div className="p-3 border-t border-gray-100">
                        <ProfileMenu
                            profile={profile}
                            role={role}
                            terminology={terminology}
                            shop={shop}
                        />
                    </div>
                </aside>

                {/* ── Main ── */}
                <main className="flex-1 flex flex-col overflow-hidden">
                    {/* Header */}
                    <header className="h-14 shrink-0 border-b border-gray-100 flex items-center px-4 md:px-6 bg-white/90 backdrop-blur-sm sticky top-0 z-40 justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                            {/* Mobile hamburger */}
                            <MobileSidebar
                                navItems={navItems}
                                shopName={shop?.name}
                                shopTypeBadge={getShopTypeBadge(shopType)}
                                planLabel={shop?.plan}
                            />
                            <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest truncate hidden sm:block">
                                {shop?.name || "Dashboard"}
                            </span>
                            <span className="text-gray-200 text-xs hidden sm:block">/</span>
                            <span className="text-xs font-semibold text-gray-600 uppercase tracking-widest">
                                {role === "ORG_ADMIN" ? "Admin" : role === "SUPER_ADMIN" ? "Super Admin" : role === "TEAM_LEADER" ? "Líder" : "Profesional"}
                            </span>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-100">
                                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">En línea</span>
                            </div>
                        </div>
                    </header>

                    {/* Reconnect banner */}
                    {(shop as any)?.needsReconnect && (
                        <div className="bg-red-50 border-b border-red-200 px-4 md:px-6 py-3">
                            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                <p className="text-sm text-red-900">
                                    <strong>Tu WhatsApp necesita reconectarse.</strong> Toma 2 minutos.
                                </p>
                                <Link
                                    href="/dashboard/settings?tab=whatsapp"
                                    className="inline-flex items-center px-4 py-1.5 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 shrink-0"
                                >
                                    Reconectar ahora →
                                </Link>
                            </div>
                        </div>
                    )}

                    {/* Content */}
                    <div id="main-content" className="flex-1 overflow-y-auto" tabIndex={-1}>
                        <div className="p-6 lg:p-8">
                            {children}
                        </div>
                    </div>
                </main>
            </div>
        </DashboardProviders>
        </TerminologyProvider>
    );
}
