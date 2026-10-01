# Reimbursor - Expense Management System

A premium, multi-tenant expense management system built with Next.js 14, Prisma, and PostgreSQL. Designed for businesses to streamline employee expense submissions, approval workflows, and financial oversight with an enterprise-grade user experience.

## Purpose

Reimbursor automates the expense reimbursement process by providing:

- **For Employees**: Easy expense submission with multi-currency support and real-time status tracking
- **For Managers**: Multi-level approval workflows with sequential/parallel step support
- **For Admins**: Complete visibility, powerful overrides, and user management across the organization

## Tech Stack

| Category | Technology |
|----------|------------|
| Frontend | Next.js 14 (App Router), React 18, Tailwind CSS, shadcn/ui |
| Backend | Next.js API Routes, Prisma ORM |
| Database | PostgreSQL |
| Authentication | NextAuth.js (JWT Strategy) |
| Email | Nodemailer (SMTP) |
| Monitoring | Sentry |
| Validation | Zod |
| AI | Groq API through the OpenAI-compatible SDK; Tesseract OCR for receipt text |

## User Roles

| Role | Capabilities |
|------|--------------|
| **Employee** | Submit expenses, view own expense history, receive status notifications |
| **Manager** | Approve/reject team expenses, view pending approvals, see converted amounts |
| **Admin** | View all company expenses, override any approval, manage users, manage workflows |

## Features

### Authentication & Authorization

- [x] **User Registration** - Sign up with company creation
- [x] **Login/Logout** - Secure session-based authentication
- [x] **Password Reset** - Forgot/reset password via email
- [x] **Role-based Access** - Middleware-protected routes
- [x] **JWT Sessions** - Secure token-based authentication

### User Management

- [x] **Auto Company Creation** - New signup creates company automatically
- [x] **Role Assignment** - Assign Employee, Manager, or Admin roles
- [x] **Manager Relationships** - Link employees to managers
- [x] **User CRUD** - Create, read, update, delete users (Admin only)
- [x] **User Dashboard** - View all users with role statistics

### Expense Management

- [x] **Create Expense** - Submit with amount, category, description, date
- [x] **Multi-currency Support** - Submit in any currency with exchange rate
- [x] **Currency Conversion** - Automatic conversion to company base currency
- [x] **Expense Categories** - Travel, Meals, Accommodation, Transportation, Supplies, Equipment, Other
- [x] **Expense History** - View all submitted expenses with status
- [x] **Expense Details** - View individual expense with full information
- [x] **Idempotency Keys** - Prevent duplicate submissions

### Multi-Level Approval Workflow

- [x] **ApprovalWorkflow Model** - Configurable company-level workflows
- [x] **ApprovalStep Model** - Define sequential/parallel approval steps
- [x] **Step Types**:
  - `SEQUENTIAL` - Complete current step before next
  - `PARALLEL` - Multiple approvers vote simultaneously
  - `ANY_ONE` - Single approval/rejection ends the step
- [x] **Conditional Rules**:
  - Percentage-based approval (e.g., 60% required)
  - Specific approver override (e.g., CFO required)
  - Hybrid logic (percentage OR specific approver)
- [x] **Workflow Engine** - Modular functions for:
  - `createApprovalWorkflow()` - Initialize workflow
  - `handleApprovalAction()` - Process decisions
  - `evaluateStep()` - Calculate step completion
  - `moveToNextStep()` - Advance workflow
- [x] **Idempotency** - Prevent duplicate approval actions
- [x] **State Transitions**:
  - `PENDING → APPROVED → NEXT STEP`
  - `REJECTED → TERMINATE FLOW`

### Admin Override

- [x] **View All Expenses** - See every expense in the company
- [x] **Force Approve/Reject** - Override any expense decision
- [x] **Override Comments** - Record reason for override
- [x] **Override Tracking** - Log who overrode and when

### Admin Dashboard

- [x] **Summary Cards** - Total, Pending, Overridden, Rejected counts
- [x] **Advanced Filters** - Search, status, employee, date range
- [x] **Export CSV** - Download expense data
- [x] **Bulk Actions** - Select multiple for batch approve/reject
- [x] **Pagination** - Navigate large datasets
- [x] **Empty States** - Contextual guidance when no data

