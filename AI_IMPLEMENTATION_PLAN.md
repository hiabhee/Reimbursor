# AI Integration Implementation Plan

## 1. Objective

Integrate AI into Reimbursor as an assistant for expense creation, policy validation, approval review, and reporting.

AI should assist users and explain decisions, but it should not autonomously approve or reject expenses. The existing workflow engine remains the source of truth for state transitions.

## 2. Current Project Foundation

The project already has the core building blocks required for an AI integration:

- Receipt OCR at `src/app/api/ocr/route.ts`
- Expense lifecycle: `DRAFT → PENDING → APPROVED/REJECTED`
- Approval workflow engine at `src/lib/workflow/engine.ts`
- Approval rules and multi-step approval workflows
- Notification infrastructure
- Company-level tenant isolation through `companyId`
- Human-to-human chat at `src/app/(app)/chat/page.tsx`
- Prisma/PostgreSQL data model

The current OCR implementation uses Tesseract and keyword matching. AI should improve extraction and reasoning while retaining deterministic validation and workflow enforcement.

## 3. Recommended AI Flow

```text
Receipt upload
     ↓
OCR extraction
     ↓
AI normalization and confidence scoring
     ↓
Deterministic policy validation
     ↓
Employee confirms fields
     ↓
Expense submitted to workflow
     ↓
AI-generated approval summary
     ↓
Human approves or rejects
```

## 4. Phase 1 — AI Receipt Extraction

This should be the first AI feature because it provides immediate value and fits the existing expense creation flow.

### User experience

When an employee uploads a receipt:

1. Tesseract extracts raw text.
2. AI receives the receipt image and/or OCR text.
3. AI returns structured expense fields.
4. The expense form is pre-filled.
5. The employee reviews and edits the values.
6. The expense remains a draft until the employee submits it.

### Example response

```json
{
  "merchant": "Hilton San Francisco",
  "description": "Hotel accommodation",
  "amount": 248.50,
  "currency": "USD",
  "date": "2026-09-20",
  "category": "ACCOMMODATION",
  "confidence": {
    "merchant": 0.96,
    "amount": 0.99,
    "currency": 0.98,
    "date": 0.82,
    "category": 0.91
  },
  "warnings": [
    "Date was partially unclear"
  ]
}
```

### Product rules

AI must never silently save extracted values as final truth.

The UI should distinguish between:

- AI extracted
- Needs confirmation
- Low confidence
- Manually edited

### Suggested files

```text
src/lib/ai/client.ts
src/lib/ai/config.ts
src/lib/ai/schemas.ts
src/lib/ai/prompts/receipt.ts
src/lib/ai/receiptExtractor.ts
src/app/api/ai/expenses/extract/route.ts
```

The server route should:

```text
authenticate user
    ↓
validate file type and size
    ↓
run OCR
    ↓
call AI extraction service
    ↓
validate structured response with Zod
    ↓
return draft fields to the client
```

Use Zod to validate every model response before returning it to the browser or storing it.

The OpenAI Responses API supports structured outputs and function calling, which fit this extraction flow. The API key must remain server-side.

References:

