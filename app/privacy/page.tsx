import Link from "next/link";
export default function Privacy() {
  return (
    <main className="privacy-page" id="main-content">
      <Link className="brand" href="/">
        tipsy docy®
      </Link>
      <h1>Your files stay yours.</h1>
      <p>
        Tipsy Docy processes PDF files, documents, images, previews, and exports
        on your device. Source documents are never uploaded to a document
        service. There are no accounts, analytics, subscriptions, or watermarks.
      </p>
      <h2>What is stored?</h2>
      <p>
        Projects and their source files are saved in this browser’s IndexedDB.
        Only your theme preference uses localStorage. Anyone with access to your
        browser profile may be able to access saved projects. Delete projects
        from the home page to remove them from local storage.
      </p>
      <h2>Keep a backup</h2>
      <p>
        Browser storage can be cleared or evicted and private browsing may
        discard it. Use Export project backup to keep a copy somewhere you
        control. If storage is full, the studio reports the save failure and
        still lets you export.
      </p>
      <h2>Imported content</h2>
      <p>
        Imported HTML is sanitized and remote images are removed. PDF JavaScript
        is not executed. DOCX imports and rich-text pastes preserve common
        formatting, but complex layouts and proprietary fonts may change. Google
        Docs content can be pasted or imported as exported DOCX; there is no
        direct Google account integration.
      </p>
      <h2>Local PDF export</h2>
      <p>
        PDF Studio embeds source PDF page content. Document Studio generates
        searchable text locally using standard PDF fonts. Non-Latin scripts,
        advanced typography, nested tables, and unusual image formats have
        limitations; use the clearly labeled browser print option when native
        browser typography is needed. That opens a print dialogue where you can
        select Save as PDF.
      </p>
      <Link className="button primary" href="/">
        Back to your studios
      </Link>
    </main>
  );
}
