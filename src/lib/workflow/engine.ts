import { prisma } from "@/lib/prisma"
import { ActionStatus, StepType, ExpenseStatus, Role } from "@prisma/client"

export interface WorkflowStep {
  id: string
  stepOrder: number
  name: string
  approverIds: string[]
  type: StepType
  minApprovalPercent: number
  specificApproverId: string | null
  approverRole: Role | null
  autoComplete: boolean
  minAmount?: number | null
  maxAmount?: number | null
}

export interface ApprovalActionInput {
  expenseId: string
  stepId: string
  approverId: string
  stepOrder: number
}

export interface StepEvaluationResult {
  stepComplete: boolean
  approved: boolean
  rejected: boolean
  approvalPercent: number
  approvedCount: number
  rejectedCount: number
  pendingCount: number
  skippedCount: number
  totalRequired: number
  specificApproverApproved: boolean
  shouldMoveToNext: boolean
  shouldTerminate: boolean
}

type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR"

interface LogEntry {
  level: LogLevel
  message: string
  timestamp: Date
  data?: Record<string, unknown>
}

class WorkflowLogger {
  private logs: LogEntry[] = []
  private enabled: boolean

  constructor(enabled = process.env.NODE_ENV !== "production") {
    this.enabled = enabled
  }

  log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    if (!this.enabled && level === "DEBUG") return
    
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date(),
      data,
    }
    this.logs.push(entry)
    
    const prefix = `[${level}]`
    const logFn = level === "ERROR" ? console.error : level === "WARN" ? console.warn : console.log
    logFn(prefix, message, data ? JSON.stringify(data) : "")
  }

  debug(message: string, data?: Record<string, unknown>): void {
    this.log("DEBUG", message, data)
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.log("INFO", message, data)
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.log("WARN", message, data)
  }

  error(message: string, data?: Record<string, unknown>): void {
    this.log("ERROR", message, data)
  }

  getLogs(): LogEntry[] {
    return [...this.logs]
  }

  clear(): void {
    this.logs = []
  }
}

const logger = new WorkflowLogger()

function convertToWorkflowStep(step: {
  id: string
  stepOrder: number
  name: string
  approverIds: string[]
  type: StepType
  minApprovalPercent: number
  specificApproverId: string | null
  approverRole: Role | null
  autoComplete: boolean
  minAmount?: { toNumber(): number } | null
  maxAmount?: { toNumber(): number } | null
}): WorkflowStep {
  return {
    id: step.id,
    stepOrder: step.stepOrder,
    name: step.name,
    approverIds: step.approverIds,
    type: step.type,
    minApprovalPercent: step.minApprovalPercent,
    specificApproverId: step.specificApproverId,
    approverRole: step.approverRole,
    autoComplete: step.autoComplete,
    minAmount: step.minAmount ? step.minAmount.toNumber() : undefined,
    maxAmount: step.maxAmount ? step.maxAmount.toNumber() : undefined,
  }
}

const VALID_STATE_TRANSITIONS: Record<ExpenseStatus, ExpenseStatus[]> = {
  [ExpenseStatus.DRAFT]: [ExpenseStatus.PENDING],
  [ExpenseStatus.PENDING]: [ExpenseStatus.APPROVED, ExpenseStatus.REJECTED],
  [ExpenseStatus.APPROVED]: [],
  [ExpenseStatus.REJECTED]: [ExpenseStatus.DRAFT],
}

export function isValidTransition(from: ExpenseStatus, to: ExpenseStatus): boolean {
  return VALID_STATE_TRANSITIONS[from]?.includes(to) ?? false
}

export class WorkflowEngine {
  private expenseId: string
  private companyId: string

  constructor(expenseId: string, companyId: string) {
    this.expenseId = expenseId
    this.companyId = companyId
  }

