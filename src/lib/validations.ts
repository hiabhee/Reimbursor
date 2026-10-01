import { z } from "zod"

export const expenseSchema = z.object({
  description: z.string().min(1, "Description is required").max(500, "Description too long"),
  category: z.enum(["TRAVEL", "MEALS", "ACCOMMODATION", "TRANSPORTATION", "SUPPLIES", "EQUIPMENT", "OTHER"]),
  date: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Invalid date format",
  }),
  submittedAmount: z.number().positive("Amount must be positive").max(1000000, "Amount too large"),
  submittedCurrency: z.string().length(3, "Currency must be 3 characters"),
  exchangeRate: z.number().positive("Exchange rate must be positive").max(10000, "Exchange rate too high"),
  ocrExtractionId: z.string().cuid().optional(),
})

export const signupSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100, "Name too long"),
  email: z.string().email("Invalid email address"),
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
  companyName: z.string().min(2, "Company name too short").max(200, "Company name too long"),
  companyCurrency: z.string().length(3, "Invalid currency code").default("USD"),
})

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
})

export const approvalActionSchema = z.object({
  expenseId: z.string().min(1, "Expense ID is required"),
  action: z.enum(["APPROVED", "REJECTED"]),
  comment: z.string().max(1000, "Comment too long").optional(),
})

export const adminOverrideSchema = z.object({
  expenseId: z.string().min(1, "Expense ID is required"),
  action: z.enum(["APPROVE", "REJECT"]),
  comment: z.string().max(1000, "Comment too long").optional(),
})

export const passwordResetRequestSchema = z.object({
  email: z.string().email("Invalid email address"),
})

export const passwordResetSchema = z.object({
  token: z.string().min(1, "Token is required"),
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
})

export type ExpenseInput = z.infer<typeof expenseSchema>
export type SignupInput = z.infer<typeof signupSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type ApprovalActionInput = z.infer<typeof approvalActionSchema>
export type AdminOverrideInput = z.infer<typeof adminOverrideSchema>
export type PasswordResetRequestInput = z.infer<typeof passwordResetRequestSchema>
export type PasswordResetInput = z.infer<typeof passwordResetSchema>
