import { NextResponse } from "next/server";
import { db } from "@/lib/database";
import { withAuth, withAuthAndRole, type AuthenticatedUser } from "@/lib/auth-middleware";
import { pushAppointmentToCalendar, deleteAppointmentFromCalendar } from "@/lib/integrations/google-calendar";
import { notifyOwnerCancellation } from "@/lib/whatsapp/owner-notifier";
import type { Role, Prisma } from "@prisma/client";

/**
 * PATCH /api/appointments/[id]
 * Update an appointment
 * Requires: ORG_ADMIN, TEAM_LEADER, or PROFESSIONAL role
 * Security: Only appointments from user's shop can be updated
 */
export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    return withAuthAndRole(async (authUser: AuthenticatedUser) => {
        try {
            const { id } = await params;
            const data = await request.json();

            const shopId = authUser.shopId; // 🔒 SECURITY: User's shop ID

            if (!shopId) {
                return NextResponse.json(
                    { error: "User has no shop assigned" },
                    { status: 403 }
                );
            }

            // Verify appointment belongs to user's shop
            const existingAppointment = await db.appointment.findFirst({
                where: {
                    id,
                    shopId, // 🔒 SECURITY: Must belong to user's shop
                }
            });

            if (!existingAppointment) {
                return NextResponse.json(
                    { error: "Appointment not found" },
                    { status: 404 }
                );
            }

            // If updating service, verify it belongs to user's shop
            if (data.serviceId) {
                const service = await db.service.findFirst({
                    where: {
                        id: data.serviceId,
                        shopId, // 🔒 SECURITY: Service must belong to user's shop
                    }
                });

                if (!service) {
                    return NextResponse.json(
                        { error: "Service not found" },
                        { status: 404 }
                    );
                }
            }

            // Build update payload — only include defined fields
            const updateData: Record<string, any> = {};
            if (data.clientName !== undefined)     updateData.clientName     = data.clientName;
            if (data.clientWhatsApp !== undefined) updateData.clientWhatsApp = data.clientWhatsApp;
            if (data.serviceId !== undefined)      updateData.serviceId      = data.serviceId;
            if (data.startTime !== undefined)      updateData.startTime      = new Date(data.startTime);
            if (data.endTime !== undefined)        updateData.endTime        = new Date(data.endTime);
            if (data.status !== undefined)         updateData.status         = data.status;

            // Payment tracking: CASH | CARD | TRANSFER | DEBT | MEMBERSHIP
            const VALID_PAYMENT_METHODS = ['CASH', 'CARD', 'TRANSFER', 'DEBT', 'MEMBERSHIP'];
            if (data.paymentMethod !== undefined) {
                if (!VALID_PAYMENT_METHODS.includes(data.paymentMethod)) {
                    return NextResponse.json({ error: 'Invalid paymentMethod' }, { status: 400 });
                }
                updateData.paymentMethod = data.paymentMethod;
            }
            if (data.paidAmount !== undefined) {
                const amount = Number(data.paidAmount);
                if (!Number.isFinite(amount) || amount < 0) {
                    return NextResponse.json({ error: 'paidAmount must be a non-negative number' }, { status: 400 });
                }
                updateData.paidAmount = amount;
            }
            if (data.paidAt !== undefined) updateData.paidAt = data.paidAt ? new Date(data.paidAt) : null;

            // Membership redemption: validate the assignment is active and belongs to this shop+client
            if (data.clientMembershipId !== undefined) {
                if (data.clientMembershipId === null) {
                    updateData.clientMembershipId = null;
                } else {
                    const membership = await db.clientMembership.findFirst({
                        where: { id: data.clientMembershipId, shopId },
                        include: { plan: true },
                    });
                    if (!membership) {
                        return NextResponse.json({ error: 'Membership not found' }, { status: 404 });
                    }
                    if (membership.status !== 'ACTIVE') {
                        return NextResponse.json({ error: `Membership is ${membership.status}` }, { status: 400 });
                    }
                    if (membership.servicesRemaining <= 0) {
                        return NextResponse.json({ error: 'No services remaining' }, { status: 400 });
                    }
                    if (membership.expiresAt && membership.expiresAt < new Date()) {
                        return NextResponse.json({ error: 'Membership expired' }, { status: 400 });
                    }
                    if (membership.clientId !== existingAppointment.clientId) {
                        return NextResponse.json({ error: 'Membership belongs to a different client' }, { status: 400 });
                    }
                    // Plan-level service applicability check
                    const allowedIds = membership.plan.applicableServiceIds;
                    const targetServiceId = data.serviceId ?? existingAppointment.serviceId;
                    if (allowedIds.length > 0 && !allowedIds.includes(targetServiceId)) {
                        return NextResponse.json({ error: 'This plan does not cover this service' }, { status: 400 });
                    }
                    updateData.clientMembershipId = data.clientMembershipId;
                    updateData.paymentMethod = 'MEMBERSHIP';
                    updateData.paidAmount = 0;
                    updateData.paidAt = updateData.paidAt ?? new Date();
                }
            }

            const appointment = await db.appointment.update({
                where: { id },
                data: updateData,
                include: {
                    service: true,
                    client: true,
                    stylist: true,
                }
            });

            // If we just redeemed a membership, decrement the counter and update its status
            if (updateData.clientMembershipId && existingAppointment.clientMembershipId !== updateData.clientMembershipId) {
                const updated = await db.clientMembership.update({
                    where: { id: updateData.clientMembershipId },
                    data: { servicesRemaining: { decrement: 1 } },
                });
                if (updated.servicesRemaining <= 0) {
                    await db.clientMembership.update({
                        where: { id: updated.id },
                        data: { status: 'EXHAUSTED' },
                    });
                }

                // Loyalty policy: if the shop excludes membership visits from loyalty,
                // undo the visitCount that was incremented at booking time.
                if (existingAppointment.clientId) {
                    const loyalty = await db.loyaltyConfig.findUnique({ where: { shopId } });
                    if (loyalty && !loyalty.countMembershipVisits) {
                        await db.client.update({
                            where: { id: existingAppointment.clientId },
                            data: { visitCount: { decrement: 1 } },
                        });
                    }
                }
            }

            // 📅 Sync to Google Calendar (fire-and-forget)
            if (data.status === 'CANCELLED' || data.status === 'NO_SHOW') {
                deleteAppointmentFromCalendar(id).catch((err) =>
                    console.error("Google Calendar delete error:", err)
                );
                // 🔔 Notify owner of cancellation (fire-and-forget, cancelled only)
                if (data.status === 'CANCELLED') {
                    notifyOwnerCancellation({
                        shopId,
                        appointmentId: id,
                        clientName: appointment.clientName,
                        serviceName: appointment.service?.name ?? 'servicio',
                        date: appointment.startTime,
                    }).catch((err) => console.error("Owner cancellation notify error:", err));
                }
            } else {
                pushAppointmentToCalendar(id).catch((err) =>
                    console.error("Google Calendar sync error:", err)
                );
            }

            // If marked as DEBT (fía), add unpaid balance to client's debt
            if (data.paymentMethod === 'DEBT' && appointment.clientId) {
                const servicePrice = appointment.service?.price ?? 0;
                const amountPaid   = data.paidAmount ?? 0;
                const debtAdded    = servicePrice - amountPaid;
                if (debtAdded > 0) {
                    await db.client.update({
                        where: { id: appointment.clientId },
                        data: { debtAmount: { increment: debtAdded } }
                    });
                }
            }

            return NextResponse.json(appointment);
        } catch (error) {
            console.error("Update Appointment Error:", error);
            return NextResponse.json(
                { error: "Failed to update appointment" },
                { status: 500 }
            );
        }
    }, request as any, ['ORG_ADMIN', 'TEAM_LEADER', 'PROFESSIONAL'] as Role[]);
}

