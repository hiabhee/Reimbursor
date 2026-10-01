import { randomUUID } from "crypto"
import { mkdir, writeFile } from "fs/promises"
import { join } from "path"
import type { ExpenseCategory, ExpenseStatus, Prisma, PrismaClient, Role } from "@prisma/client"
import { renderReceiptPng } from "./receiptImage"

const RATES_TO_USD: Record<string, number> = {
  USD: 1,
  EUR: 1.09,
  GBP: 1.27,
  INR: 0.012,
  JPY: 0.0067,
  SGD: 0.74,
  CAD: 0.73,
  AUD: 0.66,
}

const FINANCE_REVIEW_THRESHOLD = 5000

type DemoState = "draft" | "pending" | "approved" | "rejected" | "overrideApproved" | "overrideRejected"

interface DemoExpenseSpec {
  description: string
  category: ExpenseCategory
  amount: number
  currency: string
  daysAgo: number
  state: DemoState
  employee: string
  comment?: string
  overrideComment?: string
}

const MANAGERS = [
  { key: "marcus", name: "Marcus Webb", role: "MANAGER" as Role, title: "Engineering Manager" },
  { key: "priya", name: "Priya Raman", role: "MANAGER" as Role, title: "Sales Manager" },
]

const EMPLOYEES = [
  { key: "dana", name: "Dana Kim", role: "EMPLOYEE" as Role, managerKey: "marcus", title: "Software Engineer" },
  { key: "luis", name: "Luis Ortega", role: "EMPLOYEE" as Role, managerKey: "marcus", title: "Platform Engineer" },
  { key: "tom", name: "Tom Bexley", role: "EMPLOYEE" as Role, managerKey: "marcus", title: "QA Engineer" },
  { key: "nina", name: "Nina Patel", role: "EMPLOYEE" as Role, managerKey: "priya", title: "Account Executive" },
  { key: "omar", name: "Omar Haddad", role: "EMPLOYEE" as Role, managerKey: "priya", title: "Sales Development Rep" },
  { key: "grace", name: "Grace Lin", role: "EMPLOYEE" as Role, managerKey: "priya", title: "Customer Success Manager" },
]

