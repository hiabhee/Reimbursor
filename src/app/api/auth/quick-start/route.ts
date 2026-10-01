import { randomBytes } from "crypto"
import { hash } from "bcryptjs"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withRateLimit } from "@/lib/rateLimit"
import { seedDemoData } from "@/lib/demo/demoData"

const createQuickStart = async () => {
  const suffix = randomBytes(6).toString("hex")
  const email = `starter-${suffix}@reimbursor.local`
  const password = `R${randomBytes(12).toString("base64url")}7a`
  const hashedPassword = await hash(password, 12)
  const domain = `${suffix}.demo.reimbursor.local`

  // One transaction so a mid-seed failure cannot leave a half-built workspace.
  // The default 5s interactive-transaction timeout is too short for 25+ sequential
  // creates plus receipt file writes.
  const result = await prisma.$transaction(
    async (tx) => {
      const company = await tx.company.create({
        data: { name: "My Workspace", currency: "USD" },
        select: { id: true },
      })

      const seeded = await seedDemoData(tx, {
        companyId: company.id,
        domain,
        ownerName: "Workspace Owner",
        ownerEmail: email,
        passwordHash: hashedPassword,
      })

      return { companyId: company.id, ...seeded }
    },
    { maxWait: 10_000, timeout: 120_000 }
  )

  return NextResponse.json(
    {
      email,
      password,
      companyId: result.companyId,
      demoUsers: result.demoUsers,
      counts: result.counts,
    },
    { status: 201, headers: { "Cache-Control": "no-store" } }
  )
}

export const POST = withRateLimit(createQuickStart, { max: 5, window: 60 * 1000 })
