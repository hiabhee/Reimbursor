import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { hash } from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/lib/auth"

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const user = await prisma.user.findFirst({
    where: { id: params.id, companyId: session.user.companyId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      managerId: true,
      manager: {
        select: { id: true, name: true }
      },
      createdAt: true,
      reports: { select: { id: true, name: true, email: true, role: true } }
    },
  })

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  return NextResponse.json(user)
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { name, email, role, managerId, password } = body

    const user = await prisma.user.findFirst({
      where: { id: params.id, companyId: session.user.companyId },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    if (user.role === "ADMIN" && role !== undefined && role !== "ADMIN") {
      const adminCount = await prisma.user.count({
        where: { companyId: session.user.companyId, role: "ADMIN" },
      })

      if (adminCount <= 1) {
        return NextResponse.json(
          { error: "Cannot demote the only admin" },
          { status: 400 }
        )
      }
    }

    const updateData: Record<string, unknown> = {}

    if (name !== undefined) {
      if (name.length < 2 || name.length > 100) {
        return NextResponse.json(
          { error: "Name must be between 2 and 100 characters" },
          { status: 400 }
        )
      }
      updateData.name = name
    }

    if (email !== undefined) {
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailPattern.test(email)) {
        return NextResponse.json(
          { error: "Invalid email format" },
          { status: 400 }
        )
      }

      const existing = await prisma.user.findFirst({
        where: { email, companyId: session.user.companyId, NOT: { id: params.id } },
      })

      if (existing) {
        return NextResponse.json(
          { error: "Email already in use by another user" },
          { status: 400 }
        )
      }

      updateData.email = email
    }

    if (role !== undefined) {
      const validRoles = ["EMPLOYEE", "MANAGER", "ADMIN"]
      if (!validRoles.includes(role)) {
        return NextResponse.json(
          { error: "Invalid role" },
          { status: 400 }
        )
      }
      updateData.role = role
    }

    if (managerId !== undefined) {
      if (managerId === params.id) {
        return NextResponse.json(
          { error: "User cannot be their own manager" },
          { status: 400 }
        )
      }

      if (managerId !== null) {
        const manager = await prisma.user.findFirst({
          where: { id: managerId, companyId: session.user.companyId, role: { in: ["MANAGER", "ADMIN"] } },
        })

        if (!manager) {
          return NextResponse.json(
            { error: "Invalid manager" },
            { status: 400 }
          )
        }
      }

      updateData.managerId = managerId
    }

    if (password !== undefined) {
      if (password.length < 6) {
        return NextResponse.json(
          { error: "Password must be at least 6 characters" },
          { status: 400 }
        )
      }
      updateData.password = await hash(password, 12)
    }

    const updatedUser = await prisma.user.update({
      where: { id: params.id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        managerId: true,
        manager: {
          select: { id: true, name: true }
        },
        createdAt: true,
      },
    })

    return NextResponse.json(updatedUser)
  } catch (error) {
    console.error("Update user error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const user = await prisma.user.findFirst({
    where: { id: params.id, companyId: session.user.companyId },
  })

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  if (user.role === "ADMIN") {
    const adminCount = await prisma.user.count({
      where: { companyId: session.user.companyId, role: "ADMIN" },
    })

    if (adminCount <= 1) {
      return NextResponse.json(
        { error: "Cannot delete the only admin" },
        { status: 400 }
      )
    }
  }

  await prisma.user.updateMany({
    where: { managerId: params.id },
    data: { managerId: null },
  })

  await prisma.user.delete({
    where: { id: params.id },
  })

  return NextResponse.json({ success: true })
}