const EXPENSES: DemoExpenseSpec[] = [
  { description: "Desk setup supplies", category: "EQUIPMENT", amount: 249, currency: "USD", daysAgo: 0, state: "draft", employee: "Workspace Owner" },
  { description: "Hilton San Francisco - 2 nights, client onsite", category: "ACCOMMODATION", amount: 323.68, currency: "USD", daysAgo: 2, state: "pending", employee: "Dana Kim" },
  { description: "Blue Bottle Coffee with client", category: "MEALS", amount: 11.17, currency: "USD", daysAgo: 2, state: "pending", employee: "Dana Kim" },
  { description: "Uber airport to hotel", category: "TRANSPORTATION", amount: 47.5, currency: "USD", daysAgo: 2, state: "approved", employee: "Dana Kim" },
  { description: "Team offsite dinner", category: "MEALS", amount: 214.3, currency: "USD", daysAgo: 9, state: "approved", employee: "Marcus Webb" },
  { description: "GitHub Copilot seats for the platform team", category: "EQUIPMENT", amount: 8400, currency: "USD", daysAgo: 14, state: "pending", employee: "Marcus Webb" },
  { description: "Standing desk riser", category: "EQUIPMENT", amount: 289, currency: "USD", daysAgo: 0, state: "draft", employee: "Luis Ortega" },
  { description: "Amtrak Boston round trip", category: "TRAVEL", amount: 186, currency: "USD", daysAgo: 5, state: "approved", employee: "Luis Ortega" },
  { description: "AWS Well-Architected workshop", category: "OTHER", amount: 1200, currency: "USD", daysAgo: 21, state: "rejected", employee: "Luis Ortega", comment: "This looks like a self-paced course, not a workshop. Please resubmit with the invoice." },
  { description: "Cafe lunch during sprint review", category: "MEALS", amount: 24.9, currency: "USD", daysAgo: 3, state: "pending", employee: "Tom Bexley" },
  { description: "Playwright testing service", category: "SUPPLIES", amount: 96, currency: "USD", daysAgo: 1, state: "draft", employee: "Tom Bexley" },
  { description: "SFO parking, 3 days", category: "TRANSPORTATION", amount: 63, currency: "USD", daysAgo: 7, state: "approved", employee: "Tom Bexley" },
  { description: "Ristorante Da Mario - client dinner Milan", category: "MEALS", amount: 71.3, currency: "EUR", daysAgo: 4, state: "pending", employee: "Nina Patel" },
  { description: "Eurostar London to Paris", category: "TRAVEL", amount: 148, currency: "EUR", daysAgo: 4, state: "approved", employee: "Nina Patel" },
  { description: "Hotel Adlon Berlin, 3 nights", category: "ACCOMMODATION", amount: 612, currency: "EUR", daysAgo: 4, state: "pending", employee: "Nina Patel" },
  { description: "Salesforce Summit conference pass", category: "TRAVEL", amount: 1799, currency: "USD", daysAgo: 30, state: "approved", employee: "Priya Raman" },
  { description: "Team lunch - pipeline review", category: "MEALS", amount: 138.4, currency: "USD", daysAgo: 6, state: "rejected", employee: "Omar Haddad", comment: "Over the per-person meal limit. Split the cost or attach the attendee list." },
  { description: "Sales Navigator annual subscription", category: "SUPPLIES", amount: 1198.8, currency: "USD", daysAgo: 11, state: "approved", employee: "Omar Haddad" },
  { description: "Taxi to prospect office", category: "TRANSPORTATION", amount: 28.5, currency: "USD", daysAgo: 2, state: "pending", employee: "Omar Haddad" },
  { description: "Target - office supplies and desk lamp", category: "SUPPLIES", amount: 50.29, currency: "USD", daysAgo: 1, state: "approved", employee: "Omar Haddad" },
  { description: "Notebook and pens for workshop", category: "SUPPLIES", amount: 42.75, currency: "USD", daysAgo: 1, state: "draft", employee: "Grace Lin" },
  { description: "Zendesk certification exam", category: "OTHER", amount: 325, currency: "USD", daysAgo: 8, state: "approved", employee: "Grace Lin" },
  { description: "Customer dinner - renewal close", category: "MEALS", amount: 268.9, currency: "USD", daysAgo: 12, state: "pending", employee: "Grace Lin" },
  { description: "Conference booth printing", category: "SUPPLIES", amount: 764.2, currency: "USD", daysAgo: 16, state: "overrideApproved", employee: "Priya Raman", overrideComment: "Approved on-site during the event. Marketing has confirmed the spend." },
  { description: "Executive offsite catering", category: "MEALS", amount: 2180, currency: "USD", daysAgo: 18, state: "overrideRejected", employee: "Marcus Webb", overrideComment: "Duplicate of the catering invoice submitted by Operations." },
  { description: "International roaming - Tokyo trip", category: "OTHER", amount: 88.4, currency: "USD", daysAgo: 25, state: "approved", employee: "Nina Patel" },
  { description: "Monitoring dashboards subscription", category: "SUPPLIES", amount: 540, currency: "USD", daysAgo: 13, state: "approved", employee: "Luis Ortega" },
  { description: "Datadog infrastructure monitoring renewal", category: "SUPPLIES", amount: 6240, currency: "USD", daysAgo: 12, state: "approved", employee: "Luis Ortega" },
  { description: "Train to customer site Munich", category: "TRAVEL", amount: 132, currency: "EUR", daysAgo: 5, state: "pending", employee: "Tom Bexley" },
]

const CHAT_MESSAGES: Array<{ from: string; to: string; message: string; hoursAgo: number; read: boolean }> = [
  { from: "Dana Kim", to: "Marcus Webb", message: "Submitting my hotel and coffee expenses from the SF trip - the Hilton folio is attached.", hoursAgo: 50, read: true },
  { from: "Marcus Webb", to: "Dana Kim", message: "Got them, reviewing now. The client dinner in the folio looks right.", hoursAgo: 47, read: true },
  { from: "Marcus Webb", to: "Tom Bexley", message: "Your AWS workshop claim came back - can you attach the actual invoice?", hoursAgo: 40, read: true },
  { from: "Tom Bexley", to: "Marcus Webb", message: "On it, the receipt I had was the course listing page. Sending the real one.", hoursAgo: 38, read: true },
  { from: "Nina Patel", to: "Priya Raman", message: "Berlin trip is in. The hotel is the biggest line item so it needs your sign-off before finance.", hoursAgo: 30, read: true },
  { from: "Priya Raman", to: "Nina Patel", message: "Approved the travel, working through the hotel now.", hoursAgo: 28, read: true },
  { from: "Omar Haddad", to: "Priya Raman", message: "Heads up: the team lunch I filed was over the limit. I'll resubmit with the attendee list.", hoursAgo: 20, read: false },
  { from: "Grace Lin", to: "Priya Raman", message: "Renewal dinner is pending. The customer asked to split the bill - should I still submit the full amount?", hoursAgo: 6, read: false },
]