  private async validateExpenseForSubmission(): Promise<{
    valid: boolean
    error?: string
    expense?: Awaited<ReturnType<typeof prisma.expense.findUnique>>
  }> {
    const expense = await prisma.expense.findUnique({
      where: { id: this.expenseId },
      include: {
        employee: {
          include: {
            manager: true,
          },
        },
      },
    })

    if (!expense) {
      logger.error("Expense not found for validation", { expenseId: this.expenseId })
      return { valid: false, error: "Expense not found" }
    }

    if (expense.status !== ExpenseStatus.DRAFT) {
      logger.warn("Expense not in DRAFT status", {
        expenseId: this.expenseId,
        currentStatus: expense.status,
      })
      return {
        valid: false,
        error: `Expense is not in DRAFT status. Current status: ${expense.status}`,
      }
    }

    logger.info("Validating expense for submission", {
      expenseId: this.expenseId,
      employeeId: expense.employeeId,
      employeeName: expense.employee.name,
      amount: expense.convertedAmount,
    })

    const workflow = await prisma.approvalWorkflow.findFirst({
      where: {
        companyId: this.companyId,
        isActive: true,
      },
      include: {
        steps: {
          orderBy: { stepOrder: "asc" },
        },
      },
    })

    if (workflow && workflow.steps.length > 0) {
      logger.info("Found active workflow", {
        workflowId: workflow.id,
        workflowName: workflow.name,
        stepCount: workflow.steps.length,
      })

      const firstStep = convertToWorkflowStep(workflow.steps[0])
      const hasApprovers = await this.resolveApproversForStep(firstStep, expense)

      if (hasApprovers.length === 0) {
        logger.error("No approvers found for first workflow step", {
          expenseId: this.expenseId,
          stepName: firstStep.name,
        })
        return {
          valid: false,
          error: `No approvers found for workflow step "${firstStep.name}". Please configure approvers in the workflow settings.`,
        }
      }

      return { valid: true, expense }
    }

    logger.info("No active workflow found, checking for ApprovalRules", {
      expenseId: this.expenseId,
      companyId: this.companyId,
    })

    const rule = await prisma.approvalRule.findFirst({
      where: {
        companyId: this.companyId,
        OR: [
          { assignedUserId: expense.employeeId },
          { assignedUserId: null },
        ],
      },
      orderBy: [
        { assignedUserId: "desc" },
        { createdAt: "desc" },
      ],
    })

    if (rule) {
      logger.info("Found applicable ApprovalRule", {
        expenseId: this.expenseId,
        ruleId: rule.id,
        ruleName: rule.name,
        isManagerApprover: rule.isManagerApprover,
      })
      return { valid: true, expense }
    }

    logger.error("No workflow or approval rules configured", {
      expenseId: this.expenseId,
      companyId: this.companyId,
    })
    return {
      valid: false,
      error: "No approval workflow or rules configured. Please set up an approval workflow or create approval rules.",
    }
  }

  private async resolveApproversForStep(
    step: WorkflowStep,
    expense: {
      id: string
      employeeId: string
      companyId: string
    }
  ): Promise<string[]> {
    const approverIds: string[] = []

    logger.debug("Resolving approvers for step", {
      expenseId: expense.id,
      stepName: step.name,
      stepApproverRole: step.approverRole,
      hasApproverIds: step.approverIds?.length > 0,
      hasSpecificApprover: !!step.specificApproverId,
    })

    if (step.approverIds && step.approverIds.length > 0) {
      const validApprovers = await prisma.user.findMany({
        where: {
          id: { in: step.approverIds },
          companyId: expense.companyId,
        },
        select: { id: true },
      })
      approverIds.push(...validApprovers.map(u => u.id))
      logger.debug("Added approvers from step.approverIds", { count: validApprovers.length })
    }

    if (step.specificApproverId) {
      const specificApprover = await prisma.user.findUnique({
        where: { id: step.specificApproverId },
      })
      if (specificApprover && specificApprover.companyId === expense.companyId) {
        approverIds.push(step.specificApproverId)
        logger.debug("Added specific approver", { approverId: step.specificApproverId })
      }
    }

    if (step.approverRole) {
      if (step.approverRole === Role.MANAGER) {
        const employee = await prisma.user.findUnique({
          where: { id: expense.employeeId },
          select: { id: true, managerId: true, name: true },
        })

        if (employee?.managerId) {
          approverIds.push(employee.managerId)
          logger.info("Assigned employee's manager as approver", {
            expenseId: expense.id,
            employeeId: expense.employeeId,
            managerId: employee.managerId,
          })
        } else {
          logger.warn("Employee has no manager assigned", {
            expenseId: expense.id,
            employeeId: expense.employeeId,
            employeeName: employee?.name,
          })
          throw new Error(
            `Cannot assign manager as approver: employee "${employee?.name || expense.employeeId}" has no manager. ` +
            `Please assign a manager to the employee or configure approvers in the workflow step.`
          )
        }
      } else {
        const users = await prisma.user.findMany({
          where: {
            companyId: expense.companyId,
            role: step.approverRole as Role,
          },
          select: { id: true },
        })
        approverIds.push(...users.map(u => u.id))
        logger.debug("Added approvers by role", {
          role: step.approverRole,
          count: users.length,
        })
      }
    }

    if (approverIds.length === 0) {
      const employee = await prisma.user.findUnique({
        where: { id: expense.employeeId },
        include: { manager: true },
      })

      if (employee?.managerId) {
        approverIds.push(employee.managerId)
        logger.info("Using employee manager as fallback approver", {
          expenseId: expense.id,
          employeeId: expense.employeeId,
          managerId: employee.managerId,
        })
      } else {
        logger.error("No approvers found and no fallback manager", {
          expenseId: expense.id,
          employeeId: expense.employeeId,
        })
        throw new Error(
          `No approvers configured for workflow step "${step.name}" and employee has no manager. ` +
          `Please configure approvers in the workflow or assign a manager to the employee.`
        )
      }
    }

    const uniqueApproverIds = Array.from(new Set(approverIds))
    logger.info("Resolved approvers", {
      expenseId: expense.id,
      approvers: uniqueApproverIds,
      count: uniqueApproverIds.length,
    })

    return uniqueApproverIds
  }

