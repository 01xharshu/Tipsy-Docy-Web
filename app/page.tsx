"use client";
import Link from "next/link";
import {
  ArrowUpRight,
  ArrowRight,
  FileText,
  Grid2X2,
  LockKeyhole,
  Sparkles,
  Layers,
  WandSparkles,
  Check,
  Plus,
} from "lucide-react";
import Theme from "@/components/theme";
import Projects from "@/components/projects";
export default function Home() {
  return (
    <>
      <nav className="landing-nav">
        <Link className="brand" href="/">
          <span className="brand-symbol">
            <Layers size={23} />
          </span>
          tipsy docy<span className="brand-dot">®</span>
        </Link>
        <div className="nav-links">
          <a href="#studios">The studios</a>
          <a href="#projects">Your projects</a>
          <Link href="/privacy">Privacy first</Link>
        </div>
        <div className="row">
          <Theme />
          <Link
            href="/studio?mode=document"
            className="button small dark-button"
          >
            Open studio <ArrowUpRight size={16} />
          </Link>
        </div>
      </nav>
      <main className="landing" id="main-content">
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="status-dot" /> A LITTLE LESS ADMIN. A LOT MORE
              POSSIBILITY.
            </div>
            <h1>
              Your documents.
              <br />
              Your canvas.
              <br />
              <span>Your rules.</span>
              <svg viewBox="0 0 340 20" aria-hidden="true">
                <path d="M4 13 Q160 -5 332 10 M60 18 Q180 6 285 15" />
              </svg>
            </h1>
            <p>
              Create, edit, arrange, preview, and export beautiful documents and
              PDFs, right in your browser.
            </p>
            <div className="hero-actions">
              <Link className="button primary" href="/studio?mode=document">
                Make something yours <ArrowRight size={18} />
              </Link>
              <a className="text-button" href="#studios">
                Explore the tools <ArrowUpRight size={17} />
              </a>
            </div>
            <div className="hero-promises">
              <span>
                <Check size={14} /> Free to create
              </span>
              <span>
                <Check size={14} /> No account needed
              </span>
              <span>
                <LockKeyhole size={13} /> Files stay with you
              </span>
            </div>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="art-grid" />
            <div className="art-pill">
              <span className="status-dot" /> YOUR IDEAS, IN GOOD SHAPE
            </div>
            <div className="mock-toolbar">
              <span className="mini-logo">t.</span>
              <span>Something wonderful.doc</span>
              <span className="mock-save">
                Saved locally <Check size={10} />
              </span>
            </div>
            <div className="mock-document">
              <div className="mock-kicker">THE EVERYDAY, REIMAGINED</div>
              <h2>
                Room for
                <br />
                <em>big ideas.</em>
              </h2>
              <p>
                A fresh page. A different perspective.
                <br />A little space to make it your own.
              </p>
              <div className="mock-photo">
                <div className="sun" />
                <div className="arch arch-one" />
                <div className="arch arch-two" />
              </div>
              <div className="mock-lines">
                <i />
                <i />
                <i />
              </div>
              <div className="mock-page-number">
                TIPSY DOCY STUDIO <span>01</span>
              </div>
            </div>
            <div className="floating-layout">
              <div className="row between">
                <span>
                  <Grid2X2 size={13} /> A perfect fit
                </span>
                <span className="tiny-chip">2 × 2</span>
              </div>
              <div className="mini-grid">
                {[1, 2, 3, 4].map((n) => (
                  <div key={n}>
                    <span>{n.toString().padStart(2, "0")}</span>
                    <i />
                    <i />
                    <i />
                  </div>
                ))}
              </div>
              <div className="layout-caption">
                <Check size={12} /> All lined up. Ready to go.
              </div>
            </div>
            <div className="floating-cursor">
              <svg width="20" height="23">
                <path
                  d="M2 2 L17 14 L9 15 L6 21Z"
                  fill="#566b4a"
                  stroke="white"
                  strokeWidth="2"
                />
              </svg>
              <span>You, in control</span>
            </div>
            <div className="art-tag">
              <Sparkles size={15} /> A blank page has never felt so good.
            </div>
          </div>
        </section>
        <section className="studio-section" id="studios">
          <div className="section-heading">
            <div>
              <div className="eyebrow">ONE SPACE. ENDLESS POSSIBILITIES.</div>
              <h2>What are we making today?</h2>
            </div>
            <p>
              From the first word to the finishing touch.
              <br />
              There’s a studio for that.
            </p>
          </div>
          <div className="studio-cards">
            <Link className="studio-card" href="/studio?mode=pdf">
              <div className="card-top">
                <span className="card-icon lavender">
                  <Grid2X2 />
                </span>
                <ArrowUpRight />
              </div>
              <span className="card-label">LESS SHUFFLE. MORE FLOW.</span>
              <h3>PDF Studio</h3>
              <p>
                Bring your pages together. Arrange, resize, and find the perfect
                layout.
              </p>
              <span className="card-link">
                Arrange your pages <ArrowRight size={16} />
              </span>
            </Link>
            <Link className="studio-card" href="/studio?mode=document">
              <div className="card-top">
                <span className="card-icon peach">
                  <FileText />
                </span>
                <ArrowUpRight />
              </div>
              <span className="card-label">BIG IDEAS START HERE.</span>
              <h3>Document Studio</h3>
              <p>
                A fresh canvas for your words. Write, style, and make every page
                your own.
              </p>
              <span className="card-link">
                Start with a blank page <ArrowRight size={16} />
              </span>
            </Link>
            <Link className="studio-card" href="/studio?mode=tools">
              <div className="card-top">
                <span className="card-icon green">
                  <WandSparkles />
                </span>
                <ArrowUpRight />
              </div>
              <span className="card-label">SMALL TASKS. SORTED.</span>
              <h3>Quick Tools</h3>
              <p>
                Merge, split, rotate, or extract. Your everyday PDF fixes,
                without the fuss.
              </p>
              <span className="card-link">
                Get straight to it <ArrowRight size={16} />
              </span>
            </Link>
          </div>
        </section>
        <section id="projects" className="projects-section">
          <div className="section-heading">
            <div>
              <div className="eyebrow">PICK UP WHERE YOU LEFT OFF</div>
              <h2>Your little corner of the internet.</h2>
            </div>
            <Link className="text-button" href="/studio?mode=document">
              <Plus size={16} /> New project
            </Link>
          </div>
          <Projects />
        </section>
        <section className="privacy-strip">
          <span className="privacy-icon">
            <LockKeyhole size={26} />
          </span>
          <div>
            <h3>Your files are your business.</h3>
            <p>
              Everything happens in your browser. No uploads, no accounts, no
              peeking.
            </p>
          </div>
          <Link className="text-button" href="/privacy">
            Our privacy promise <ArrowUpRight size={16} />
          </Link>
        </section>
      </main>
      <footer className="footer">
        <Link className="brand" href="/">
          tipsy docy<span className="brand-dot">®</span>
        </Link>
        <span>A little more creative. A lot more you.</span>
        <span>Made for your browser. And your peace of mind.</span>
      </footer>
    </>
  );
}
