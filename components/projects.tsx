"use client";
import { useEffect, useState, useRef } from "react";
import {
  FolderOpen,
  Upload,
  Copy,
  Download,
  Pencil,
  Trash2,
  FileText,
  Grid2X2,
} from "lucide-react";
import {
  listProjects,
  saveProject,
  deleteProject,
  serializeProject,
  deserializeProject,
} from "@/lib/storage";
import { download } from "@/lib/download";
import type { Project } from "@/lib/model";
export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([]),
    [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const refresh = () =>
    listProjects()
      .then(setProjects)
      .catch(() =>
        setError(
          "Local storage is unavailable. You can still edit and export files.",
        ),
      );
  const safely = async (action: () => Promise<void>) => {
    try {
      await action();
      setError("");
    } catch {
      setError(
        "Could not update local projects. Storage may be full or unavailable. Export a backup before clearing browser data.",
      );
    }
  };
  useEffect(() => {
    void refresh();
  }, []);
  return (
    <>
      <div className="project-list">
        {projects.length ? (
          projects.map((p) => (
            <article className="project-card" key={p.id}>
              <a href={`/studio?project=${p.id}`} className="project-open">
                {p.kind === "pdf" ? <Grid2X2 /> : <FileText />}
                <strong>{p.title}</strong>
                <span>
                  {new Date(p.updated).toLocaleString()} ·{" "}
                  {p.kind === "pdf" ? `${p.pages.length} pages` : "Document"}
                </span>
              </a>
              <div className="row">
                <button
                  aria-label={`Rename ${p.title}`}
                  className="icon-button"
                  onClick={() =>
                    void safely(async () => {
                      const title = prompt("Project name", p.title);
                      if (title?.trim()) {
                        await saveProject({ ...p, title: title.trim() });
                        await refresh();
                      }
                    })
                  }
                >
                  <Pencil size={15} />
                </button>
                <button
                  className="icon-button"
                  aria-label={`Duplicate ${p.title}`}
                  onClick={() =>
                    void safely(async () => {
                      await saveProject({
                        ...p,
                        id: crypto.randomUUID(),
                        title: p.title + " copy",
                      });
                      await refresh();
                    })
                  }
                >
                  <Copy size={15} />
                </button>
                <button
                  className="icon-button"
                  aria-label={`Back up ${p.title}`}
                  onClick={() =>
                    download(
                      serializeProject(p),
                      p.title + ".tipsy.json",
                      "application/json",
                    )
                  }
                >
                  <Download size={15} />
                </button>
                <button
                  aria-label={`Delete ${p.title}`}
                  className="icon-button"
                  onClick={() =>
                    void safely(async () => {
                      if (confirm(`Delete “${p.title}” from this browser?`)) {
                        await deleteProject(p.id);
                        await refresh();
                      }
                    })
                  }
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </article>
          ))
        ) : (
          <div className="projects-empty">
            <FolderOpen size={27} />
            <div>
              <strong>Good things start with a first project.</strong>
              <p>Your locally saved projects will find a home here.</p>
            </div>
          </div>
        )}
      </div>
      <input
        hidden
        ref={input}
        type="file"
        accept=".json"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          try {
            await saveProject(deserializeProject(await f.text()));
            await refresh();
            setError("");
          } catch (err) {
            setError(
              err instanceof Error ? err.message : "Could not import project.",
            );
          }
          e.target.value = "";
        }}
      />
      <div className="row project-foot">
        <span>
          Saved on this device. Export a backup to keep a permanent copy.
        </span>
        <button className="text-button" onClick={() => input.current?.click()}>
          <Upload size={14} /> Import project backup
        </button>
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </>
  );
}