- [OpenAI JavaScript quickstart](https://platform.openai.com/docs/quickstart/make-your-first-api-request)
- [OpenAI Responses API reference](https://platform.openai.com/docs/api-reference/responses)
- [OpenAI streaming and structured response reference](https://platform.openai.com/docs/api-reference/responses-streaming/response/refusal)

## 5. Phase 2 — AI Expense Validation

After extraction, AI can identify issues before submission.

### Validation categories

#### Data quality

- Missing amount
- Invalid date
- Unrecognized currency
- Missing merchant name
- Duplicate receipt
- Low OCR confidence

#### Expense policy

- Amount exceeds the configured meal allowance
- Hotel exceeds the nightly limit
- Expense date is outside approved travel dates
- Personal expense category
- Missing required receipt
- Weekend or holiday expense
- Duplicate merchant and amount

#### Accounting quality

- Category mismatch
- Currency conversion inconsistency
- Submitted amount differs from receipt total
- Tax or tip appears unusual

### Deterministic rules remain authoritative

Hard constraints should be implemented using normal application logic.

```text
Hard rule:
amount > configured_limit
    → definite policy violation

AI signal:
merchant looks like a personal purchase
    → review recommendation
```

AI should generate findings, not make the final decision.

### Example validation response

```json
{
  "status": "REVIEW_REQUIRED",
  "findings": [
    {
      "code": "MEAL_LIMIT_EXCEEDED",
      "severity": "WARNING",
      "message": "This meal is $18 above the configured daily limit.",
      "evidence": "Receipt total: $68.00; policy limit: $50.00",
      "confidence": 0.99
    }
  ]
}
```

### Suggested files and route

```text
src/lib/ai/expenseValidator.ts
src/lib/ai/policyEngine.ts
src/lib/ai/schemas.ts
src/app/api/ai/expenses/[id]/validate/route.ts
```

Suggested flow:

```text
draft saved or submitted
       ↓
run deterministic policy checks
       ↓
run AI anomaly checks
       ↓
persist findings
       ↓
show warnings to employee or manager
```

Uncertain AI findings should warn users, not block submission.

## 6. Phase 3 — Approval Assistant

The Approvals page should display an AI-generated summary for managers.

### Example summary

```text
Sarah submitted a $248.50 hotel expense from Hilton San Francisco.

AI review:
• Receipt amount matches submitted amount.
• Category appears correct.
• Expense is within the configured accommodation limit.
• No likely duplicate was found.
• Date confidence is 82%.

Recommendation: Approve
```

### Non-negotiable rule

The manager must still explicitly choose:

- Approve
- Reject
- Request clarification

The AI must not call the approval mutation directly.

```text
AI may summarize
AI may flag risk
AI may explain policy
AI may not approve
AI may not reject
AI may not bypass workflow rules
```

### Approval UI additions

Add an expandable review section to `ApprovalTable.tsx` containing:

- AI summary
- Policy checks
- Confidence scores
- Evidence used
- Explanation for each warning
- Raw OCR text where appropriate

Suggested route:

```text
POST /api/ai/expenses/[id]/approval-summary
```

## 7. Phase 4 — AI Assistant

The existing chat feature is human-to-human messaging. Keep AI assistant conversations separate from `ChatMessage` unless the data model is intentionally redesigned.

Create a separate assistant endpoint:

```text
POST /api/ai/chat
```

### Initial read-only questions

- How much did I spend on travel this month?
- Which expenses are waiting for my approval?
- Why was this expense rejected?
- What is the meal reimbursement limit?
- Show pending expenses over $500.
- Which employees have the most rejected expenses?

The assistant should use tools instead of receiving the entire database as prompt text.

### Initial read-only tools

```text
get_expense_summary
get_my_expenses
get_pending_approvals
get_expense_details
get_policy_rule
explain_rejection
search_company_policy
```

### Tool execution flow

```text
User question
     ↓
AI selects a read-only tool
     ↓
Tool queries the tenant-scoped database
     ↓
AI summarizes the returned data
```

Every tool must enforce tenant isolation in application code:

```ts
where: {
  companyId: session.user.companyId
}
```

Never rely on the model to enforce authorization or tenant boundaries.

## 8. Phase 5 — Policy Knowledge Base

Admins should eventually be able to upload policy documents such as:

- Travel policy
- Meal limits
- Mileage policy
- Receipt requirements
- Approval thresholds
- Country-specific rules

For the first implementation, store important limits as structured database rules and evaluate them deterministically.

For long-form policy documents, add retrieval-augmented generation:

```text
Admin uploads policy
       ↓
Document is parsed and chunked
       ↓
Chunks are indexed
       ↓
AI retrieves relevant sections
       ↓
Answer includes policy evidence
```

OpenAI vector stores support semantic search and file retrieval for this pattern.

Reference:

- [OpenAI vector stores](https://platform.openai.com/docs/api-reference/vector-stores)

### Suggested schema

```prisma
model PolicyDocument {
  id         String   @id @default(cuid())
  companyId  String
  name       String
  storageUrl String
  version    String?
  status     String
  createdAt  DateTime @default(now())

  company Company @relation(fields: [companyId], references: [id])
}

model PolicyRule {
  id          String   @id @default(cuid())
  companyId   String
  name        String
  category    String
  conditions  Json
  limits      Json
  active      Boolean  @default(true)
  createdAt   DateTime @default(now())

  company Company @relation(fields: [companyId], references: [id])
}
```

## 9. Database Additions

Persist AI results and findings for auditability instead of storing only the final output.

```prisma
model AiExpenseReview {
  id              String   @id @default(cuid())
  expenseId       String
  companyId       String
  type            String   // EXTRACTION, VALIDATION, SUMMARY
  status          String   // PENDING, COMPLETE, FAILED
  provider        String?
  model           String?
  inputHash       String?
  result          Json?
  confidence      Json?
  warnings        Json?
  error           String?
  createdAt       DateTime @default(now())
  completedAt     DateTime?

  expense Expense @relation(fields: [expenseId], references: [id], onDelete: Cascade)
  company Company @relation(fields: [companyId], references: [id])

  @@index([companyId, createdAt])
  @@index([expenseId, type])
}

model AiFinding {
  id         String   @id @default(cuid())
  reviewId   String
  code       String
  severity   String
  message    String
  evidence   String?
  confidence Float?
  resolved   Boolean  @default(false)
  createdAt  DateTime @default(now())

  review AiExpenseReview @relation(fields: [reviewId], references: [id], onDelete: Cascade)
}

model AiFeedback {
  id        String   @id @default(cuid())
  reviewId  String
  userId    String
  decision  String // ACCEPTED, EDITED, DISMISSED
  changes   Json?
  createdAt DateTime @default(now())
}
```

Store the model name, prompt version, input hash, confidence, findings, and user corrections. This enables debugging and quality measurement.

## 10. AI Service Architecture

```text
src/lib/ai/
├── client.ts
├── config.ts
├── errors.ts
├── redaction.ts
├── schemas.ts
├── prompts/
│   ├── receipt.ts
│   ├── validation.ts
│   ├── approvalSummary.ts
│   └── assistant.ts
├── tools/
│   ├── expenseTools.ts
│   ├── approvalTools.ts
│   └── policyTools.ts
├── receiptExtractor.ts
├── expenseValidator.ts
├── approvalSummarizer.ts
└── assistant.ts
```

API routes should remain thin:

```text
route.ts
  → authenticate
  → authorize
  → validate input
  → call AI service
  → persist audit record
  → return response
```

Do not place prompts, database queries, or provider-specific logic directly inside route handlers.

## 11. Security Requirements

This is an expense and financial workflow system, so the AI layer needs strict controls.

Required controls:

- Never expose `OPENAI_API_KEY` to the browser.
- Enforce `companyId` on every AI database query.
- Enforce role permissions before retrieving expense data.
- Redact passwords, tokens, and unnecessary personal data.
- Do not log receipt images or full OCR text in production logs.
- Treat receipt text and uploaded documents as untrusted input.
- Protect against prompt injection inside uploaded documents.
- Validate all AI output with Zod.
- Use request timeouts and bounded retries.
- Add per-user and per-company rate limits.
- Store model, prompt version, and result for auditability.
- Keep human approval mandatory.
- Allow users to correct AI-generated values.

## 12. Feature Flags

Start with all AI features disabled by default:

```env
AI_PROVIDER=openai
AI_EXPENSE_EXTRACTION_ENABLED=false
AI_EXPENSE_VALIDATION_ENABLED=false
AI_APPROVAL_SUMMARY_ENABLED=false
AI_ASSISTANT_ENABLED=false
```

Enable features per company or per user during rollout where possible.

## 13. Rollout Milestones

### Milestone 1 — Foundation

- Add the AI provider SDK.
- Add environment configuration.
- Create `src/lib/ai`.
- Add Zod response schemas.
- Add AI audit tables.
- Add feature flags.
- Add timeouts and error handling.

### Milestone 2 — Receipt extraction

- Connect AI extraction to the existing OCR route.
- Preserve Tesseract as a fallback.
- Add confidence values.
- Pre-fill the new expense form.
- Require employee confirmation.
- Record user corrections as feedback.

### Milestone 3 — Policy validation

- Add structured company policy rules.
- Run validation when a draft is saved or submitted.
- Display warnings before submission.
- Do not block submission on uncertain AI findings.

### Milestone 4 — Approval summaries

- Generate summaries when an expense enters `PENDING`.
- Cache the result.
- Display the summary on the Approvals page.
- Require managers to make the final decision.

### Milestone 5 — AI assistant

- Add a separate AI assistant UI.
- Start with read-only queries.
- Add evidence for policy answers.
- Delay write actions until authorization and audit behavior are proven.

### Milestone 6 — Optimization

- Add feedback dashboards.
- Measure extraction accuracy.
- Tune prompts.
- Reduce token usage.
- Add background processing for slow jobs.
- Add policy document retrieval.

## 14. Testing Strategy

### Unit tests

Test deterministic functions including:

- Currency parsing
- Amount parsing
- Category normalization
- Date normalization
- Confidence thresholds
- Policy limit calculations
- Tenant filtering

### AI contract tests

For fixed OCR text, assert:

```text
valid JSON
valid category enum
valid ISO date
valid numeric amount
confidence between 0 and 1
no unexpected fields
```

### Golden receipt dataset

Create 30–100 anonymized sample receipts covering:

- Clear receipts
- Blurry receipts
- Multiple totals
- Foreign currencies
- Missing dates
- Tax and tip
- Handwritten receipts
- Duplicate receipts

Track:

```text
field accuracy
category accuracy
false warning rate
missing field rate
average latency
cost per receipt
```

### Authorization tests

Verify that:

- Employees cannot retrieve another company’s expense.
- Employees cannot see manager-only summaries.
- Managers only see permitted approval records.
- AI tools cannot bypass role checks.
- AI output cannot mutate approval state.

### UI tests

Verify that:

- AI fields show confidence.
- Users can edit extracted values.
- Loading and failure states work.
- AI failure falls back to manual entry.
- Approve/reject buttons remain human-controlled.
- Long AI responses do not break the layout.

## 15. Recommended Safe MVP

The first production-ready AI release should be:

```text
Receipt upload
→ AI extraction
→ confidence display
→ employee confirmation
→ deterministic policy warnings
→ human workflow approval
```

Do not start with autonomous approvals, automatic rejection, or a broad chatbot. Those features require reliable authorization, policy retrieval, auditability, and evaluation data first.

The most practical first implementation is AI-assisted receipt extraction because the project already has OCR, a receipt upload flow, and a structured expense form.
