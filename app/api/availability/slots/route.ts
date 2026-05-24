import { NextResponse } from "next/server";
import { db } from "@/lib/database";
import {
    addMinutes,
    format,
    parse,
    startOfDay,
    endOfDay,
    isBefore,
    isAfter,
    areIntervalsOverlapping,
    setHours,
    setMinutes
} from "date-fns";

import { withAuth, type AuthenticatedUser } from "@/lib/auth-middleware";

export async function GET(request: Request) {
    return withAuth(async (authUser: AuthenticatedUser) => {
        try {
        const { searchParams } = new URL(request.url);
        const dateStr = searchParams.get("date"); // YYYY-MM-DD
        const serviceId = searchParams.get("serviceId");
        const stylistId = searchParams.get("stylistId") || "cmlmx6k5i0000un2glxt5hsg2"; // Default for demo

        console.log("DEBUG: Slots Request:", { dateStr, serviceId, stylistId });

        if (!dateStr || !serviceId) {
            return NextResponse.json({
                error: "Missing required params",
                received: { dateStr, serviceId, stylistId }
            }, { status: 400 });
        }

        const date = new Date(dateStr);
        const dayOfWeek = date.getDay(); // 0-6 (Sun-Sat)

        // 1. Get Service details (duration + buffer)
        const service = await db.service.findUnique({
            where: { id: serviceId }
        });
        if (!service) return NextResponse.json({ error: "Service not found" }, { status: 404 });

        // 2. Get Stylist availability for this day of week
        const availability = await db.availability.findFirst({
            where: { stylistId, dayOfWeek }
        });
        if (!availability) return NextResponse.json([]); // Not working this day

        // 2.1 Get Shop availability for this day of week
        const shop = await db.shop.findFirst();
        const shopAvailability = await db.shopAvailability.findFirst({
            where: { shopId: shop?.id, dayOfWeek }
        });
        if (!shopAvailability) return NextResponse.json([]); // Shop closed this day

        // 3. Get existing Appointments for this day
        const appointments = await db.appointment.findMany({
            where: {
                stylistId,
                startTime: { gte: startOfDay(date), lte: endOfDay(date) },
                status: { not: "CANCELLED" }
            }
        });

        // 4. Get Time Blocks (Breaks/Vacations) for this day
        const blocks = await db.timeBlock.findMany({
            where: {
                stylistId,
                startTime: { gte: startOfDay(date), lte: endOfDay(date) }
            }
        });

        // 5. Calculate Slots
        const slots: string[] = [];

        // Determine Effective Range
        const [shopStartH, shopStartM] = shopAvailability.startTime.split(":").map(Number);
        const [shopEndH, shopEndM] = shopAvailability.endTime.split(":").map(Number);

        const [stylistStartH, stylistStartM] = availability.startTime.split(":").map(Number);
        const [stylistEndH, stylistEndM] = availability.endTime.split(":").map(Number);

        // Effective Start (Intersection)
        const effectiveStartH = Math.max(shopStartH, stylistStartH);
        const effectiveStartM = Math.max(shopStartM, stylistStartM);

        // Effective End (Intersection)
        const effectiveEndH = Math.min(shopEndH, stylistEndH);
        const effectiveEndM = Math.min(shopEndM, stylistEndM);

        let currentSlot = setMinutes(setHours(startOfDay(date), effectiveStartH), effectiveStartM);
        const dayEnd = setMinutes(setHours(startOfDay(date), effectiveEndH), effectiveEndM);

        const totalDuration = service.duration + service.bufferTime;

        while (isBefore(currentSlot, dayEnd)) {
            const slotEnd = addMinutes(currentSlot, totalDuration);

            if (isAfter(slotEnd, dayEnd)) break;

            // Check overlap with appointments
            const hasAptOverlap = appointments.some(apt =>
                areIntervalsOverlapping(
                    { start: currentSlot, end: slotEnd },
                    { start: new Date(apt.startTime), end: new Date(apt.endTime) }
                )
            );

            // Check overlap with time blocks
            const hasBlockOverlap = blocks.some(block =>
                areIntervalsOverlapping(
                    { start: currentSlot, end: slotEnd },
                    { start: new Date(block.startTime), end: new Date(block.endTime) }
                )
            );

            if (!hasAptOverlap && !hasBlockOverlap) {
                slots.push(format(currentSlot, "HH:mm"));
            }

            // Move to next 30 min interval or service duration? 
            // Cal.com usually shows intervals (e.g., every 15 or 30 mins)
            currentSlot = addMinutes(currentSlot, 30);
        }

        return NextResponse.json(slots);
    } catch (error) {
        console.error("Slot Calculation Error:", error);
        return NextResponse.json({ error: "Failed to calculate slots" }, { status: 500 });
    }
    }, request as any);
}