### Notifications System

- [x] **Real-time Notifications** - Bell icon with unread count
- [x] **Event-driven Architecture** - Centralized notification service
- [x] **Notification Types**:
  - `EXPENSE_SUBMITTED` - New expense submitted
  - `APPROVAL_REQUIRED` - Approval needed
  - `APPROVAL_ACTION` - Expense approved/rejected
  - `EXPENSE_APPROVED` - Fully approved
  - `EXPENSE_REJECTED` - Rejected with reason
  - `STEP_ACTIVATED` - New approval step started
  - `STEP_COMPLETED` - Approval step finished
- [x] **Idempotency** - No duplicate notifications
- [x] **Deep Linking** - Click to navigate to expense
- [x] **Mark as Read** - Individual or mark all

### AI-assisted features

AI is optional and disabled unless configured. AI output is advisory: it does not approve, reject, or submit expenses.

- **Receipt extraction** - Scans receipt images with Tesseract OCR, then uses Groq to normalize merchant, amount, currency, date, and category. Shows confidence and warnings and falls back to deterministic parsing when AI is disabled or unavailable. Employees must review the fields before submitting.
- **Expense review** - Managers and admins can request an AI validation or approval summary from a pending expense's detail page. Results use expense fields and approval history, are labeled advisory, and are stored in the AI review audit tables.
- **Expense assistant** - `/assistant` answers general questions about using the app. It does not read company policy or live expense data.

AI review limitations: validation is not backed by configured company policy rules; summaries do not inspect receipt evidence; assistant responses are general guidance. Treat results as suggestions and verify them before acting. There is no automated accuracy evaluation or test suite yet, so enable AI only for a controlled pilot until those controls exist.

### Editorial Enterprise Design System

- [x] **Material 3-inspired surfaces** - Layered, tonal design
- [x] **Typography Hierarchy** - Manrope headings, Inter body
- [x] **Glassmorphic Navbar** - Backdrop blur effect
- [x] **Active Sidebar** - Strong contrast with gradients
- [x] **Premium Cards** - No hard borders, soft shadows
- [x] **Gradient Buttons** - Indigo to purple primary actions
- [x] **Minimalist Inputs** - Bottom-border only style
- [x] **Status Badges** - Color-coded with icons
- [x] **Timeline Component** - Visual approval flow
- [x] **Smooth Transitions** - 200-300ms animations

### Engineering foundations (not a production-readiness claim)

- [x] **Input Validation** - Zod schemas for all API endpoints
- [x] **Error Boundaries** - Graceful error handling
- [x] **Structured Logging** - Performance monitoring
- [x] **Database Indexing** - Optimized queries
- [x] **Query Optimization** - Parallel queries, N+1 prevention

## Project Structure

