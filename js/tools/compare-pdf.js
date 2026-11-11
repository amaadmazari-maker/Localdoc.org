/**
 * localdoc.org — Smart PDF & Contract Agreement Comparison Engine
 * 100% Client-Side In-Browser RAM Processing (js/tools/compare-pdf.js)
 */

(function () {
  'use strict';

  // State Management
  const state = {
    docA: { name: '', text: '', pageCount: 0, pages: [] },
    docB: { name: '', text: '', pageCount: 0, pages: [] },
    diffResult: null,
    riskAnalysis: null,
    viewMode: 'split',      // 'split' or 'unified'
    activeFilter: 'all'     // 'all', 'risk', 'financial', 'date', 'clause'
  };

  // High-Risk Legal Keywords Ontology
  const LEGAL_KEYWORDS = {
    liability: {
      label: 'Limitation of Liability',
      color: '#DC2626',
      terms: ['liability', 'limitation of liability', 'consequential damages', 'indirect damages', 'aggregate liability', 'sole remedy', 'cap on damages', 'disclaimer of warranties']
    },
    termination: {
      label: 'Termination & Cancellation',
      color: '#D97706',
      terms: ['terminate', 'termination', 'cancellation', 'notice period', 'cure period', 'material breach', 'for convenience', 'for cause', 'expiry']
    },
    indemnity: {
      label: 'Indemnification & Hold Harmless',
      color: '#B91C1C',
      terms: ['indemnify', 'indemnification', 'hold harmless', 'defend', 'third-party claim', 'losses and liabilities']
    },
    penalties: {
      label: 'Penalties & Liquidated Damages',
      color: '#EA580C',
      terms: ['liquidated damages', 'penalty', 'late fee', 'default interest', 'forfeiture', 'withholding', 'punitive']
    },
    jurisdiction: {
      label: 'Governing Law & Jurisdiction',
      color: '#4F46E5',
      terms: ['governing law', 'jurisdiction', 'venue', 'arbitration', 'dispute resolution', 'courts of', 'binding arbitration']
    },
    confidentiality: {
      label: 'Confidentiality & Non-Compete',
      color: '#7C3AED',
      terms: ['confidential', 'non-disclosure', 'trade secret', 'non-compete', 'non-solicitation', 'proprietary information']
    }
  };

  // Regex Patterns for Numbers, Money, and Dates
  const PATTERNS = {
    financial: /\b(?:\$|€|£|Rs\.?|USD|EUR|GBP|¥)?\s*\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?\s*(?:%|percent|dollars|euros|cents|per month|per annum|per year|retainer|fee|salary)?\b/gi,
    dates: /\b(?:\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember))\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}|\b\d+\s+(?:calendar days|business days|days|months|years|weeks|hours|minutes)\b)\b/gi
  };

  // Extract Text from PDF File using in-browser pdf.js
  async function extractTextFromPDF(file) {
    if (typeof pdfjsLib === 'undefined') {
      throw new Error('PDF processing engine is initializing. Please wait a moment and try again.');
    }

    pdfjsLib.GlobalWorkerOptions.workerSrc = '../js/lib/pdf.worker.min.js';
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer, isEvalSupported: false }).promise;

    const pageCount = pdf.numPages;
    const pages = [];
    let fullText = '';

    for (let i = 1; i <= pageCount; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(' ');
      pages.push({ pageNumber: i, text: pageText });
      fullText += `--- Page ${i} ---\n` + pageText + '\n\n';
    }

    return {
      name: file.name,
      pageCount,
      pages,
      text: fullText.trim()
    };
  }

  // Extract Text from Word (DOCX) using mammoth.js if available
  async function extractTextFromDocx(file) {
    if (typeof mammoth !== 'undefined') {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      return {
        name: file.name,
        pageCount: 1,
        pages: [{ pageNumber: 1, text: result.value }],
        text: result.value.trim()
      };
    }
    // Fallback: read as plain text
    const text = await file.text();
    return { name: file.name, pageCount: 1, pages: [{ pageNumber: 1, text }], text: text.trim() };
  }

  // General File Text Extractor
  async function extractFileText(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext === 'pdf') {
      return await extractTextFromPDF(file);
    } else if (ext === 'docx') {
      return await extractTextFromDocx(file);
    } else {
      // Plain text, markdown, CSV, or code
      const text = await file.text();
      return {
        name: file.name,
        pageCount: 1,
        pages: [{ pageNumber: 1, text }],
        text: text.trim()
      };
    }
  }

  // Lightweight Myers Longest Common Subsequence (LCS) Diff Algorithm
  function computeLineDiff(textA, textB) {
    const linesA = textA.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    const linesB = textB.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);

    const matrix = [];
    for (let i = 0; i <= linesA.length; i++) {
      matrix[i] = new Array(linesB.length + 1).fill(0);
    }

    for (let i = 1; i <= linesA.length; i++) {
      for (let j = 1; j <= linesB.length; j++) {
        if (linesA[i - 1] === linesB[j - 1]) {
          matrix[i][j] = matrix[i - 1][j - 1] + 1;
        } else {
          matrix[i][j] = Math.max(matrix[i - 1][j], matrix[i][j - 1]);
        }
      }
    }

    // Backtrack to generate diff items
    let i = linesA.length;
    let j = linesB.length;
    const diff = [];

    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && linesA[i - 1] === linesB[j - 1]) {
        diff.unshift({ type: 'equal', text: linesA[i - 1], lineA: i, lineB: j });
        i--;
        j--;
      } else if (j > 0 && (i === 0 || matrix[i][j - 1] >= matrix[i - 1][j])) {
        diff.unshift({ type: 'add', text: linesB[j - 1], lineB: j });
        j--;
      } else if (i > 0 && (j === 0 || matrix[i][j - 1] < matrix[i - 1][j])) {
        diff.unshift({ type: 'delete', text: linesA[i - 1], lineA: i });
        i--;
      }
    }

    return diff;
  }

  // Word-level diff generator for modified segments
  function computeWordDiff(strA, strB) {
    const wordsA = strA.split(/(\s+)/);
    const wordsB = strB.split(/(\s+)/);
    // Simple inline matching
    const res = [];
    const setA = new Set(wordsA.filter(w => w.trim().length > 0));
    const setB = new Set(wordsB.filter(w => w.trim().length > 0));

    return {
      deletedWords: wordsA.filter(w => w.trim().length > 0 && !setB.has(w)),
      addedWords: wordsB.filter(w => w.trim().length > 0 && !setA.has(w))
    };
  }

  // Smart Heuristic Risk Analyzer (Financial, Dates, Legal Clauses)
  function analyzeRisks(diffItems, docA, docB) {
    const risks = {
      financial: [],
      dates: [],
      clauses: [],
      summary: {
        totalAdditions: 0,
        totalDeletions: 0,
        totalUnchanged: 0,
        pageDiscrepancy: docB.pageCount - docA.pageCount
      }
    };

    diffItems.forEach((item, index) => {
      const text = item.text || '';
      const lower = text.toLowerCase();

      if (item.type === 'add') {
        risks.summary.totalAdditions++;
      } else if (item.type === 'delete') {
        risks.summary.totalDeletions++;
      } else {
        risks.summary.totalUnchanged++;
      }

      if (item.type === 'equal') return;

      // 1. Scan for Financial & Monetary changes
      const moneyMatches = text.match(PATTERNS.financial);
      if (moneyMatches && moneyMatches.length > 0) {
        risks.financial.push({
          diffIndex: index,
          type: item.type,
          matches: moneyMatches,
          snippet: text.length > 120 ? text.substring(0, 120) + '...' : text
        });
        item.hasFinancialRisk = true;
      }

      // 2. Scan for Dates & Deadline Shifts
      const dateMatches = text.match(PATTERNS.dates);
      if (dateMatches && dateMatches.length > 0) {
        risks.dates.push({
          diffIndex: index,
          type: item.type,
          matches: dateMatches,
          snippet: text.length > 120 ? text.substring(0, 120) + '...' : text
        });
        item.hasDateRisk = true;
      }

      // 3. Scan for High-Risk Legal Clauses
      for (const [key, category] of Object.entries(LEGAL_KEYWORDS)) {
        const foundTerms = category.terms.filter(term => lower.includes(term));
        if (foundTerms.length > 0) {
          risks.clauses.push({
            diffIndex: index,
            categoryKey: key,
            categoryLabel: category.label,
            color: category.color,
            terms: foundTerms,
            type: item.type,
            snippet: text.length > 140 ? text.substring(0, 140) + '...' : text
          });
          item.hasClauseRisk = true;
          item.clauseRiskCategory = category.label;
          break;
        }
      }
    });

    return risks;
  }

  // Render Visual Diff and Risk Dashboard
  function renderResults() {
    const resultsContainer = document.getElementById('diff-results-container');
    const riskSummaryRow = document.getElementById('risk-summary-row');
    const riskPillsContainer = document.getElementById('risk-pills-container');
    const diffSplitWrap = document.getElementById('diff-split-wrap');
    const diffUnifiedWrap = document.getElementById('diff-unified-wrap');

    if (!resultsContainer || !state.diffResult || !state.riskAnalysis) return;

    resultsContainer.style.display = 'block';
    resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });

    const risks = state.riskAnalysis;
    const diff = state.diffResult;

    // 1. Metric Badges
    const badgeAdd = document.getElementById('badge-additions');
    const badgeDel = document.getElementById('badge-deletions');
    const badgeRisk = document.getElementById('badge-risk-count');
    const badgePages = document.getElementById('badge-pages-info');

    if (badgeAdd) badgeAdd.textContent = `+${risks.summary.totalAdditions} Added`;
    if (badgeDel) badgeDel.textContent = `-${risks.summary.totalDeletions} Removed`;
    
    const totalRisks = risks.financial.length + risks.dates.length + risks.clauses.length;
    if (badgeRisk) {
      badgeRisk.textContent = `${totalRisks} Critical Alerts`;
      badgeRisk.className = totalRisks > 0 ? 'metric-badge metric-danger' : 'metric-badge metric-success';
    }

    if (badgePages) {
      const pDiff = risks.summary.pageDiscrepancy;
      if (pDiff === 0) {
        badgePages.textContent = `Same Page Count (${state.docA.pageCount} pgs)`;
      } else {
        badgePages.textContent = `Page Count Discrepancy (${state.docA.pageCount} vs ${state.docB.pageCount} pgs)`;
      }
    }

    // 2. Risk Alerts Quick Jump Pills
    if (riskPillsContainer) {
      if (totalRisks === 0) {
        riskPillsContainer.innerHTML = `
          <div class="risk-clean-notice">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
            <span>No high-risk clause, monetary, or deadline shifts detected between these versions.</span>
          </div>
        `;
      } else {
        const pillsHtml = [];

        risks.financial.forEach((f, i) => {
          pillsHtml.push(`
            <button type="button" class="risk-jump-pill pill-financial" onclick="window.jumpToDiff(${f.diffIndex})">
              💰 Financial: ${f.matches.join(', ')} (${f.type === 'add' ? 'Added' : 'Removed'})
            </button>
          `);
        });

        risks.dates.forEach((d, i) => {
          pillsHtml.push(`
            <button type="button" class="risk-jump-pill pill-date" onclick="window.jumpToDiff(${d.diffIndex})">
              📅 Date/Timeline: ${d.matches.join(', ')} (${d.type === 'add' ? 'Added' : 'Removed'})
            </button>
          `);
        });

        risks.clauses.forEach((c, i) => {
          pillsHtml.push(`
            <button type="button" class="risk-jump-pill pill-clause" onclick="window.jumpToDiff(${c.diffIndex})">
              ⚖️ ${c.categoryLabel} (${c.type === 'add' ? 'Added' : 'Altered'})
            </button>
          `);
        });

        riskPillsContainer.innerHTML = pillsHtml.join('');
      }
    }

    // 3. Render Side-by-Side (Split) View
    let colAHtml = '';
    let colBHtml = '';
    let unifiedHtml = '';

    diff.forEach((item, idx) => {
      let isVisible = true;
      if (state.activeFilter === 'risk') {
        isVisible = item.hasFinancialRisk || item.hasDateRisk || item.hasClauseRisk;
      } else if (state.activeFilter === 'financial') {
        isVisible = !!item.hasFinancialRisk;
      } else if (state.activeFilter === 'date') {
        isVisible = !!item.hasDateRisk;
      } else if (state.activeFilter === 'clause') {
        isVisible = !!item.hasClauseRisk;
      }

      if (!isVisible) return;

      const riskFlagBadge = item.hasClauseRisk 
        ? `<span class="inline-risk-badge badge-clause">⚖️ ${item.clauseRiskCategory || 'Clause Risk'}</span>`
        : (item.hasFinancialRisk ? `<span class="inline-risk-badge badge-finance">💰 Payment Shift</span>` : (item.hasDateRisk ? `<span class="inline-risk-badge badge-date">📅 Deadline Shift</span>` : ''));

      if (item.type === 'equal') {
        colAHtml += `<div class="diff-line diff-equal" id="diff-line-a-${idx}"><span class="line-num">${item.lineA}</span><span class="line-content">${escapeHtml(item.text)}</span></div>`;
        colBHtml += `<div class="diff-line diff-equal" id="diff-line-b-${idx}"><span class="line-num">${item.lineB}</span><span class="line-content">${escapeHtml(item.text)}</span></div>`;
        unifiedHtml += `<div class="diff-line diff-equal"><span class="line-marker">&nbsp;</span><span class="line-content">${escapeHtml(item.text)}</span></div>`;
      } else if (item.type === 'delete') {
        colAHtml += `<div class="diff-line diff-delete" id="diff-line-a-${idx}">${riskFlagBadge}<span class="line-num">${item.lineA || '-'}</span><span class="line-content"><del>${escapeHtml(item.text)}</del></span></div>`;
        colBHtml += `<div class="diff-line diff-placeholder" id="diff-line-b-${idx}"><span class="line-num">&nbsp;</span><span class="line-content">&nbsp;</span></div>`;
        unifiedHtml += `<div class="diff-line diff-delete" id="diff-line-u-${idx}">${riskFlagBadge}<span class="line-marker">-</span><span class="line-content"><del>${escapeHtml(item.text)}</del></span></div>`;
      } else if (item.type === 'add') {
        colAHtml += `<div class="diff-line diff-placeholder" id="diff-line-a-${idx}"><span class="line-num">&nbsp;</span><span class="line-content">&nbsp;</span></div>`;
        colBHtml += `<div class="diff-line diff-add" id="diff-line-b-${idx}">${riskFlagBadge}<span class="line-num">${item.lineB || '+'}</span><span class="line-content"><ins>${escapeHtml(item.text)}</ins></span></div>`;
        unifiedHtml += `<div class="diff-line diff-add" id="diff-line-u-${idx}">${riskFlagBadge}<span class="line-marker">+</span><span class="line-content"><ins>${escapeHtml(item.text)}</ins></span></div>`;
      }
    });

    const splitColA = document.getElementById('diff-col-a');
    const splitColB = document.getElementById('diff-col-b');

    if (splitColA) splitColA.innerHTML = colAHtml;
    if (splitColB) splitColB.innerHTML = colBHtml;
    if (diffUnifiedWrap) diffUnifiedWrap.innerHTML = unifiedHtml;

    updateViewModeDisplay();
  }

  function updateViewModeDisplay() {
    const diffSplitWrap = document.getElementById('diff-split-wrap');
    const diffUnifiedWrap = document.getElementById('diff-unified-wrap');
    if (!diffSplitWrap || !diffUnifiedWrap) return;

    if (state.viewMode === 'split') {
      diffSplitWrap.style.display = 'grid';
      diffUnifiedWrap.style.display = 'none';
    } else {
      diffSplitWrap.style.display = 'none';
      diffUnifiedWrap.style.display = 'block';
    }
  }

  // Global Jump to Diff function for pill clicks
  window.jumpToDiff = function (diffIndex) {
    const elA = document.getElementById(`diff-line-a-${diffIndex}`);
    const elB = document.getElementById(`diff-line-b-${diffIndex}`);
    const elU = document.getElementById(`diff-line-u-${diffIndex}`);

    const target = state.viewMode === 'split' ? (elB || elA) : elU;
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target.classList.add('diff-highlight-flash');
      setTimeout(() => target.classList.remove('diff-highlight-flash'), 2500);
    }
  };

  function escapeHtml(str) {
    if (typeof str !== 'string') return String(str || '');
    return str.replace(/[&<>"']/g, match => {
      switch (match) {
        case '&': return '&amp;';
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '"': return '&quot;';
        case "'": return '&#39;';
        default: return match;
      }
    });
  }

  // Synchronized Scrolling for Split View
  function setupSynchronizedScroll() {
    const colA = document.getElementById('diff-col-a');
    const colB = document.getElementById('diff-col-b');
    if (!colA || !colB) return;

    let isSyncingA = false;
    let isSyncingB = false;

    colA.addEventListener('scroll', () => {
      if (!isSyncingA) {
        isSyncingB = true;
        colB.scrollTop = colA.scrollTop;
      }
      isSyncingA = false;
    });

    colB.addEventListener('scroll', () => {
      if (!isSyncingB) {
        isSyncingA = true;
        colA.scrollTop = colB.scrollTop;
      }
      isSyncingB = false;
    });
  }

  // Export Audit Report (Text Summary)
  function exportAuditReport() {
    if (!state.diffResult || !state.riskAnalysis) {
      if (window.UIUtils) UIUtils.showToast('Please compare two documents first', 'warning');
      return;
    }

    const risks = state.riskAnalysis;
    const docA = state.docA;
    const docB = state.docB;

    let report = `=================================================================\n`;
    report += `LOCALDOC SMART CONTRACT & PDF COMPARISON AUDIT REPORT\n`;
    report += `Generated: ${new Date().toLocaleString()} (100% In-Browser Private Diff)\n`;
    report += `=================================================================\n\n`;
    report += `ORIGINAL FILE: ${docA.name || 'Document A'} (${docA.pageCount} Pages)\n`;
    report += `MODIFIED FILE: ${docB.name || 'Document B'} (${docB.pageCount} Pages)\n`;
    report += `PAGE DISCREPANCY: ${risks.summary.pageDiscrepancy >= 0 ? '+' : ''}${risks.summary.pageDiscrepancy} Page(s)\n`;
    report += `TOTAL ADDITIONS: ${risks.summary.totalAdditions} Lines\n`;
    report += `TOTAL REMOVALS:  ${risks.summary.totalDeletions} Lines\n\n`;

    report += `-----------------------------------------------------------------\n`;
    report += `1. FINANCIAL & MONETARY CHANGES DETECTED (${risks.financial.length})\n`;
    report += `-----------------------------------------------------------------\n`;
    if (risks.financial.length === 0) {
      report += `No monetary or payment shifts found.\n\n`;
    } else {
      risks.financial.forEach((f, i) => {
        report += `[#${i + 1}] (${f.type.toUpperCase()}) ${f.matches.join(', ')}\n`;
        report += `    Context: "${f.snippet}"\n\n`;
      });
    }

    report += `-----------------------------------------------------------------\n`;
    report += `2. DATE, DEADLINE & NOTICE PERIOD SHIFTS (${risks.dates.length})\n`;
    report += `-----------------------------------------------------------------\n`;
    if (risks.dates.length === 0) {
      report += `No timeline or notice shifts found.\n\n`;
    } else {
      risks.dates.forEach((d, i) => {
        report += `[#${i + 1}] (${d.type.toUpperCase()}) ${d.matches.join(', ')}\n`;
        report += `    Context: "${d.snippet}"\n\n`;
      });
    }

    report += `-----------------------------------------------------------------\n`;
    report += `3. HIGH-RISK LEGAL CLAUSE ALTERATIONS (${risks.clauses.length})\n`;
    report += `-----------------------------------------------------------------\n`;
    if (risks.clauses.length === 0) {
      report += `No critical clause alterations found.\n\n`;
    } else {
      risks.clauses.forEach((c, i) => {
        report += `[#${i + 1}] ${c.categoryLabel} (${c.type.toUpperCase()})\n`;
        report += `    Trigger Terms: [${c.terms.join(', ')}]\n`;
        report += `    Context: "${c.snippet}"\n\n`;
      });
    }

    report += `=================================================================\n`;
    report += `Report generated 100% locally on LocalDoc (zero server uploads).\n`;
    report += `Verify all legal revisions before signing.\n`;

    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contract-comparison-audit-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    if (window.UIUtils) UIUtils.showToast('Audit report downloaded successfully!', 'success');
  }

  // Initialize UI & Event Handlers
  function initComparePdfTool() {
    // Dropzone A
    const dropZoneA = document.getElementById('dropzone-a');
    const fileInputA = document.getElementById('file-input-a');
    const fileInfoA = document.getElementById('file-info-a');
    const fileNameA = document.getElementById('file-name-a');

    // Dropzone B
    const dropZoneB = document.getElementById('dropzone-b');
    const fileInputB = document.getElementById('file-input-b');
    const fileInfoB = document.getElementById('file-info-b');
    const fileNameB = document.getElementById('file-name-b');

    // Controls
    const compareBtn = document.getElementById('compare-run-btn');
    const resetBtn = document.getElementById('compare-reset-btn');
    const exportBtn = document.getElementById('export-audit-btn');

    // View & Filter Buttons
    const viewSplitBtn = document.getElementById('view-mode-split');
    const viewUnifiedBtn = document.getElementById('view-mode-unified');
    const filterButtons = document.querySelectorAll('.diff-filter-btn');

    // Setup Dropzone A
    if (dropZoneA && fileInputA) {
      dropZoneA.addEventListener('click', () => fileInputA.click());
      dropZoneA.addEventListener('dragover', (e) => { e.preventDefault(); dropZoneA.classList.add('dragover'); });
      dropZoneA.addEventListener('dragleave', () => dropZoneA.classList.remove('dragover'));
      dropZoneA.addEventListener('drop', async (e) => {
        e.preventDefault();
        dropZoneA.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) handleFileA(e.dataTransfer.files[0]);
      });
      fileInputA.addEventListener('change', (e) => {
        if (e.target.files.length > 0) handleFileA(e.target.files[0]);
      });
    }

    // Setup Dropzone B
    if (dropZoneB && fileInputB) {
      dropZoneB.addEventListener('click', () => fileInputB.click());
      dropZoneB.addEventListener('dragover', (e) => { e.preventDefault(); dropZoneB.classList.add('dragover'); });
      dropZoneB.addEventListener('dragleave', () => dropZoneB.classList.remove('dragover'));
      dropZoneB.addEventListener('drop', async (e) => {
        e.preventDefault();
        dropZoneB.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) handleFileB(e.dataTransfer.files[0]);
      });
      fileInputB.addEventListener('change', (e) => {
        if (e.target.files.length > 0) handleFileB(e.target.files[0]);
      });
    }

    async function handleFileA(file) {
      try {
        if (window.UIUtils) UIUtils.showToast(`Loading ${file.name}...`, 'info');
        state.docA = await extractFileText(file);
        if (fileNameA && fileInfoA && dropZoneA) {
          fileNameA.textContent = `${file.name} (${state.docA.pageCount} pgs)`;
          fileInfoA.style.display = 'flex';
          dropZoneA.classList.add('file-loaded');
        }
        checkReadyToCompare();
      } catch (err) {
        console.error('File A load error:', err);
        if (window.UIUtils) UIUtils.showToast(err.message || 'Failed to read Document A', 'error');
      }
    }

    async function handleFileB(file) {
      try {
        if (window.UIUtils) UIUtils.showToast(`Loading ${file.name}...`, 'info');
        state.docB = await extractFileText(file);
        if (fileNameB && fileInfoB && dropZoneB) {
          fileNameB.textContent = `${file.name} (${state.docB.pageCount} pgs)`;
          fileInfoB.style.display = 'flex';
          dropZoneB.classList.add('file-loaded');
        }
        checkReadyToCompare();
      } catch (err) {
        console.error('File B load error:', err);
        if (window.UIUtils) UIUtils.showToast(err.message || 'Failed to read Document B', 'error');
      }
    }

    function checkReadyToCompare() {
      if (compareBtn) {
        const ready = !!(state.docA.text && state.docB.text);
        compareBtn.disabled = !ready;
        if (ready) {
          compareBtn.classList.add('pulse-ready');
        }
      }
    }

    // Run Comparison
    if (compareBtn) {
      compareBtn.addEventListener('click', function () {
        if (!state.docA.text || !state.docB.text) {
          if (window.UIUtils) UIUtils.showToast('Please select both documents first', 'warning');
          return;
        }

        try {
          compareBtn.disabled = true;
          if (window.UIUtils) UIUtils.showToast('Comparing documents & analyzing clauses...', 'info');

          // Compute Diff
          state.diffResult = computeLineDiff(state.docA.text, state.docB.text);
          state.riskAnalysis = analyzeRisks(state.diffResult, state.docA, state.docB);

          renderResults();
          setupSynchronizedScroll();

          if (window.UIUtils) UIUtils.showToast('Comparison completed!', 'success');
        } catch (err) {
          console.error('Diff error:', err);
          if (window.UIUtils) UIUtils.showToast('Comparison failed: ' + err.message, 'error');
        } finally {
          compareBtn.disabled = false;
        }
      });
    }

    // Reset Tool
    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        state.docA = { name: '', text: '', pageCount: 0, pages: [] };
        state.docB = { name: '', text: '', pageCount: 0, pages: [] };
        state.diffResult = null;
        state.riskAnalysis = null;

        if (fileInfoA) fileInfoA.style.display = 'none';
        if (fileInfoB) fileInfoB.style.display = 'none';
        if (dropZoneA) dropZoneA.classList.remove('file-loaded');
        if (dropZoneB) dropZoneB.classList.remove('file-loaded');
        if (compareBtn) compareBtn.disabled = true;

        const resultsContainer = document.getElementById('diff-results-container');
        if (resultsContainer) resultsContainer.style.display = 'none';

        if (window.UIUtils) UIUtils.showToast('Comparison workspace reset', 'info');
      });
    }

    // Export Button
    if (exportBtn) {
      exportBtn.addEventListener('click', exportAuditReport);
    }

    // View Mode Switcher
    if (viewSplitBtn && viewUnifiedBtn) {
      viewSplitBtn.addEventListener('click', () => {
        state.viewMode = 'split';
        viewSplitBtn.classList.add('active');
        viewUnifiedBtn.classList.remove('active');
        updateViewModeDisplay();
      });

      viewUnifiedBtn.addEventListener('click', () => {
        state.viewMode = 'unified';
        viewUnifiedBtn.classList.add('active');
        viewSplitBtn.classList.remove('active');
        updateViewModeDisplay();
      });
    }

    // Diff Filters
    filterButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        filterButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.activeFilter = btn.getAttribute('data-filter') || 'all';
        renderResults();
      });
    });

    // Sample Contract Demo Button
    const demoBtn = document.getElementById('load-sample-demo-btn');
    if (demoBtn) {
      demoBtn.addEventListener('click', function () {
        state.docA = {
          name: 'Vendor_Agreement_v1.pdf',
          pageCount: 3,
          text: `Section 1. Scope of Services\nVendor agrees to provide document scanning, OCR parsing, and PDF optimization services.\n\nSection 2. Compensation & Retainer\nClient shall pay Vendor a monthly retainer of $5,000.00 USD within 30 calendar days of invoice.\n\nSection 3. Mutual Indemnification\nEach party shall indemnify, defend, and hold harmless the other party from any third-party claims.\n\nSection 4. Term and Termination\nEither party may terminate this Agreement without cause upon sixty (60) days prior written notice.`
        };

        state.docB = {
          name: 'Vendor_Agreement_v2_REVISED.pdf',
          pageCount: 4,
          text: `Section 1. Scope of Services\nVendor agrees to provide document scanning, OCR parsing, and PDF optimization services with 24/7 dedicated support.\n\nSection 2. Compensation & Retainer\nClient shall pay Vendor a monthly retainer of $7,500.00 USD within 15 calendar days of invoice.\n\nSection 3. Unilateral Indemnification\nClient shall indemnify, defend, and hold harmless Vendor against all claims, damages, losses, and legal costs.\n\nSection 4. Term and Termination\nVendor may terminate this Agreement immediately upon written notice; Client must give ninety (90) days prior notice.\n\nAppendix A. Penalty Surcharge\nA late fee penalty of 5% per month will be assessed on outstanding balances.`
        };

        if (fileNameA && fileInfoA && dropZoneA) {
          fileNameA.textContent = `${state.docA.name} (${state.docA.pageCount} pgs)`;
          fileInfoA.style.display = 'flex';
          dropZoneA.classList.add('file-loaded');
        }
        if (fileNameB && fileInfoB && dropZoneB) {
          fileNameB.textContent = `${state.docB.name} (${state.docB.pageCount} pgs)`;
          fileInfoB.style.display = 'flex';
          dropZoneB.classList.add('file-loaded');
        }

        checkReadyToCompare();
        if (window.UIUtils) UIUtils.showToast('Sample revised contract loaded! Click "Compare Documents" to run analysis.', 'success');
      });
    }
  }

  // Register on DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initComparePdfTool);
  } else {
    initComparePdfTool();
  }
})();