  private async selectWorkflowSteps(
    workflowSteps: WorkflowStep[],
    expenseAmountRaw: number | string | { toNumber(): number }
  ): Promise<WorkflowStep[]> {
    const numericAmount = typeof expenseAmountRaw === 'object' && 'toNumber' in expenseAmountRaw 
      ? expenseAmountRaw.toNumber() 
      : Number(expenseAmountRaw)
    const applicableSteps: WorkflowStep[] = []

    for (const step of workflowSteps) {
      const hasMinAmount = step.minAmount !== undefined && step.minAmount !== null
      const hasMaxAmount = step.maxAmount !== undefined && step.maxAmount !== null
      
      let isApplicable = true
      
      if (hasMinAmount && numericAmount < step.minAmount!) {
        isApplicable = false
      }
      if (hasMaxAmount && numericAmount > step.maxAmount!) {
        isApplicable = false
      }

      if (isApplicable) {
        applicableSteps.push(step)
      }
    }

    return applicableSteps
  }

  async createApprovalWorkflow(): Promise<{
    success: boolean
    error?: string
    workflowId?: string
    notifications?: Array<{ approverId: string; expenseId: string }>
  }> {
    logger.info("Creating approval workflow", { 
      expenseId: this.expenseId, 
      companyId: this.companyId 
    })

    try {
      const validation = await this.validateExpenseForSubmission()
      
      if (!validation.valid) {
        logger.error("Expense validation failed", { 
          expenseId: this.expenseId, 
          error: validation.error 
        })
        return { success: false, error: validation.error }
      }

      const expense = validation.expense!

      const workflow = await prisma.approvalWorkflow.findFirst({
        where: {
          companyId: this.companyId,
          isActive: true,
        },
        include: {
          steps: {
            orderBy: { stepOrder: "asc" },
          },
        },
      })

      // ── No ApprovalWorkflow configured — try ApprovalRule fallback ──
      if (!workflow || workflow.steps.length === 0) {
        const { ruleId, approverIds: ruleApprovers } = await this.resolveApprovalRuleApprovers(expense)

        if (ruleApprovers.length > 0) {
          logger.info("No workflow found, using ApprovalRule approvers", {
            expenseId: this.expenseId,
            ruleId,
            approvers: ruleApprovers,
          })

          await prisma.$transaction(
            ruleApprovers.map((approverId) =>
              prisma.approvalAction.create({
                data: {
                  expenseId: this.expenseId,
                  stepId: null,
                  approverId,
                  stepOrder: 1,
                  action: ActionStatus.PENDING,
                  ruleId: ruleId || undefined,
                },
              })
            )
          )

          await prisma.expense.update({
            where: { id: this.expenseId },
            data: { status: ExpenseStatus.PENDING, currentWorkflowStep: 1 },
          })

          logger.info("ApprovalRule workflow created successfully", {
            expenseId: this.expenseId,
            ruleId,
            approverCount: ruleApprovers.length,
          })

          return {
            success: true,
            workflowId: undefined,
            notifications: ruleApprovers.map((id) => ({ approverId: id, expenseId: this.expenseId })),
          }
        }

        // No rule either — auto-approve
        await prisma.expense.update({
          where: { id: this.expenseId },
          data: { status: ExpenseStatus.APPROVED, currentWorkflowStep: -1 },
        })
        logger.info("No workflow or rule configured, auto-approved", { expenseId: this.expenseId })
        return { success: true, workflowId: undefined }
      }

      const expenseAmount = Number(expense.convertedAmount)
      const applicableSteps = await this.selectWorkflowSteps(
        workflow.steps.map(convertToWorkflowStep),
        expenseAmount
      )

      if (applicableSteps.length === 0) {
        await prisma.expense.update({
          where: { id: this.expenseId },
          data: {
            status: ExpenseStatus.APPROVED,
            currentWorkflowStep: -1,
          },
        })
        
        logger.info("No applicable workflow steps for amount, auto-approved", { 
          expenseId: this.expenseId,
          amount: expenseAmount 
        })
        return { success: true, workflowId: workflow.id }
      }

      const firstStep = applicableSteps[0]
      const createdActions = await this.createApprovalActionsForStep(firstStep, expense)

      if (createdActions.length === 0) {
        const errorMsg = `No approvers resolved for workflow step "${firstStep.name}"`
        logger.error(errorMsg, { 
          expenseId: this.expenseId, 
          stepName: firstStep.name 
        })
        return { success: false, error: errorMsg }
      }

      await prisma.expense.update({
        where: { id: this.expenseId },
        data: {
          status: ExpenseStatus.PENDING,
          currentWorkflowStep: firstStep.stepOrder,
        },
      })

      logger.info("Approval workflow created successfully", { 
        expenseId: this.expenseId,
        workflowId: workflow.id,
        firstStep: firstStep.name,
        approvers: createdActions.length
      })

      return { 
        success: true, 
        workflowId: workflow.id,
        notifications: createdActions.map(a => ({ 
          approverId: a.approverId, 
          expenseId: this.expenseId 
        }))
      }
    } catch (error) {
      logger.error("Error creating approval workflow", { 
        expenseId: this.expenseId, 
        error: error instanceof Error ? error.message : "Unknown error" 
      })
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  /**
   * Resolve approvers from ApprovalRule records that match the expense employee.
   * Priority: rule assigned to the specific employee > rule with no assigned user (company-wide).
   * Respects isManagerApprover, approversSequence, and minApprovalPercentage.
   */
  private async resolveApprovalRuleApprovers(expense: {
    id: string
    employeeId: string
    companyId: string
  }): Promise<{ ruleId: string | null; approverIds: string[] }> {
    const employee = await prisma.user.findUnique({
      where: { id: expense.employeeId },
      select: { id: true, name: true, managerId: true },
    })

    if (!employee) {
      logger.error("Employee not found for rule resolution", {
        expenseId: expense.id,
        employeeId: expense.employeeId,
      })
      return { ruleId: null, approverIds: [] }
    }

    const rule = await prisma.approvalRule.findFirst({
      where: {
        companyId: expense.companyId,
        OR: [
          { assignedUserId: expense.employeeId },
          { assignedUserId: null },
        ],
      },
      include: {
        approvers: {
          include: { user: { select: { id: true } } },
          orderBy: { stepOrder: "asc" },
        },
        manager: { select: { id: true } },
      },
      orderBy: [
        { assignedUserId: "desc" },
        { createdAt: "desc" },
      ],
    })

    if (!rule) {
      logger.info("No ApprovalRule found for expense", {
        expenseId: expense.id,
        employeeId: expense.employeeId,
        companyId: expense.companyId,
      })
      return { ruleId: null, approverIds: [] }
    }

    logger.info("Found ApprovalRule for expense", {
      expenseId: expense.id,
      ruleId: rule.id,
      ruleName: rule.name,
      isManagerApprover: rule.isManagerApprover,
      explicitApproverCount: rule.approvers.length,
    })

    const approverIds: string[] = []

    if (rule.isManagerApprover) {
      const managerId = rule.managerId ?? employee.managerId

      if (managerId) {
        approverIds.push(managerId)
        logger.info("Added manager as approver from rule", {
          expenseId: expense.id,
          ruleId: rule.id,
          managerId,
          source: rule.managerId ? "rule.managerId" : "employee.managerId",
        })
      } else {
        logger.error("Rule requires manager approval but no manager available", {
          expenseId: expense.id,
          ruleId: rule.id,
          ruleName: rule.name,
          employeeId: employee.id,
          employeeName: employee.name,
        })
        throw new Error(
          `Approval rule "${rule.name}" requires manager approval, but employee "${employee.name}" has no manager assigned. ` +
          `Please assign a manager to the employee or modify the approval rule.`
        )
      }
    }

    for (const ra of rule.approvers) {
      if (!approverIds.includes(ra.user.id)) {
        approverIds.push(ra.user.id)
        logger.debug("Added explicit approver from rule", {
          expenseId: expense.id,
          ruleId: rule.id,
          approverId: ra.user.id,
          stepOrder: ra.stepOrder,
        })
      }
    }

    if (approverIds.length === 0) {
      if (employee.managerId) {
        approverIds.push(employee.managerId)
        logger.info("No explicit approvers in rule, using employee's manager as fallback", {
          expenseId: expense.id,
          ruleId: rule.id,
          managerId: employee.managerId,
        })
      } else {
        logger.error("No approvers in rule and employee has no manager", {
          expenseId: expense.id,
          ruleId: rule.id,
          ruleName: rule.name,
          employeeId: employee.id,
          employeeName: employee.name,
        })
        throw new Error(
          `No approvers configured in approval rule "${rule.name}" and employee has no manager. ` +
          `Please add approvers to the rule or assign a manager to the employee.`
        )
      }
    }

    const uniqueApproverIds = Array.from(new Set(approverIds))
    logger.info("Resolved rule approvers", {
      expenseId: expense.id,
      ruleId: rule.id,
      approvers: uniqueApproverIds,
      count: uniqueApproverIds.length,
    })

    return { ruleId: rule.id, approverIds: uniqueApproverIds }
  }

  private async createApprovalActionsForStep(
    step: WorkflowStep,
    expense: {
      id: string
      employeeId: string
      companyId: string
    }
  ): Promise<ApprovalActionInput[]> {
    const approverIds = await this.resolveApproversForStep(step, expense)

    const actions: ApprovalActionInput[] = []
    const uniqueApproverIds = Array.from(new Set(approverIds))

    await prisma.$transaction(
      uniqueApproverIds.map((approverId) =>
        prisma.approvalAction.create({
          data: {
            expenseId: this.expenseId,
            stepId: step.id,
            approverId,
            stepOrder: step.stepOrder,
            action: ActionStatus.PENDING,
          },
        })
      )
    )

    for (const approverId of uniqueApproverIds) {
      actions.push({
        expenseId: this.expenseId,
        stepId: step.id,
        approverId,
        stepOrder: step.stepOrder,
      })
    }

    logger.debug("Created approval actions", { 
      expenseId: this.expenseId,
      stepId: step.id,
      count: actions.length 
    })

    return actions
  }

  async handleApprovalAction(
    approverId: string,
    action: "APPROVED" | "REJECTED",
    comment?: string
  ): Promise<{
    success: boolean
    error?: string
    stepComplete?: boolean
    expenseComplete?: boolean
    newStatus?: ExpenseStatus
  }> {
    logger.info("Processing approval action", { 
      expenseId: this.expenseId,
      approverId,
      action 
    })

    const expense = await prisma.expense.findUnique({
      where: { id: this.expenseId },
    })

    if (!expense) {
      return { success: false, error: "Expense not found" }
    }

    if (expense.status !== ExpenseStatus.PENDING) {
      return { 
        success: false, 
        error: `Expense is not pending approval. Current status: ${expense.status}` 
      }
    }

    const approvalAction = await prisma.approvalAction.findFirst({
      where: {
        expenseId: this.expenseId,
        approverId,
        action: ActionStatus.PENDING,
      },
      include: {
        step: true,
      },
    })

    if (!approvalAction) {
      const existingAction = await prisma.approvalAction.findFirst({
        where: {
          expenseId: this.expenseId,
          approverId,
        },
        orderBy: { createdAt: "desc" },
      })
      
      if (existingAction && existingAction.action !== ActionStatus.PENDING) {
        return {
          success: true,
          stepComplete: false,
          expenseComplete: false,
          error: "Action already processed",
        }
      }
      
      return { success: false, error: "No pending approval action found for this approver" }
    }

    await prisma.$transaction(async (tx) => {
      await tx.approvalAction.update({
        where: { id: approvalAction.id },
        data: {
          action: action === "APPROVED" ? ActionStatus.APPROVED : ActionStatus.REJECTED,
          comment,
          actedAt: new Date(),
        },
      })
    })

    logger.info("Approval action recorded", { 
      expenseId: this.expenseId,
      approverId,
      action,
      stepOrder: approvalAction.stepOrder
    })

    const stepResult = await this.evaluateStep(approvalAction.stepOrder)

    if (stepResult.shouldTerminate) {
      await prisma.expense.update({
        where: { id: this.expenseId },
        data: { status: ExpenseStatus.REJECTED },
      })
      
      logger.info("Expense rejected", { 
        expenseId: this.expenseId,
        stepOrder: approvalAction.stepOrder 
      })
      
      return {
        success: true,
        stepComplete: true,
        expenseComplete: true,
        newStatus: ExpenseStatus.REJECTED,
      }
    }

    if (stepResult.shouldMoveToNext) {
      const nextStepResult = await this.moveToNextStep()
      
      if (!nextStepResult.success) {
        logger.error("Failed to move to next step", { 
          expenseId: this.expenseId,
          error: nextStepResult.error 
        })
        return { success: false, error: nextStepResult.error || "Failed moving to next step" }
      }

      if (nextStepResult.expenseApproved) {
        logger.info("Expense fully approved", { expenseId: this.expenseId })
        return {
          success: true,
          stepComplete: true,
          expenseComplete: true,
          newStatus: ExpenseStatus.APPROVED,
        }
      }
      
      logger.info("Moved to next approval step", { 
        expenseId: this.expenseId,
        nextStep: nextStepResult.nextStepIndex 
      })
      
      return {
        success: true,
        stepComplete: true,
        expenseComplete: false,
        newStatus: ExpenseStatus.PENDING,
      }
    }

    return {
      success: true,
      stepComplete: false,
      expenseComplete: false,
      newStatus: ExpenseStatus.PENDING,
    }
  }

  async evaluateStep(stepOrder: number): Promise<StepEvaluationResult> {
    const stepActions = await prisma.approvalAction.findMany({
      where: {
        expenseId: this.expenseId,
        stepOrder,
      },
      include: {
        step: {
          include: {
            specificApprover: {
              select: { id: true }
            }
          }
        },
      },
    })

    if (stepActions.length === 0) {
      return {
        stepComplete: false,
        approved: false,
        rejected: false,
        approvalPercent: 0,
        approvedCount: 0,
        rejectedCount: 0,
        pendingCount: 0,
        skippedCount: 0,
        totalRequired: 0,
        specificApproverApproved: false,
        shouldMoveToNext: false,
        shouldTerminate: false,
      }
    }

    const step = stepActions[0].step
    const total = stepActions.length
    const approvedCount = stepActions.filter(
      (a) => a.action === ActionStatus.APPROVED
    ).length
    const rejectedCount = stepActions.filter(
      (a) => a.action === ActionStatus.REJECTED
    ).length
    const skippedCount = stepActions.filter(
      (a) => a.action === ActionStatus.SKIPPED
    ).length
    const pendingCount = stepActions.filter(
      (a) => a.action === ActionStatus.PENDING
    ).length

    const activeCount = total - skippedCount
    const approvalPercent = activeCount > 0 ? (approvedCount / activeCount) * 100 : 0

    const specificApproverApproved =
      step?.specificApproverId &&
      stepActions.some(
        (a) =>
          a.approverId === step.specificApproverId &&
          a.action === ActionStatus.APPROVED
      )

    let shouldMoveToNext = false
    let shouldTerminate = false
    let stepComplete = false

    if (step?.type === StepType.ANY_ONE) {
      stepComplete = approvedCount >= 1 || rejectedCount >= 1
      shouldTerminate = rejectedCount >= 1
      shouldMoveToNext = approvedCount >= 1 && !shouldTerminate
    } else {
      const thresholdMet =
        approvalPercent >= (step?.minApprovalPercent || 100) ||
        specificApproverApproved === true

      stepComplete = pendingCount === 0
      shouldTerminate = rejectedCount > 0
      shouldMoveToNext = thresholdMet && !shouldTerminate
    }

    logger.debug("Step evaluation result", {
      expenseId: this.expenseId,
      stepOrder,
      approvedCount,
      rejectedCount,
      pendingCount,
      approvalPercent,
      stepComplete,
      shouldMoveToNext,
      shouldTerminate
    })

    return {
      stepComplete,
      approved: approvedCount > 0,
      rejected: rejectedCount > 0,
      approvalPercent,
      approvedCount,
      rejectedCount,
      pendingCount,
      skippedCount,
      totalRequired: total,
      specificApproverApproved: specificApproverApproved || false,
      shouldMoveToNext,
      shouldTerminate,
    }
  }

  async moveToNextStep(): Promise<{
    success: boolean
    error?: string
    nextStepIndex?: number
    expenseApproved?: boolean
    notifications?: Array<{ approverId: string; expenseId: string }>
  }> {
    try {
      const expense = await prisma.expense.findUnique({
        where: { id: this.expenseId },
      })

      if (!expense) {
        return { success: false, error: "Expense not found" }
      }

      const currentStep = expense.currentWorkflowStep

      await prisma.approvalAction.updateMany({
        where: {
          expenseId: this.expenseId,
          stepOrder: currentStep,
          action: ActionStatus.PENDING,
        },
        data: {
          action: ActionStatus.SKIPPED,
          actedAt: new Date(),
        },
      })

      const workflow = await prisma.approvalWorkflow.findFirst({
        where: {
          companyId: this.companyId,
          isActive: true,
        },
        include: {
          steps: {
            where: {
              stepOrder: { gt: currentStep },
            },
            orderBy: { stepOrder: "asc" },
          },
        },
      })

      // Apply the same amount thresholds used when the workflow was instantiated,
      // otherwise a step with minAmount/maxAmount that does not apply to this
      // expense would still be activated on advance.
      const applicableSteps = workflow
        ? await this.selectWorkflowSteps(
            workflow.steps.map(convertToWorkflowStep),
            Number(expense.convertedAmount)
          )
        : []

      if (!workflow || applicableSteps.length === 0) {
        await prisma.expense.update({
          where: { id: this.expenseId },
          data: {
            status: ExpenseStatus.APPROVED,
            currentWorkflowStep: -1,
          },
        })
        
        logger.info("All approval steps completed, expense approved", { 
          expenseId: this.expenseId 
        })
        
        return { success: true, nextStepIndex: -1, expenseApproved: true }
      }

      const nextStep = applicableSteps[0]!

      const createdActions = await this.createApprovalActionsForStep(nextStep, {
        id: expense.id,
        employeeId: expense.employeeId,
        companyId: expense.companyId,
      })

      if (createdActions.length === 0) {
        await prisma.expense.update({
          where: { id: this.expenseId },
          data: {
            status: ExpenseStatus.APPROVED,
            currentWorkflowStep: -1,
          },
        })
        
        logger.warn("No approvers for next step, auto-approved", { 
          expenseId: this.expenseId,
          nextStep: nextStep.name 
        })
        
        return { success: true, nextStepIndex: -1, expenseApproved: true }
      }

      await prisma.expense.update({
        where: { id: this.expenseId },
        data: {
          currentWorkflowStep: nextStep.stepOrder,
        },
      })

      logger.info("Moved to next approval step", { 
        expenseId: this.expenseId,
        nextStep: nextStep.name,
        approvers: createdActions.length 
      })

      return {
        success: true,
        nextStepIndex: nextStep.stepOrder,
        expenseApproved: false,
        notifications: createdActions.map(a => ({ 
          approverId: a.approverId, 
          expenseId: this.expenseId 
        }))
      }
    } catch (error) {
      logger.error("Error moving to next step", { 
        expenseId: this.expenseId,
        error: error instanceof Error ? error.message : "Unknown error" 
      })
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  async getWorkflowStatus(): Promise<{
    currentStep: number
    totalSteps: number
    steps: Array<{
      order: number
      name: string
      status: string
      actions: Array<{
        approverId: string
        approverName: string
        action: string
        comment?: string
        actedAt?: Date
      }>
    }>
  }> {
    const expense = await prisma.expense.findUnique({
      where: { id: this.expenseId },
    })

    if (!expense) {
      throw new Error("Expense not found")
    }

    const workflow = await prisma.approvalWorkflow.findFirst({
      where: {
        companyId: this.companyId,
        isActive: true,
      },
      include: {
        steps: {
          orderBy: { stepOrder: "asc" },
        },
      },
    })

    const actions = await prisma.approvalAction.findMany({
      where: { expenseId: this.expenseId },
      include: {
        approver: { select: { id: true, name: true } },
        step: { select: { name: true } },
      },
      orderBy: { stepOrder: "asc" },
    })

    const stepGroups = new Map<number, typeof actions>()
    for (const action of actions) {
      const existing = stepGroups.get(action.stepOrder) || []
      existing.push(action)
      stepGroups.set(action.stepOrder, existing)
    }

    const steps = Array.from(stepGroups.entries()).map(([order, stepActions]) => ({
      order,
      name: stepActions[0]?.step?.name || `Step ${order}`,
      status:
        order === expense.currentWorkflowStep
          ? "ACTIVE"
          : order < expense.currentWorkflowStep
          ? "COMPLETED"
          : "PENDING",
      actions: stepActions.map((a) => ({
        approverId: a.approver.id,
        approverName: a.approver.name,
        action: a.action,
        comment: a.comment || undefined,
        actedAt: a.actedAt || undefined,
      })),
    }))

    return {
      currentStep: expense.currentWorkflowStep,
      totalSteps: workflow?.steps.length || 0,
      steps,
    }
  }

  async skipStepForUser(userId: string): Promise<{
    success: boolean
    error?: string
  }> {
    try {
      const action = await prisma.approvalAction.findFirst({
        where: {
          expenseId: this.expenseId,
          approverId: userId,
          action: ActionStatus.PENDING,
        },
      })

      if (!action) {
        return { success: false, error: "No pending action found for user" }
      }

      await prisma.approvalAction.update({
        where: { id: action.id },
        data: {
          action: ActionStatus.SKIPPED,
          actedAt: new Date(),
        },
      })

      const stepResult = await this.evaluateStep(action.stepOrder)

      if (stepResult.stepComplete && !stepResult.shouldTerminate) {
        await this.moveToNextStep()
      }

      return { success: true }
    } catch (error) {
      logger.error("Error skipping step", { 
        expenseId: this.expenseId,
        userId,
        error: error instanceof Error ? error.message : "Unknown error" 
      })
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  async resubmitExpense(): Promise<{
    success: boolean
    error?: string
  }> {
    const expense = await prisma.expense.findUnique({
      where: { id: this.expenseId },
    })

    if (!expense) {
      return { success: false, error: "Expense not found" }
    }

    if (expense.status !== ExpenseStatus.REJECTED) {
      return { 
        success: false, 
        error: `Can only resubmit rejected expenses. Current status: ${expense.status}` 
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.approvalAction.deleteMany({
        where: { expenseId: this.expenseId },
      })

      await tx.expense.update({
        where: { id: this.expenseId },
        data: {
          status: ExpenseStatus.DRAFT,
          currentWorkflowStep: 0,
          isAdminOverride: false,
          adminOverrideById: null,
          adminOverrideAt: null,
          adminOverrideComment: null,
        },
      })
    })

    logger.info("Expense resubmitted for approval", { 
      expenseId: this.expenseId 
    })

    return { success: true }
  }

  async forceApprove(): Promise<{
    success: boolean
    error?: string
  }> {
    const expense = await prisma.expense.findUnique({
      where: { id: this.expenseId },
    })

    if (!expense) {
      return { success: false, error: "Expense not found" }
    }

    await prisma.$transaction(async (tx) => {
      await tx.approvalAction.updateMany({
        where: { expenseId: this.expenseId, action: ActionStatus.PENDING },
        data: {
          action: ActionStatus.SKIPPED,
          comment: "Skipped due to admin override",
          actedAt: new Date(),
        },
      })

      await tx.expense.update({
        where: { id: this.expenseId },
        data: {
          status: ExpenseStatus.APPROVED,
          currentWorkflowStep: -1,
        },
      })
    })

    logger.info("Expense force approved", { expenseId: this.expenseId })

    return { success: true }
  }

  async forceReject(comment?: string): Promise<{
    success: boolean
    error?: string
  }> {
    const expense = await prisma.expense.findUnique({
      where: { id: this.expenseId },
    })

    if (!expense) {
      return { success: false, error: "Expense not found" }
    }

    await prisma.$transaction(async (tx) => {
      await tx.approvalAction.updateMany({
        where: { expenseId: this.expenseId, action: ActionStatus.PENDING },
        data: {
          action: ActionStatus.REJECTED,
          comment: comment || "Rejected due to admin override",
          actedAt: new Date(),
        },
      })

      await tx.expense.update({
        where: { id: this.expenseId },
        data: {
          status: ExpenseStatus.REJECTED,
          currentWorkflowStep: -1,
        },
      })
    })

    logger.info("Expense force rejected", { expenseId: this.expenseId })

    return { success: true }
  }
}

export async function createWorkflowEngine(
  expenseId: string,
  companyId: string
): Promise<WorkflowEngine> {
  return new WorkflowEngine(expenseId, companyId)
}

export async function getWorkflowForExpense(
  expenseId: string,
  companyId: string
): Promise<WorkflowEngine> {
  return new WorkflowEngine(expenseId, companyId)
}

export { logger }
