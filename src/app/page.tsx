import Link from "next/link"
import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Check,
  CheckCheck,
  ChevronRight,
  CircleDollarSign,
  FileCheck2,
  FileText,
  Globe2,
  Layers3,
  ReceiptText,
  ScanLine,
  ShieldCheck,
  Workflow,
} from "lucide-react"
import { authOptions } from "@/lib/auth"
import FlowExperience from "@/components/FlowExperience"

const features = [
  {
    icon: ReceiptText,
    number: "01",
    title: "Expenses, minus the admin",
    description:
      "Give your team one clear place to submit expenses, attach receipts, and follow each request from draft to decision.",
    detail: "Simple employee submissions",
  },
  {
    icon: Workflow,
    number: "02",
    title: "Approvals that keep moving",
    description:
      "Route claims through an ordered approval workflow, keep decisions visible, and give approvers the context they need.",
    detail: "Structured review steps",
  },
  {
    icon: ScanLine,
    number: "03",
    title: "A quicker start with AI",
    description:
      "Use AI-assisted receipt extraction to prefill expense details. Review the suggested information before submitting.",
    detail: "Human-reviewed suggestions",
  },
  {
    icon: Globe2,
    number: "04",
    title: "Made for distributed teams",
    description:
      "Track expenses in supported currencies, keep activity in one workspace, and export records when finance needs them.",
    detail: "Multi-currency support",
  },
]