```
src/
├── app/
│   ├── (app)/                    # Protected routes (with navbar + sidebar)
│   │   ├── admin/
│   │   │   ├── expenses/         # Admin expense management
│   │   │   ├── users/           # User management
│   │   │   └── settings/        # Company settings
│   │   ├── approvals/           # Manager approval page
│   │   ├── assistant/           # General-purpose expense app assistant
│   │   ├── dashboard/           # User dashboard
│   │   ├── expenses/            # Expense list & detail
│   │   │   ├── [id]/            # Expense detail page
│   │   │   └── new/             # Create expense
│   │   ├── notifications/       # Notification center
│   │   └── layout.tsx          # App layout with navbar/sidebar
│   ├── (auth)/                  # Public routes (no navbar)
│   │   ├── forgot-password/      # Password reset request
│   │   ├── login/               # Login page
│   │   ├── reset-password/       # Password reset form
│   │   ├── signup/              # Registration
│   │   └── layout.tsx          # Auth layout
│   ├── api/                     # API Routes
│   │   ├── auth/               # Auth endpoints
│   │   ├── approvals/          # Approval actions
│   │   ├── company/            # Company management
│   │   ├── dashboard/          # Dashboard data
│   │   ├── expenses/           # Expense CRUD & submit
│   │   ├── ai/                 # Receipt extraction, expense review, assistant APIs
│   │   ├── notifications/      # Notification management
│   │   ├── users/              # User management
│   │   └── workflow/           # Workflow management
│   ├── actions/                # Server actions
│   ├── global-error.tsx        # Global error boundary
│   ├── layout.tsx             # Root layout
│   ├── page.tsx               # Root redirect
│   └── providers.tsx           # Session provider
├── components/
│   ├── ui/                     # shadcn/ui components
│   │   ├── button.tsx          # Gradient primary buttons
│   │   ├── card.tsx            # Surface-based cards
│   │   ├── dialog.tsx          # Glassmorphic dialogs
│   │   ├── input.tsx           # Minimalist inputs
│   │   ├── table.tsx           # Borderless tables
│   │   └── timeline.tsx         # Approval flow timeline
│   ├── AdminExpenseTable.tsx   # Admin dashboard table
│   ├── AdminOverrideDialog.tsx  # Admin override modal
│   ├── CompanySetupModal.tsx   # Company setup wizard
│   ├── ExpenseAmountCell.tsx   # Currency display
│   ├── ExpenseList.tsx         # Expense listing
│   ├── Navbar.tsx             # Glassmorphic navbar
│   ├── Notifications.tsx       # Notification bell & list
│   ├── Sidebar.tsx            # Active sidebar
│   └── SubmitExpenseButton.tsx  # Submit action
└── lib/
    ├── auth.ts                 # NextAuth configuration
    ├── dashboard.ts            # Dashboard data fetching
    ├── email.ts               # Email service
    ├── logger.ts               # Logging utilities
    ├── notifications/          # Notification system
    │   ├── eventDispatcher.ts  # Event handling
    │   ├── notificationService.ts
    │   └── index.ts
    ├── prisma.ts              # Prisma client
    ├── utils.ts               # Utility functions
    ├── validations.ts         # Zod schemas
    └── workflow/               # Approval workflow engine
        ├── engine.ts           # WorkflowEngine class
        └── index.ts
```

## API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/signup` | Register new user & company |
| POST | `/api/auth/forgot-password` | Request password reset |
| POST | `/api/auth/reset-password` | Reset password with token |

### Users

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users` | List all company users |
| POST | `/api/users` | Create new user |
| GET | `/api/users/[id]` | Get user details |
| PATCH | `/api/users/[id]` | Update user (role, manager) |
| DELETE | `/api/users/[id]` | Delete user |

### Expenses

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/expenses` | List user's expenses |
| POST | `/api/expenses` | Create new expense |
| GET | `/api/expenses/[id]` | Get expense details |
| POST | `/api/expenses/[id]/submit` | Submit for approval |

### Approvals

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/approvals` | Get pending approvals |
| POST | `/api/approvals` | Approve or reject expense |

### AI (optional; requires server-side Groq configuration)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ai/expenses/extract` | OCR and AI receipt extraction for a draft |
| POST | `/api/ai/expenses/[id]/review` | Run `VALIDATION` or `APPROVAL_SUMMARY` for an expense (manager/admin) |
| POST | `/api/ai/assistant` | General app usage assistant |

### Workflow

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/workflow` | Get workflow configuration |
| POST | `/api/workflow` | Create workflow |
| PATCH | `/api/workflow/[id]` | Update workflow |

### Notifications

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/notifications` | Get user notifications |
| PATCH | `/api/notifications` | Mark as read |

## Database Schema

### Models

- **Company** - Multi-tenant organization
- **User** - Employees with roles and manager relationships
- **Expense** - Expense claims with multi-currency support
- **ApprovalWorkflow** - Company-level workflow configurations
- **ApprovalStep** - Individual steps with type, thresholds, approvers
- **ApprovalAction** - Individual approval decisions with idempotency
- **Notification** - User notifications with idempotency
- **Receipt** - Attached receipt files
- **SendPasswordToken** - Password reset tokens
- **AiExpenseReview**, **AiFinding**, **AiFeedback** - AI review results, findings, and feedback

### Indexes

