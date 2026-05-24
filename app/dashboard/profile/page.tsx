import { getProfileWithMembership } from "@/lib/auth-utils";
import { redirect } from "next/navigation";
import { User, Mail, Phone, Building2, Calendar, Shield } from "lucide-react";

export default async function ProfilePage() {
    const profile = await getProfileWithMembership();

    if (!profile) {
        redirect("/login");
    }

    const membership = profile?.memberships[0];
    const shop = membership?.shop;
    const role = membership?.role;

    return (
        <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-2xl font-black text-gray-600 mb-2">Mi Perfil</h1>
                <p className="text-sm text-gray-600">Información de tu cuenta y membresía</p>
            </div>

            {/* Profile Card */}
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-6">
                {/* Header with Avatar */}
                <div className="bg-gradient-to-r from-slate-900 to-slate-700 h-32 relative">
                    <div className="absolute -bottom-12 left-8">
                        <div className="w-24 h-24 rounded-2xl bg-white border-4 border-white shadow-lg flex items-center justify-center text-gray-600 font-black text-2xl overflow-hidden">
                            {profile?.avatarUrl ? (
                                <img src={profile.avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                            ) : (
                                profile?.name?.substring(0, 2).toUpperCase() || "US"
                            )}
                        </div>
                    </div>
                </div>

                <div className="pt-16 pb-8 px-8">
                    <div className="flex items-start justify-between mb-6">
                        <div>
                            <h2 className="text-xl font-bold text-gray-600">{profile?.name || 'Usuario'}</h2>
                            <p className="text-sm text-gray-600">{profile?.email}</p>
                        </div>
                        <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-bold uppercase">
                            {role?.replace('_', ' ')}
                        </span>
                    </div>

                    {/* User Details */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-3 p-3 bg-gray-100 rounded-xl">
                            <User className="h-5 w-5 text-gray-600" />
                            <div>
                                <p className="text-xs text-gray-600">Nombre Completo</p>
                                <p className="text-sm font-semibold text-gray-600">{profile?.name || 'No especificado'}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 p-3 bg-gray-100 rounded-xl">
                            <Mail className="h-5 w-5 text-gray-600" />
                            <div>
                                <p className="text-xs text-gray-600">Email</p>
                                <p className="text-sm font-semibold text-gray-600">{profile?.email || 'No especificado'}</p>
                            </div>
                        </div>

                        {profile?.phoneNumber && (
                            <div className="flex items-center gap-3 p-3 bg-gray-100 rounded-xl">
                                <Phone className="h-5 w-5 text-gray-600" />
                                <div>
                                    <p className="text-xs text-gray-600">Teléfono</p>
                                    <p className="text-sm font-semibold text-gray-600">{profile.phoneNumber}</p>
                                </div>
                            </div>
                        )}

                        {profile?.createdAt && (
                            <div className="flex items-center gap-3 p-3 bg-gray-100 rounded-xl">
                                <Calendar className="h-5 w-5 text-gray-600" />
                                <div>
                                    <p className="text-xs text-gray-600">Miembro desde</p>
                                    <p className="text-sm font-semibold text-gray-600">
                                        {new Date(profile.createdAt).toLocaleDateString('es-DO', {
                                            year: 'numeric',
                                            month: 'long',
                                            day: 'numeric'
                                        })}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Shop Membership Card */}
            {shop && (
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                    <div className="p-6 border-b border-gray-200">
                        <div className="flex items-center gap-2 mb-1">
                            <Building2 className="h-5 w-5 text-gray-600" />
                            <h3 className="text-lg font-bold text-gray-600">Membresía del Shop</h3>
                        </div>
                        <p className="text-sm text-gray-600">Tu afiliación actual</p>
                    </div>

                    <div className="p-6 space-y-4">
                        <div className="flex items-center justify-between p-3 bg-gray-100 rounded-xl">
                            <div>
                                <p className="text-xs text-gray-600">Shop</p>
                                <p className="text-sm font-semibold text-gray-600">{shop.name}</p>
                            </div>
                            <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-lg text-xs font-bold">
                                {shop.shopType.replace('_', ' ')}
                            </span>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-gray-100 rounded-xl">
                            <div>
                                <p className="text-xs text-gray-600">Plan</p>
                                <p className="text-sm font-semibold text-gray-600">{shop.plan}</p>
                            </div>
                            <Shield className="h-5 w-5 text-gray-600" />
                        </div>

                        <div className="flex items-center justify-between p-3 bg-gray-100 rounded-xl">
                            <div>
                                <p className="text-xs text-gray-600">Rol</p>
                                <p className="text-sm font-semibold text-gray-600">{role?.replace('_', ' ')}</p>
                            </div>
                            <Shield className="h-5 w-5 text-gray-600" />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
