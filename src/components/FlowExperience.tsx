"use client"

import Link from "next/link"
import { useRef, useState } from "react"
import { AnimatePresence, motion, useMotionValueEvent, useReducedMotion, useScroll, useTransform } from "framer-motion"
import { ArrowRight, Check, CheckCheck, CircleDollarSign, FileCheck2, ReceiptText, ScanLine, ShieldCheck } from "lucide-react"

const steps = [
  { number: "01", title: "Submit", description: "Add the details and receipt." },
  { number: "02", title: "Review", description: "Approvers see the full picture." },
  { number: "03", title: "Resolve", description: "Track the decision and next step." },
]

function StepCard({ index, progress }: { index: number; progress: ReturnType<typeof useScroll>["scrollYProgress"] }) {
  const stageProgress = useTransform(progress, [index / 3, (index + 1) / 3], [0, 1], { clamp: true })
  const scanY = useTransform(stageProgress, [0.12, 0.72], ["0%", "100%"])
  const noteGlow = useTransform(stageProgress, [0.24, 0.48, 0.72], [0, 1, 0])
  const noteShadow = useTransform(noteGlow, (value) => `0 0 ${value * 22}px rgb(205 231 123 / ${value * 24}%)`)
  const resultScale = useTransform(stageProgress, [0.12, 0.38], [0.7, 1])
  const reimbursementWidth = useTransform(stageProgress, [0.3, 0.82], ["8%", "100%"])
  if (index === 0) return <div className="flow-ui-card submit-ui">
    <div className="ui-card-head"><span className="ui-window-dots"><i /><i /><i /></span><span>NEW EXPENSE</span><span className="ui-draft">DRAFT</span></div>
    <div className="ui-expense-title"><span className="ui-icon"><ReceiptText size={18} /></span><span><b>Taxi to client meeting</b><small>Travel · Today, 10:42 AM</small></span><b className="ui-amount">$28.50</b></div>
    <div className="ui-upload"><ScanLine size={18} /><span><b>Receipt attached</b><small>taxi_receipt.jpg · Details ready</small></span><Check size={15} /><motion.i className="ui-scan-line" style={{ top: scanY }} /></div>
    <div className="ui-submit-row"><span><ShieldCheck size={14} /> Policy check passed</span><span className="ui-submit-button">Submit expense <ArrowRight size={13} /></span></div>
  </div>
  if (index === 1) return <div className="flow-ui-card review-ui">
    <div className="ui-card-head"><span className="ui-window-dots"><i /><i /><i /></span><span>APPROVAL INBOX</span><span className="ui-review-pill">NEEDS REVIEW</span></div>
    <div className="ui-review-main"><div className="ui-review-person"><span className="ui-avatar">JM</span><span><b>Jordan Miller</b><small>Submitted a travel expense</small></span><strong>$28.50</strong></div>
      <motion.div className="ui-review-note" style={{ boxShadow: noteShadow }}><span className="ui-note-icon"><FileCheck2 size={15} /></span><span><b>Everything you need to decide</b><small>Receipt verified · Within travel policy</small></span><motion.span className="ui-review-check" style={{ scale: resultScale }}><Check size={14} /></motion.span></motion.div>
      <div className="ui-review-actions"><span>Request changes</span><span className="ui-approve-button"><Check size={13} /> Approve expense</span></div>
    </div>
  </div>
  return <div className="flow-ui-card resolve-ui">
    <div className="ui-card-head"><span className="ui-window-dots"><i /><i /><i /></span><span>EXPENSE ACTIVITY</span><span className="ui-resolved-pill">RESOLVED</span></div>
    <div className="ui-resolve-main"><motion.span className="ui-resolve-icon" style={{ scale: resultScale }}><CheckCheck size={23} /></motion.span><div><small>REQUEST APPROVED</small><b>All set, Jordan.</b><span>Your expense is approved and ready for reimbursement.</span></div></div>
    <div className="ui-payment"><span className="ui-icon"><CircleDollarSign size={17} /></span><span><b>Next step</b><small>Included in the next reimbursement run</small></span><span className="ui-payment-date">OCT 18</span></div>
    <div className="ui-status-track"><span className="is-done"><i><Check size={9} /></i>Submitted</span><span className="is-done"><i><Check size={9} /></i>Approved</span><span className="ui-reimbursement"><i />Reimbursement</span><motion.i className="ui-reimbursement-progress" style={{ width: reimbursementWidth }} /></div>
  </div>
}

export default function FlowExperience() {
  const sectionRef = useRef<HTMLElement>(null)
  const reduceMotion = useReducedMotion()
  const [activeStep, setActiveStep] = useState(0)
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end end"] })
  const railProgress = useTransform(scrollYProgress, [0.03, 0.95], [0, 1])
  useMotionValueEvent(scrollYProgress, "change", (value) => setActiveStep(Math.min(2, Math.floor(value * 3))))

  return <section className="flow-scroll-section" id="how-it-works" ref={sectionRef}>
    <div className="flow-sticky-stage">
      <div className="flow-stage-wrap">
        <div className="flow-stage-intro">
          <div className="eyebrow eyebrow-light">A BETTER ROUTINE</div>
          <h2>From receipt<br />to resolution.</h2>
          <p>Make the process easy to follow for employees, managers, and finance alike.</p>
          <Link href="/signup" className="flow-link">Set up your workspace <ArrowRight size={15} /></Link>
          <div className="flow-scroll-hint"><span className="flow-hint-line" /> KEEP SCROLLING <span className="flow-hint-arrow">↓</span></div>
        </div>

        <div className="flow-stage-content">
          <div className="flow-stage-heading"><span>THE EXPENSE JOURNEY</span><span>SCROLL TO EXPLORE <i>↓</i></span></div>
          <div className="flow-track">
            <div className="flow-track-base" /><motion.div className="flow-track-progress" style={{ scaleY: reduceMotion ? 1 : railProgress }} />
            {reduceMotion ? steps.map((step, index) => <article className="flow-stage-step" key={step.number}><StepCopy step={step} /><StepCard index={index} progress={scrollYProgress} /></article>) : (
              <AnimatePresence mode="wait" initial={false}>
                <motion.article key={steps[activeStep].number} className="flow-stage-step" initial={{ opacity: 0, y: 30, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -18, scale: 0.98 }} transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}>
                  <StepCopy step={steps[activeStep]} live /><StepCard index={activeStep} progress={scrollYProgress} />
                </motion.article>
              </AnimatePresence>
            )}
          </div>
          <div className="flow-stage-footer"><span><i className="flow-live-dot" /> A CLEAR PATH FOR EVERY EXPENSE</span><span aria-live="polite">0{activeStep + 1} <i /> 03</span></div>
        </div>
      </div>
    </div>
  </section>
}

function StepCopy({ step, live = false }: { step: typeof steps[number]; live?: boolean }) {
  return <div className="flow-step-copy"><span className="flow-step-number">{step.number}</span><div><h3 aria-live={live ? "polite" : undefined}>{step.title}</h3><p>{step.description}</p></div></div>
}