const OCR_SAMPLES: Array<{
  employee: string
  merchant: string
  amount: number
  currency: string
  date: string
  category: string
  rawText: string
}> = [
  {
    employee: "Dana Kim",
    merchant: "HILTON SAN FRANCISCO",
    amount: 323.68,
    currency: "USD",
    date: "2026-09-24",
    category: "ACCOMMODATION",
    rawText: "HILTON SAN FRANCISCO\n333 O'FARRELL ST\nFOLIO #884-2213\nCHECK-IN 09/24/2026\nCHECK-OUT 09/26/2026\nROOM CHARGE 289.00\nCITY TAX 34.68\nTOTAL USD 323.68\nMASTERCARD ****9911",
  },
  {
    employee: "Nina Patel",
    merchant: "RISTORANTE DA MARIO",
    amount: 71.3,
    currency: "EUR",
    date: "2026-09-22",
    category: "MEALS",
    rawText: "RISTORANTE DA MARIO\nVIA ROMA 12 MILANO\n22/09/2026 20:45\n2X TAGLIATELLE 32,00 EUR\n1X RISOTTO 24,00 EUR\nCOPERTO 6,00 EUR\nCASSA 62,00 EUR\nMANCIA 15% 9,30 EUR\nTOTALE 71,30 EUR\nCARD VISA",
  },
  {
    employee: "Omar Haddad",
    merchant: "TARGET #1284",
    amount: 50.29,
    currency: "USD",
    date: "2026-09-25",
    category: "SUPPLIES",
    rawText: "TARGET #1284\n09/25/2026 7:12 PM\nPAPER TOWELS $14.99\nAA BATTERIES 4PK $9.49\nDESK LAMP $22.00\nSUBTOTAL $46.48\nSALES TAX $3.81\nTOTAL $50.29\nVISA ****1881",
  },
]

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000)
}

