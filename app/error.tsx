"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="privacy-page">
      <h1>Let’s get your workspace back.</h1>
      <p>
        This workspace could not be displayed. Your previously saved local
        projects remain in this browser. Retry, or return home to reopen a saved
        project.
      </p>
      <div className="row">
        <button className="button primary" onClick={reset}>
          Retry workspace
        </button>
        <a className="button" href="/">
          Return home
        </a>
      </div>
    </main>
  );
}
