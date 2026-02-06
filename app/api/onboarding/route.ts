import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UserRole, UserStatus } from "@prisma/client";
import { NextResponse } from "next/server";

const VALID_ROLES: UserRole[] = ["admin", "office", "manager"];

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const role = body.role as UserRole | undefined;
  const locationId = typeof body.locationId === "string" ? body.locationId : undefined;

  if (!name || name.length < 1) {
    return NextResponse.json(
      { error: "Name is required" },
      { status: 400 }
    );
  }
  if (!role || !VALID_ROLES.includes(role)) {
    return NextResponse.json(
      { error: "Valid role is required (admin, office, manager)" },
      { status: 400 }
    );
  }

  if (role === "manager") {
    if (!locationId) {
      return NextResponse.json(
        { error: "Location is required for manager role" },
        { status: 400 }
      );
    }
    const location = await prisma.location.findUnique({
      where: { id: locationId },
    });
    if (!location) {
      return NextResponse.json(
        { error: "Invalid location" },
        { status: 400 }
      );
    }
  }

  // Admin is active immediately; office and manager need approval
  const status: UserStatus =
    role === "admin" ? "active" : "pending_approval";

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      name,
      role,
      status,
      locationId: role === "manager" ? locationId : null,
    },
  });

  return NextResponse.json({ ok: true });
}