function hoursAgo(hours: number): Date {
  return new Date(Date.now() - hours * 60 * 60 * 1000)
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

async function writeReceiptFiles(
  specs: Array<{ merchant: string; description: string; total: string; currency: string }>
): Promise<Map<number, { storageKey: string; size: number }>> {
  const dir = process.env.RECEIPT_STORAGE_DIR || join(process.cwd(), ".data", "receipts")
  await mkdir(dir, { recursive: true })

  const written = new Map<number, { storageKey: string; size: number }>()

  for (let i = 0; i < specs.length; i++) {
    const spec = specs[i]!
    const storageKey = `${randomUUID()}.png`
    const buffer = renderReceiptPng({
      merchant: spec.merchant,
      lines: [spec.description.toUpperCase().slice(0, 40), `AMOUNT DUE ${spec.total} ${spec.currency}`],
      total: spec.total,
    })
    await writeFile(join(dir, storageKey), buffer)
    written.set(i, { storageKey, size: buffer.length })
  }

  return written
}

export interface DemoSeedParams {
  companyId: string
  domain: string
  ownerName: string
  ownerEmail: string
  passwordHash: string
}

export interface DemoUserSummary {
  name: string
  email: string
  role: Role
  title: string
}

export interface DemoSeedResult {
  demoUsers: DemoUserSummary[]
  counts: {
    users: number
    expenses: number
    approvalActions: number
    notifications: number
    chatMessages: number
    ocrExtractions: number
    receipts: number
  }
}

export async function seedDemoData(
  prisma: PrismaClient | Prisma.TransactionClient,
  params: DemoSeedParams
): Promise<DemoSeedResult> {
  const { companyId, domain, ownerName, ownerEmail, passwordHash } = params
  const emailFor = (key: string) => `${key}@${domain}`

  const users = await prisma.user.createManyAndReturn({
    data: [
      { name: ownerName, email: ownerEmail, password: passwordHash, role: "ADMIN", companyId },
      ...MANAGERS.map((m) => ({ name: m.name, email: emailFor(m.key), password: passwordHash, role: m.role, companyId })),
      ...EMPLOYEES.map((e) => ({ name: e.name, email: emailFor(e.key), password: passwordHash, role: e.role, companyId })),
    ],
    select: { id: true, name: true, email: true, role: true },
  })

  const idByName = new Map(users.map((u) => [u.name, u.id]))
  const idOf = (name: string) => {
    const found = idByName.get(name)
    if (!found) throw new Error(`Demo seed: unknown user "${name}"`)
    return found
  }

  const owner = users.find((u) => u.email === ownerEmail)
  if (!owner) throw new Error("Demo seed: owner was not created")
  const ownerId = owner.id

  // Persons are addressed by name in the expense/chat/OCR specs but by key in
  // the org chart, so both lookups are needed.
  const idOfKey = (key: string) => {
    const person = [...MANAGERS, ...EMPLOYEES].find((p) => p.key === key)
    if (!person) throw new Error(`Demo seed: unknown user key "${key}"`)
    return idOf(person.name)
  }

  // Managers report to the owner; employees report to their manager.
  const managerIdByName = new Map<string, string>()
  for (const m of MANAGERS) managerIdByName.set(m.name, ownerId)
  for (const e of EMPLOYEES) managerIdByName.set(e.name, idOfKey(e.managerKey))

  await prisma.user.updateMany({
    where: { id: { in: MANAGERS.map((m) => idOf(m.name)) } },
    data: { managerId: ownerId },
  })

  for (const e of EMPLOYEES) {
    await prisma.user.update({
      where: { id: idOf(e.name) },
      data: { managerId: idOfKey(e.managerKey) },
    })
  }

  const workflow = await prisma.approvalWorkflow.create({
    data: {
      companyId,
      name: "Standard Expense Approval",
      description: "Line manager review, with finance review for expenses of 5,000 USD or more.",
      isActive: true,
      steps: {
        create: [
          {
            stepOrder: 1,
            name: "Line Manager Review",
            approverIds: [],
            type: "SEQUENTIAL",
            minApprovalPercent: 100,
            approverRole: "MANAGER",
          },
          {
            stepOrder: 2,
            name: "Finance Director Review",
            approverIds: [ownerId],
            type: "SEQUENTIAL",
            minApprovalPercent: 100,
            minAmount: FINANCE_REVIEW_THRESHOLD,
          },
        ],
      },
    },
    include: { steps: { orderBy: { stepOrder: "asc" } } },
  })

  const managerStep = workflow.steps[0]
  const financeStep = workflow.steps[1]
  if (!managerStep || !financeStep) throw new Error("Demo seed: workflow steps missing")

  const marcusId = idOf("Marcus Webb")
  const priyaId = idOf("Priya Raman")

  await prisma.approvalRule.createMany({
    data: [
      {
        companyId,
        name: "Default approver fallback",
        description: "Used only when no active workflow is configured.",
        approversSequence: true,
        minApprovalPercentage: 100,
      },
      {
        companyId,
        name: "High value purchases",
        description: "Anything above 1,000 USD needs two approvers.",
        minApprovalPercentage: 100,
      },
    ],
  })

  const fallbackRule = await prisma.approvalRule.findFirstOrThrow({
    where: { companyId, name: "Default approver fallback" },
    select: { id: true },
  })
  const highValueRule = await prisma.approvalRule.findFirstOrThrow({
    where: { companyId, name: "High value purchases" },
    select: { id: true },
  })

  await prisma.approvalRuleApprover.createMany({
    data: [
      { ruleId: fallbackRule.id, userId: marcusId, stepOrder: 1, required: true },
      { ruleId: fallbackRule.id, userId: priyaId, stepOrder: 2, required: false },
      { ruleId: highValueRule.id, userId: priyaId, stepOrder: 1, required: true },
      { ruleId: highValueRule.id, userId: ownerId, stepOrder: 2, required: true },
    ],
  })

  const receiptSpecs = EXPENSES.filter((e) => e.state !== "draft").map((e) => ({
    merchant: e.description.split(" ")[0] ?? "Receipt",
    description: e.description,
    total: e.amount.toFixed(2),
    currency: e.currency,
  }))
  const receiptFiles = await writeReceiptFiles(receiptSpecs)

  const EXPENSE_SELECT = {
    id: true,
    description: true,
    status: true,
    convertedAmount: true,
    submittedAmount: true,
    employeeId: true,
    createdAt: true,
  } as const

  type SeededExpense = Prisma.ExpenseGetPayload<{ select: typeof EXPENSE_SELECT }>

  // Created sequentially (not createManyAndReturn) so returned rows stay aligned
  // with EXPENSES by index for actions, receipts, notifications and OCR.
  const expenses: SeededExpense[] = []

  for (const spec of EXPENSES) {
    const createdAt = daysAgo(spec.daysAgo)
    const rate = RATES_TO_USD[spec.currency] ?? 1
    const isOverride = spec.state === "overrideApproved" || spec.state === "overrideRejected"
    const isResolved =
      spec.state === "approved" || spec.state === "overrideApproved" || spec.state === "overrideRejected"

    let status: ExpenseStatus = "DRAFT"
    if (spec.state === "pending") status = "PENDING"
    else if (spec.state === "approved" || spec.state === "overrideApproved") status = "APPROVED"
    else if (spec.state === "rejected" || spec.state === "overrideRejected") status = "REJECTED"

    const created = await prisma.expense.create({
      data: {
        description: spec.description,
        category: spec.category,
        date: createdAt,
        submittedAmount: spec.amount,
        submittedCurrency: spec.currency,
        convertedAmount: round2(spec.amount * rate),
        exchangeRate: rate,
        status,
        currentWorkflowStep: spec.state === "draft" ? 0 : isResolved ? -1 : 1,
        companyId,
        employeeId: idOf(spec.employee),
        createdAt,
        updatedAt: createdAt,
        isAdminOverride: isOverride,
        adminOverrideById: isOverride ? ownerId : null,
        adminOverrideAt: isOverride ? daysAgo(Math.max(0, spec.daysAgo - 1)) : null,
        adminOverrideComment: isOverride ? spec.overrideComment ?? null : null,
      },
      select: EXPENSE_SELECT,
    })

    expenses.push(created)
  }

  interface ActionRow {
    expenseId: string
    stepId: string
    approverId: string
    action: "PENDING" | "APPROVED" | "REJECTED" | "SKIPPED"
    stepOrder: number
    comment: string | null
    actedAt: Date | null
    createdAt: Date
  }

  const actionRows: ActionRow[] = []

  for (let i = 0; i < expenses.length; i++) {
    const expense = expenses[i]!
    const spec = EXPENSES[i]!
    const managerId = managerIdByName.get(spec.employee) ?? ownerId
    const needsFinance = Number(expense.convertedAmount) >= FINANCE_REVIEW_THRESHOLD

    if (spec.state === "draft") continue

    if (spec.state === "pending") {
      // Only the active step gets an action. The engine creates the finance
      // action when it advances the expense to step 2 after step 1 is approved.
      actionRows.push({
        expenseId: expense.id,
        stepId: managerStep.id,
        approverId: managerId,
        action: "PENDING",
        stepOrder: 1,
        comment: null,
        actedAt: null,
        createdAt: expense.createdAt,
      })
      continue
    }

    const isOverride = spec.state === "overrideApproved" || spec.state === "overrideRejected"
    const rejected = spec.state === "rejected" || spec.state === "overrideRejected"
    const actedAt = new Date(expense.createdAt.getTime() + 6 * 60 * 60 * 1000)

    actionRows.push({
      expenseId: expense.id,
      stepId: managerStep.id,
      approverId: managerId,
      action: isOverride ? (spec.state === "overrideApproved" ? "APPROVED" : "REJECTED") : rejected ? "REJECTED" : "APPROVED",
      stepOrder: 1,
      comment: isOverride ? spec.overrideComment ?? null : rejected ? spec.comment ?? null : null,
      actedAt,
      createdAt: expense.createdAt,
    })

    if (!needsFinance) continue

    if (isOverride) {
      actionRows.push({
        expenseId: expense.id,
        stepId: financeStep.id,
        approverId: ownerId,
        action: "SKIPPED",
        stepOrder: 2,
        comment: "Skipped by admin override",
        actedAt,
        createdAt: expense.createdAt,
      })
    } else if (rejected) {
      // Rejected at step 1, so the finance step was never activated.
    } else {
      actionRows.push({
        expenseId: expense.id,
        stepId: financeStep.id,
        approverId: ownerId,
        action: "APPROVED",
        stepOrder: 2,
        comment: "Within the approved quarterly budget",
        actedAt: new Date(actedAt.getTime() + 4 * 60 * 60 * 1000),
        createdAt: expense.createdAt,
      })
    }
  }

  if (actionRows.length > 0) await prisma.approvalAction.createMany({ data: actionRows })

  type NotificationRow = {
    userId: string
    expenseId: string | null
    type:
      | "INFO"
      | "EXPENSE_SUBMITTED"
      | "APPROVAL_ACTION"
      | "EXPENSE_APPROVED"
      | "EXPENSE_REJECTED"
      | "STEP_ACTIVATED"
    title: string
    message: string
    read: boolean
    idempotencyKey: string
    createdAt: Date
  }

  const notifications: NotificationRow[] = []
  const approverPool = [marcusId, priyaId, ownerId]

  for (let i = 0; i < expenses.length; i++) {
    const expense = expenses[i]!
    const spec = EXPENSES[i]!
    if (spec.state === "draft") continue

    const employeeId = expense.employeeId
    const employeeName = spec.employee
    const managerId = managerIdByName.get(employeeName) ?? ownerId
    const submittedAt = expense.createdAt
    const isPending = spec.state === "pending"

    for (const approverId of approverPool) {
      notifications.push({
        userId: approverId,
        expenseId: expense.id,
        type: "EXPENSE_SUBMITTED",
        title: "New Expense Submitted",
        message: `${employeeName} submitted expense: "${expense.description}"`,
        read: !isPending,
        idempotencyKey: `EXPENSE_SUBMITTED:${expense.id}:${approverId}`,
        createdAt: submittedAt,
      })
    }

    if (isPending) {
      notifications.push({
        userId: managerId,
        expenseId: expense.id,
        type: "STEP_ACTIVATED",
        title: "Approval Required",
        message: `A new expense "${expense.description}" requires your approval (Step 1).`,
        read: false,
        idempotencyKey: `STEP_ACTIVATED:${expense.id}:${managerId}:1`,
        createdAt: new Date(submittedAt.getTime() + 60 * 1000),
      })
    }

    if (spec.state === "approved") {
      notifications.push({
        userId: employeeId,
        expenseId: expense.id,
        type: "EXPENSE_APPROVED",
        title: "Expense Approved",
        message: `Your expense "${expense.description}" has been fully approved!`,
        read: true,
        idempotencyKey: `EXPENSE_APPROVED:${expense.id}`,
        createdAt: new Date(submittedAt.getTime() + 12 * 60 * 60 * 1000),
      })
      notifications.push({
        userId: employeeId,
        expenseId: expense.id,
        type: "APPROVAL_ACTION",
        title: "Expense Approved",
        message: `Your expense "${expense.description}" was approved.`,
        read: true,
        idempotencyKey: `APPROVAL_ACTION:${expense.id}:${managerId}:APPROVED:1`,
        createdAt: new Date(submittedAt.getTime() + 12 * 60 * 60 * 1000),
      })
    }

    if (spec.state === "rejected") {
      const reason = spec.comment ? ` Reason: ${spec.comment}` : ""
      notifications.push({
        userId: employeeId,
        expenseId: expense.id,
        type: "EXPENSE_REJECTED",
        title: "Expense Rejected",
        message: `Your expense "${expense.description}" was rejected.${reason}`,
        read: true,
        idempotencyKey: `EXPENSE_REJECTED:${expense.id}`,
        createdAt: new Date(submittedAt.getTime() + 12 * 60 * 60 * 1000),
      })
      notifications.push({
        userId: employeeId,
        expenseId: expense.id,
        type: "APPROVAL_ACTION",
        title: "Expense Rejected",
        message: `Your expense "${expense.description}" was rejected.${spec.comment ? ` Comment: ${spec.comment}` : ""}`,
        read: true,
        idempotencyKey: `APPROVAL_ACTION:${expense.id}:${managerId}:REJECTED:1`,
        createdAt: new Date(submittedAt.getTime() + 12 * 60 * 60 * 1000),
      })
    }

    if (spec.state === "overrideApproved" || spec.state === "overrideRejected") {
      const approved = spec.state === "overrideApproved"
      notifications.push({
        userId: employeeId,
        expenseId: expense.id,
        type: approved ? "EXPENSE_APPROVED" : "EXPENSE_REJECTED",
        title: approved ? "Expense Approved" : "Expense Rejected",
        message: approved
          ? `Your expense "${expense.description}" was approved by a workspace admin.`
          : `Your expense "${expense.description}" was rejected by a workspace admin.${spec.overrideComment ? ` Reason: ${spec.overrideComment}` : ""}`,
        read: false,
        idempotencyKey: `${approved ? "EXPENSE_APPROVED" : "EXPENSE_REJECTED"}:${expense.id}`,
        createdAt: new Date(submittedAt.getTime() + 3 * 60 * 60 * 1000),
      })
    }
  }

  const notices: Array<{ userId: string; title: string; message: string; read: boolean }> = [
    { userId: ownerId, title: "Quarterly policy refresh", message: "The travel policy was updated. Review the new per-diem limits in Admin settings.", read: true },
    { userId: marcusId, title: "Approvals are backing up", message: "You have pending approvals that are more than 3 days old.", read: false },
    { userId: priyaId, title: "Receipt reminder", message: "Two of your team's expenses still need a receipt attached before reimbursement.", read: false },
    { userId: ownerId, title: "Month-end close", message: "Reimbursed totals for this period have been exported to the finance report.", read: true },
  ]

  notices.forEach((notice, i) => {
    notifications.push({
      userId: notice.userId,
      expenseId: null,
      type: "INFO",
      title: notice.title,
      message: notice.message,
      read: notice.read,
      idempotencyKey: `INFO:demo-notice-${i}:${notice.userId}`,
      createdAt: hoursAgo(72 - i * 14),
    })
  })

  if (notifications.length > 0) await prisma.notification.createMany({ data: notifications })

  const chatRows = CHAT_MESSAGES.map((c) => ({
    companyId,
    senderId: idOf(c.from),
    receiverId: idOf(c.to),
    message: c.message,
    read: c.read,
    createdAt: hoursAgo(c.hoursAgo),
  }))

  await prisma.chatMessage.createMany({ data: chatRows })

  const ocrRows = OCR_SAMPLES.map((sample) => {
    const userId = idOf(sample.employee)
    // Match on the receipt total, otherwise the first expense of that employee wins.
    const expense = expenses.find(
      (e) => e.employeeId === userId && Number(e.submittedAmount) === sample.amount
    )
    return {
      companyId,
      userId,
      expenseId: expense?.id ?? null,
      status: "COMPLETE",
      rawText: sample.rawText,
      result: {
        description: sample.merchant,
        amount: sample.amount,
        currency: sample.currency,
        date: sample.date,
        category: sample.category,
        merchant: sample.merchant,
      },
      parserVersion: "ocr-v2",
      createdAt: hoursAgo(52),
      completedAt: hoursAgo(52),
    }
  })

  await prisma.ocrExtraction.createMany({ data: ocrRows })

  let receiptIndex = 0
  const receiptRows = EXPENSES.map((spec, i) => {
    if (spec.state === "draft") return null
    const expense = expenses[i]!
    const file = receiptFiles.get(receiptIndex)
    receiptIndex++
    if (!file) return null
    return {
      expenseId: expense.id,
      url: `/api/expenses/${expense.id}/receipt/file`,
      storageKey: file.storageKey,
      filename: `${spec.description.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40)}-receipt.png`,
      mimeType: "image/png",
      size: file.size,
      createdAt: expense.createdAt,
    }
  }).filter((r): r is NonNullable<typeof r> => r !== null)

  if (receiptRows.length > 0) await prisma.receipt.createMany({ data: receiptRows })

  return {
    demoUsers: [
      { name: ownerName, email: ownerEmail, role: "ADMIN" as Role, title: "Workspace Owner" },
      ...MANAGERS.map((m) => ({ name: m.name, email: emailFor(m.key), role: m.role, title: m.title })),
      ...EMPLOYEES.map((e) => ({ name: e.name, email: emailFor(e.key), role: e.role, title: e.title })),
    ],
    counts: {
      users: users.length,
      expenses: expenses.length,
      approvalActions: actionRows.length,
      notifications: notifications.length,
      chatMessages: chatRows.length,
      ocrExtractions: ocrRows.length,
      receipts: receiptRows.length,
    },
  }
}