/**
 * DELETE /api/appointments/[id]
 * Delete an appointment
 * Requires: ORG_ADMIN or TEAM_LEADER role
 * Security: Only appointments from user's shop can be deleted
 */
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    return withAuthAndRole(async (authUser: AuthenticatedUser) => {
        try {
            const { id } = await params;

            const shopId = authUser.shopId; // 🔒 SECURITY: User's shop ID

            if (!shopId) {
                return NextResponse.json(
                    { error: "User has no shop assigned" },
                    { status: 403 }
                );
            }

            // Verify appointment belongs to user's shop
            const existingAppointment = await db.appointment.findFirst({
                where: {
                    id,
                    shopId, // 🔒 SECURITY: Must belong to user's shop
                }
            });

            if (!existingAppointment) {
                return NextResponse.json(
                    { error: "Appointment not found" },
                    { status: 404 }
                );
            }

            // 📅 Remove from Google Calendar before deleting
            await deleteAppointmentFromCalendar(id).catch((err) =>
                console.error("Google Calendar delete error:", err)
            );

            // Delete appointment
            await db.appointment.delete({
                where: { id }
            });

            return NextResponse.json({ message: "Appointment deleted" });
        } catch (error) {
            console.error("Delete Appointment Error:", error);
            return NextResponse.json(
                { error: "Failed to delete appointment" },
                { status: 500 }
            );
        }
    }, request as any, ['ORG_ADMIN', 'TEAM_LEADER'] as Role[]);
}
