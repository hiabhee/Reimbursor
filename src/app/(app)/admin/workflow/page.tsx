'use client'

import { useEffect, useState } from 'react'
import { StepBuilder, WorkflowStep, User } from '@/components/workflow-builder'
import { PageIntro, PageShell } from '@/components/ui/page-shell'

export default function WorkflowBuilderPage() {
  const [steps, setSteps] = useState<WorkflowStep[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchWorkflow() {
      try {
        const response = await fetch('/api/workflow')
        if (response.ok) {
          const data = await response.json()
          if (data.steps && data.steps.length > 0) {
            setSteps(data.steps.map((s: WorkflowStep) => ({
              ...s,
              id: s.id || `step_${s.stepOrder}`,
            })))
          }
        }

        const usersResponse = await fetch('/api/users')
        if (usersResponse.ok) {
          const usersData = await usersResponse.json()
          setUsers(
            (Array.isArray(usersData) ? usersData : []).filter(
              (u) => u.role === 'MANAGER' || u.role === 'ADMIN'
            )
          )
        }
      } catch (error) {
        console.error('Failed to fetch workflow:', error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchWorkflow()
  }, [])

  const handleSave = async (workflowSteps: WorkflowStep[]) => {
    const response = await fetch('/api/workflow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workflowName: 'Expense Approval Workflow',
        steps: workflowSteps.map((s) => ({
          stepOrder: s.stepOrder,
          approvers: s.approvers,
          ruleType: s.ruleType,
          percent: s.percent,
          specificApproverId: s.specificApproverId,
        })),
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to save workflow')
    }

    alert('Workflow saved successfully!')
  }

  if (isLoading) {
    return (
      <PageShell className="flex items-center justify-center">
        <div className="text-muted-foreground text-sm">Loading workflow...</div>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <div className="max-w-3xl space-y-6">
        <PageIntro
          eyebrow="Administration"
          title="Approval Workflow"
          description="Configure how expense approvals flow through your organization."
        />
        <StepBuilder users={users} onSave={handleSave} initialSteps={steps} />
      </div>
    </PageShell>
  )
}