export default async function Home() {
  const session = await getServerSession(authOptions)
  if (session) redirect("/dashboard")

  return (
    <main id="main-content" className="landing-page">
      <header className="landing-nav">
        <div className="landing-nav-inner">
          <Link href="/" className="landing-brand" aria-label="Reimbursor home">
            <span className="brand-mark"><ReceiptText size={19} strokeWidth={2.3} /></span>
            <span>reimbursor<span className="brand-period">.</span></span>
          </Link>
          <nav className="landing-links" aria-label="Main navigation">
            <a href="#features">Features</a>
            <a href="#how-it-works">How it works</a>
          </nav>
          <div className="landing-actions">
            <Link href="/login" className="nav-login">Log in</Link>
            <Link href="/signup" className="button button-dark button-small">Get started <ArrowRight size={15} /></Link>
          </div>
        </div>
      </header>

      <section className="hero-section">
        <div className="hero-glow" aria-hidden="true" />
        <div className="hero-copy">
          <div className="eyebrow"><span className="eyebrow-dot" /> EXPENSES, IN GOOD ORDER</div>
          <h1>Less chasing.<br /><span>More clarity.</span></h1>
          <p className="hero-description">
            A calmer way to submit, review, and manage company expenses. Every request has a place, a path, and a clear next step.
          </p>
          <div className="hero-ctas">
            <Link href="/signup" className="button button-lime">Create your workspace <ArrowRight size={17} /></Link>
            <Link href="/login" className="hero-login">Already have an account <ArrowUpRight size={15} /></Link>
          </div>
          <div className="hero-note"><ShieldCheck size={15} /> Keep submissions, reviews, and decisions together.</div>
        </div>

        <div className="dashboard-scene" aria-label="Illustration of an expense management dashboard">
          <div className="scene-orbit orbit-one" />
          <div className="scene-orbit orbit-two" />
          <div className="dashboard-window">
            <div className="dash-topbar">
              <div className="dash-brand"><span className="dash-logo"><ReceiptText size={12} /></span> Reimbursor</div>
              <div className="dash-top-right"><span className="dash-search">⌕ <i>Search</i></span><Bell size={14} /><span className="dash-avatar">AS</span></div>
            </div>
            <div className="dash-body">
              <aside className="dash-sidebar">
                <span className="dash-side-label">WORKSPACE</span>
                <span className="dash-side-item dash-side-active"><Layers3 size={13} /> Overview</span>
                <span className="dash-side-item"><ReceiptText size={13} /> Expenses</span>
                <span className="dash-side-item"><FileCheck2 size={13} /> Approvals <b>3</b></span>
                <span className="dash-side-item"><CircleDollarSign size={13} /> Reports</span>
                <div className="dash-side-bottom"><span className="dash-mini-avatar">AM</span><span>Alex Morgan<small>Workspace admin</small></span></div>
              </aside>
              <div className="dash-content">
                <div className="dash-greeting"><div><small>MONDAY, OCTOBER 12</small><strong>Good morning, Alex <span>✳</span></strong></div><button>+ New expense</button></div>
                <div className="dash-stats">
                  <div className="dash-stat"><span>Needs review</span><strong>03 <i className="stat-up">↗</i></strong><small>Waiting for your decision</small></div>
                  <div className="dash-stat"><span>Submitted this month</span><strong>24</strong><small>Across your workspace</small></div>
                  <div className="dash-stat"><span>Reimbursed</span><strong>$4,280</strong><small>Updated just now</small></div>
                </div>
                <div className="dash-table-head"><strong>Recent expenses</strong><span>View all <ChevronRight size={12} /></span></div>
                <div className="dash-table">
                  <div className="dash-row dash-row-header"><span>EXPENSE</span><span>SUBMITTED BY</span><span>AMOUNT</span><span>STATUS</span></div>
                  <div className="dash-row"><span className="expense-name"><i className="expense-icon icon-blue"><FileText size={13} /></i><span>Client lunch<small>Meals · Oct 12</small></span></span><span className="person"><i>JM</i> Jordan M.</span><b>$86.40</b><span className="status status-review">In review</span></div>
                  <div className="dash-row"><span className="expense-name"><i className="expense-icon icon-purple"><Globe2 size={13} /></i><span>Team offsite<small>Travel · Oct 11</small></span></span><span className="person"><i>SK</i> Sam K.</span><b>$342.00</b><span className="status status-approved"><Check size={10} /> Approved</span></div>
                  <div className="dash-row"><span className="expense-name"><i className="expense-icon icon-orange"><ReceiptText size={13} /></i><span>Software plan<small>Software · Oct 10</small></span></span><span className="person"><i>RL</i> Riley L.</span><b>$49.00</b><span className="status status-review">In review</span></div>
                </div>
                <div className="dash-footer"><span><span className="live-dot" /> Everything is up to date</span><span>Workspace activity <ArrowUpRight size={11} /></span></div>
              </div>
            </div>
          </div>
          <div className="float-card receipt-float"><span className="float-icon"><ScanLine size={16} /></span><span><b>Receipt attached</b><small>Ready for review</small></span><CheckCheck size={16} className="float-check" /></div>
          <div className="float-card approval-float"><span className="approval-avatar">JM</span><span><b>Decision recorded</b><small>Jordan’s expense approved</small></span><span className="approval-check"><Check size={12} /></span></div>
        </div>
        <a className="hero-scroll" href="#features"><ArrowDownRight size={14} /> SCROLL TO EXPLORE</a>
      </section>

      <section className="feature-section" id="features">
        <div className="section-wrap">
          <div className="section-heading">
            <div><div className="eyebrow eyebrow-muted">ONE WORKSPACE, A CLEARER FLOW</div><h2>Expense management<br />that makes sense.</h2></div>
            <p>From the first receipt to the final decision, give everyone a straightforward way to stay on top of spending.</p>
          </div>
          <div className="feature-grid">
            {features.map(({ icon: Icon, number, title, description, detail }) => (
              <article className="feature-card" key={number}>
                <div className="feature-card-top"><span className="feature-icon"><Icon size={19} strokeWidth={1.8} /></span><span className="feature-number">{number}</span></div>
                <h3>{title}</h3><p>{description}</p>
                <div className="feature-detail"><span className="detail-check"><Check size={11} /></span>{detail}</div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <FlowExperience />

      <section className="closing-section">
        <div className="closing-card"><div className="closing-orb" /><div className="closing-content"><span className="closing-kicker">A LITTLE MORE ORDER GOES A LONG WAY</span><h2>Ready to make expenses<br className="desktop-break" /> easier to manage?</h2><p>Set up your workspace and bring your team’s expense process into focus.</p><Link href="/signup" className="button button-dark">Get started <ArrowRight size={16} /></Link></div><div className="closing-art" aria-hidden="true"><div className="art-ring ring-a" /><div className="art-ring ring-b" /><div className="art-tile"><ReceiptText size={29} /><span>ALL IN ONE PLACE</span></div><div className="art-spark spark-a">✳</div><div className="art-spark spark-b">✳</div></div></div>
      </section>

      <footer className="landing-footer"><Link href="/" className="landing-brand"><span className="brand-mark"><ReceiptText size={17} strokeWidth={2.3} /></span><span>reimbursor<span className="brand-period">.</span></span></Link><span>Expenses, in good order.</span><div><Link href="/login">Log in</Link><Link href="/signup">Create account <ArrowUpRight size={12} /></Link></div><small>© {new Date().getFullYear()} Reimbursor</small></footer>
    </main>
  )
}