```prisma
@@index([employeeId, status])       // Expense
@@index([companyId, status])        // Expense
@@index([createdAt])                // Expense
@@index([userId, read])            // Notification
@@index([userId, createdAt])       // Notification
@@index([approverId, action])      // ApprovalAction
@@index([expenseId, stepOrder])    // ApprovalAction
@@index([workflowId, stepOrder])   // ApprovalStep
```

## Environment Variables

```env
# Database
DATABASE_URL="postgresql://..."

# Auth
AUTH_SECRET="your-secret"
NEXTAUTH_SECRET="your-secret"
NEXTAUTH_URL="http://localhost:3000"

# Email (SMTP)
SMTP_HOST="smtp.example.com"
SMTP_PORT="587"
SMTP_USER="user"
SMTP_PASS="password"
EMAIL_FROM="noreply@example.com"

# Optional AI (Groq). Keep the API key server-side; never use NEXT_PUBLIC_ here.
GROQ_API_KEY=""
AI_ENABLED="true"
AI_PROVIDER="groq"
AI_DEFAULT_MODEL="openai/gpt-oss-120b"
AI_EXPENSE_EXTRACTION_ENABLED="false"
AI_EXPENSE_VALIDATION_ENABLED="false"
AI_APPROVAL_SUMMARY_ENABLED="false"
AI_ASSISTANT_ENABLED="false"
AI_REQUEST_TIMEOUT_MS="45000"
AI_MAX_RETRIES="2"
AI_MAX_OUTPUT_TOKENS="2000"

# Optional
DEFAULT_COUNTRY="United States"
NEXT_PUBLIC_SENTRY_DSN=""
```

Create a local `.env.local` file for development and keep it out of version control. Set `GROQ_API_KEY` on the server and set `AI_ENABLED=true` plus the individual feature flags you want to use. Restart the server after changing environment variables. A missing API key, `AI_ENABLED=false`, or a disabled feature flag turns that feature off. Use your deployment platform's secret manager for production credentials.

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database
- SMTP server (optional)

### Installation

```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Push schema to database
npx prisma db push

# Start development server
npm run dev
```

For production database changes, use the committed Prisma migrations (`npx prisma migrate deploy`) rather than `db push`. Back up the database before applying migrations. The repository currently has no automated test script or committed test suite; run `npm run build`, `npm run lint`, and `npx tsc --noEmit` as basic checks, then perform the manual checks in the AI section below.

The checked-in seed script creates accounts with fixed development passwords. Review `prisma/seed.ts` before running it, and never run it against a production database. Create production accounts through the registration/admin flows and use unique credentials.

## Performance Optimizations

- **Parallel Queries** - Dashboard loads data with `Promise.all`
- **Database Indexes** - Optimized for common queries
- **Selective Fields** - Only fetch required data
- **Idempotent Operations** - Prevent duplicate processing
- **Event-driven Notifications** - Decoupled from business logic
- **Memoized Filters** - Client-side filtering with useMemo

## Security Features

- Password hashing with bcrypt
- JWT session strategy
- Role-based middleware protection
- Input validation with Zod
- SQL injection prevention (Prisma)
- Idempotency keys for critical operations

## AI smoke checks

After configuring a development Groq key and enabling a feature, sign in and verify:

1. Upload a clear receipt image and confirm extracted values are editable and remain a draft until submitted.
2. Disable extraction or remove the API key and confirm receipt processing uses its fallback or reports the expected configuration state without silently submitting anything.
3. As a manager/admin, run both AI review actions on a pending expense; confirm the output is advisory and that a human approval action is still required.
4. As an employee, try the review endpoint and confirm it denies access. Try an expense from another company and confirm it is not returned.
5. Ask a general app usage question at `/assistant`; confirm it states that it cannot see company policy or live expense data.

These are manual smoke checks, not a substitute for automated authorization, workflow, and AI quality tests. Do not send real financial records to an external model until the company has approved the data handling and retention terms.

## Production status

This repository is a development/MVP foundation, not a production-certified expense platform. Before handling real financial data, add automated tests (especially tenant isolation and workflow transitions), shared/distributed rate limiting, production monitoring and alerting, backup/restore validation, operational migration procedures, and explicit data retention/privacy controls for receipt OCR and third-party AI processing. Validate security and deployment configuration in the target environment.
