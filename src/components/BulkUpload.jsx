import { useMemo, useRef, useState } from "react";
import { useTransactions } from "../context/TransactionContext";
import { readFileAsText, parseCsv, rowsToCsv, downloadCsv } from "../lib/csvTable";
import { downloadBulkTemplate, REQUIRED_HEADERS } from "../lib/bulkTemplate";
import { buildOutputRows, OUTPUT_HEADERS } from "../lib/bulkProcessing";
import { scoreBatchApi } from "../services/api";
import Icon from "./Icon";
import DecisionBadge from "./DecisionBadge";
import "./BulkUpload.css";

const STAGES = { IDLE: "idle", PARSED: "parsed", PROCESSING: "processing", DONE: "done" };
const PREVIEW_LIMIT = 10;

export default function BulkUpload() {
  const { addRecords } = useTransactions();
  const [stage, setStage] = useState(STAGES.IDLE);
  const [fileName, setFileName] = useState("");
  const [file, setFile] = useState(null);
  const [rawRows, setRawRows] = useState([]);
  const [parseError, setParseError] = useState("");
  const [batchError, setBatchError] = useState("");
  const [uploadPct, setUploadPct] = useState(0);
  const [results, setResults] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  const previewHeaders = useMemo(
    () => (rawRows.length > 0 ? Object.keys(rawRows[0]) : []),
    [rawRows]
  );
  const previewRows = useMemo(() => rawRows.slice(0, PREVIEW_LIMIT), [rawRows]);

  async function handleFile(pickedFile) {
    setParseError("");
    setBatchError("");
    setFileName(pickedFile.name);

    const isCsvLike =
      /\.(csv|txt)$/i.test(pickedFile.name) ||
      pickedFile.type.includes("csv") ||
      pickedFile.type === "text/plain";
    if (!isCsvLike) {
      setParseError(
        "This reader only accepts CSV. If you have an .xlsx file, use File → Save As → CSV in Excel/Sheets and upload that instead."
      );
      setStage(STAGES.IDLE);
      return;
    }

    try {
      const text = await readFileAsText(pickedFile);
      const rows = parseCsv(text);
      if (rows.length === 0) {
        setParseError("No data rows found in this file.");
        setStage(STAGES.IDLE);
        return;
      }
      setRawRows(rows);
      setFile(pickedFile);
      setStage(STAGES.PARSED);
    } catch {
      setParseError("Could not read this file.");
      setStage(STAGES.IDLE);
    }
  }

  function onInputChange(e) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  }

  function onDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  async function runBatch() {
    setStage(STAGES.PROCESSING);
    setUploadPct(0);
    setBatchError("");

    try {
      const data = await scoreBatchApi(file, (evt) => {
        if (evt.total) setUploadPct(Math.round((evt.loaded / evt.total) * 100));
      });
      const batchResults = data.results ?? [];
      setResults(batchResults);

      const successful = batchResults.filter((r) => !r.error);
      if (successful.length > 0) {
        addRecords(successful.map((r) => ({ request: r.request, response: r.response })));
      }

      setStage(STAGES.DONE);
    } catch (err) {
      setBatchError(err.message);
      setStage(STAGES.PARSED);
    }
  }

  function downloadResults() {
    const outputRows = buildOutputRows(results);
    const csv = rowsToCsv(OUTPUT_HEADERS, outputRows);
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    downloadCsv(`vaaligard-batch-results-${stamp}.csv`, csv);
  }

  function reset() {
    setStage(STAGES.IDLE);
    setFileName("");
    setFile(null);
    setRawRows([]);
    setResults([]);
    setParseError("");
    setBatchError("");
    setUploadPct(0);
  }

  const successCount = results.filter((r) => !r.error).length;
  const errorCount = results.filter((r) => r.error).length;
  const decisionCounts = results.reduce((acc, r) => {
    if (r.response) acc[r.response.decision] = (acc[r.response.decision] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="bulk-upload">
      <div className="bulk-upload-head">
        <div>
          <h3>Batch scoring from file</h3>
          <p>Upload a CSV of transactions to score all of them at once and download the results.</p>
        </div>
        <button type="button" className="btn-secondary" onClick={downloadBulkTemplate}>
          <Icon name="download" size={14} />
          Download CSV template
        </button>
      </div>

      <div className="bulk-note">
        <Icon name="alert" size={15} color="var(--status-warning)" />
        CSV only -- exporting a real .xlsx workbook pulls in a spreadsheet-parsing
        dependency with unpatched vulnerabilities, so this reader sticks to CSV
        (which Excel and Google Sheets both open and save natively).
      </div>

      {stage === STAGES.IDLE && (
        <label
          className={"drop-zone" + (dragOver ? " over" : "")}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={onInputChange}
            hidden
          />
          <Icon name="file" size={26} color="var(--text-muted)" />
          <div>
            <strong>Click to choose a CSV file</strong> or drag one here
          </div>
          <span className="drop-zone-hint">Expected columns match the downloadable template above.</span>
        </label>
      )}

      {parseError && (
        <div className="bulk-note error">
          <Icon name="alert" size={15} color="var(--status-critical)" />
          {parseError}
        </div>
      )}

      {stage === STAGES.PARSED && (
        <div className="bulk-ready">
          <div className="bulk-file-info">
            <Icon name="file" size={18} color="var(--brand)" />
            <div>
              <strong>{fileName}</strong>
              <span>{rawRows.length.toLocaleString()} row{rawRows.length === 1 ? "" : "s"} detected</span>
            </div>
          </div>

          {batchError && (
            <div className="bulk-note error">
              <Icon name="alert" size={15} color="var(--status-critical)" />
              {batchError}
            </div>
          )}

          <div className="bulk-preview">
            <div className="bulk-preview-head">
              <h4>Preview</h4>
              <span>
                Showing {previewRows.length.toLocaleString()} of {rawRows.length.toLocaleString()} row
                {rawRows.length === 1 ? "" : "s"} -- required fields left blank are highlighted.
              </span>
            </div>
            <div className="bulk-preview-scroll">
              <table className="bulk-preview-table">
                <thead>
                  <tr>
                    <th>#</th>
                    {previewHeaders.map((h) => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, i) => (
                    <tr key={i}>
                      <td className="tabular">{i + 2}</td>
                      {previewHeaders.map((h) => {
                        const missing = REQUIRED_HEADERS.includes(h) && !String(row[h] ?? "").trim();
                        return (
                          <td key={h} className={missing ? "cell-missing" : undefined}>
                            {missing ? "--" : row[h]}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bulk-actions">
            <button type="button" className="btn-secondary" onClick={reset}>
              Choose a different file
            </button>
            <button type="button" className="btn-primary" onClick={runBatch}>
              Run batch scoring
            </button>
          </div>
        </div>
      )}

      {stage === STAGES.PROCESSING && (
        <div className="bulk-progress">
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${uploadPct}%` }} />
          </div>
          <span className="tabular">
            {uploadPct < 100 ? `Uploading… ${uploadPct}%` : "Scoring transactions on the server…"}
          </span>
        </div>
      )}

      {stage === STAGES.DONE && (
        <div className="bulk-results">
          <div className="bulk-summary">
            <div className="bulk-stat">
              <span className="bulk-stat-value tabular">{results.length.toLocaleString()}</span>
              <span className="bulk-stat-label">Rows processed</span>
            </div>
            <div className="bulk-stat">
              <span className="bulk-stat-value tabular" style={{ color: "var(--status-good)" }}>
                {successCount.toLocaleString()}
              </span>
              <span className="bulk-stat-label">Scored</span>
            </div>
            <div className="bulk-stat">
              <span
                className="bulk-stat-value tabular"
                style={errorCount > 0 ? { color: "var(--status-critical)" } : undefined}
              >
                {errorCount.toLocaleString()}
              </span>
              <span className="bulk-stat-label">Failed validation</span>
            </div>
          </div>

          {Object.keys(decisionCounts).length > 0 && (
            <div className="bulk-decision-chips">
              {Object.entries(decisionCounts).map(([decision, count]) => (
                <div className="bulk-decision-chip" key={decision}>
                  <DecisionBadge decision={decision} size="sm" />
                  <span className="tabular">{count}</span>
                </div>
              ))}
            </div>
          )}

          <div className="bulk-actions">
            <button type="button" className="btn-secondary" onClick={reset}>
              Process another file
            </button>
            <button type="button" className="btn-primary" onClick={downloadResults}>
              <Icon name="download" size={14} />
              Download results CSV
            </button>
          </div>

          {errorCount > 0 && (
            <details className="bulk-errors">
              <summary>
                {errorCount} row{errorCount === 1 ? "" : "s"} failed validation -- not scored
              </summary>
              <ul>
                {results
                  .filter((r) => r.error)
                  .slice(0, 50)
                  .map((r) => (
                    <li key={r.rowIndex}>
                      <span className="mono">Row {r.rowIndex + 2}</span>: {r.error}
                    </li>
                  ))}
              </ul>
              {errorCount > 50 && <p className="bulk-errors-more">…and {errorCount - 50} more. See the downloaded CSV's `error` column for the full list.</p>}
            </details>
          )}
        </div>
      )}
    </div>
  );
}
