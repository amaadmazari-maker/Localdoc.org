/**
 * localdoc.org — Invisible Character & Blank Text Generator Engine
 * 100% Client-Side In-Browser RAM Processing (js/tools/invisible-character.js)
 */

(function () {
  'use strict';

  // Unicode Character Constants
  const UNICODE_CHARS = {
    hangulFiller: '\u3164',         // U+3164 (Hangul Filler - best for Discord & Gaming)
    zeroWidthSpace: '\u200B',       // U+200B (Zero-Width Space - best for WhatsApp)
    ltrMark: '\u200E',              // U+200E (Left-to-Right Mark)
    brailleBlank: '\u2800',         // U+2800 (Braille Pattern Blank)
    zwnj: '\u200C',                 // U+200C (Zero-Width Non-Joiner)
    zwj: '\u200D',                  // U+200D (Zero-Width Joiner)
    nbsp: '\u00A0'                  // U+00A0 (Non-Breaking Space)
  };

  // Safe Clipboard Copy Helper with Fallback
  async function copyToClipboard(text, successMessage = 'Copied to clipboard!') {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback for non-HTTPS or legacy environments
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        if (!successful) throw new Error('execCommand failed');
      }

      if (window.UIUtils && typeof UIUtils.triggerHaptic === 'function') {
        UIUtils.triggerHaptic(25);
      }

      if (window.UIUtils && typeof UIUtils.showToast === 'function') {
        UIUtils.showToast(successMessage, 'success');
      }

      return true;
    } catch (err) {
      console.error('Clipboard copy error:', err);
      if (window.UIUtils && typeof UIUtils.showToast === 'function') {
        UIUtils.showToast('Please copy manually (clipboard permission denied)', 'warning');
      }
      return false;
    }
  }

  // Button Animation Feedback
  function animateButtonSuccess(btn, originalText) {
    if (!btn) return;
    const originalHtml = btn.innerHTML;
    btn.classList.add('btn-copied');
    btn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
      <span>Copied!</span>
    `;
    setTimeout(() => {
      btn.innerHTML = originalHtml;
      btn.classList.remove('btn-copied');
    }, 2000);
  }

  // Unicode Inspector Logic for Live Testing Box
  function inspectText(text) {
    if (!text || text.length === 0) {
      return {
        status: 'empty',
        message: 'Nothing pasted yet. Click "Copy" on any card above and paste here to verify.',
        details: []
      };
    }

    let invisibleCount = 0;
    let visibleCount = 0;
    const detectedTypes = new Set();
    const codepoints = [];

    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      const hex = 'U+' + code.toString(16).toUpperCase().padStart(4, '0');

      if (code === 0x3164) {
        invisibleCount++;
        detectedTypes.add('Hangul Filler (U+3164)');
        codepoints.push({ char: text[i], hex, name: 'Hangul Filler (Discord & Games)' });
      } else if (code === 0x200B) {
        invisibleCount++;
        detectedTypes.add('Zero-Width Space (U+200B)');
        codepoints.push({ char: text[i], hex, name: 'Zero-Width Space (WhatsApp)' });
      } else if (code === 0x2800) {
        invisibleCount++;
        detectedTypes.add('Braille Blank (U+2800)');
        codepoints.push({ char: text[i], hex, name: 'Braille Pattern Blank' });
      } else if (code === 0x200E || code === 0x200F) {
        invisibleCount++;
        detectedTypes.add('Directional Mark (LTR/RTL)');
        codepoints.push({ char: text[i], hex, name: 'Directional Control Mark' });
      } else if (code === 0x200C || code === 0x200D) {
        invisibleCount++;
        detectedTypes.add('Zero-Width Joiner/Non-Joiner');
        codepoints.push({ char: text[i], hex, name: 'Zero-Width Format Control' });
      } else if (code === 0x00A0) {
        invisibleCount++;
        detectedTypes.add('Non-Breaking Space (U+00A0)');
        codepoints.push({ char: text[i], hex, name: 'Non-Breaking Space' });
      } else if (code === 0x0020 || code === 0x0009 || code === 0x000A || code === 0x000D) {
        // Standard whitespace
        codepoints.push({ char: text[i], hex, name: 'Standard Whitespace / Line Break' });
      } else {
        visibleCount++;
        codepoints.push({ char: text[i], hex, name: 'Visible Character: ' + text[i] });
      }
    }

    const byteLength = new Blob([text]).size;

    if (invisibleCount > 0 && visibleCount === 0) {
      return {
        status: 'invisible-only',
        count: invisibleCount,
        byteLength,
        types: Array.from(detectedTypes),
        message: `Success! Detected ${invisibleCount} pure invisible character(s) (${byteLength} bytes). Ready to paste!`,
        codepoints
      };
    } else if (invisibleCount > 0 && visibleCount > 0) {
      return {
        status: 'mixed',
        count: invisibleCount,
        visibleCount,
        byteLength,
        types: Array.from(detectedTypes),
        message: `Mixed text detected: ${invisibleCount} invisible character(s) and ${visibleCount} visible character(s).`,
        codepoints
      };
    } else if (visibleCount > 0) {
      return {
        status: 'visible-only',
        visibleCount,
        byteLength,
        message: `Notice: Only visible text detected (${visibleCount} characters). No invisible characters found.`,
        codepoints
      };
    } else {
      return {
        status: 'whitespace-only',
        byteLength,
        message: `Standard spacebar or line breaks detected, but no specialized invisible Unicode characters.`,
        codepoints
      };
    }
  }

  // Initialize Tool Handlers when DOM is Ready
  function initInvisibleCharacterTool() {
    // 1. WhatsApp Preset Button
    const btnWhatsapp = document.getElementById('copy-whatsapp-btn');
    if (btnWhatsapp) {
      btnWhatsapp.addEventListener('click', async function () {
        // WhatsApp trick: zero-width space + directional marker
        const text = UNICODE_CHARS.zeroWidthSpace + UNICODE_CHARS.ltrMark;
        const ok = await copyToClipboard(text, 'WhatsApp blank character copied! Paste directly in chat.');
        if (ok) animateButtonSuccess(btnWhatsapp);
      });
    }

    // 2. Invisible Name / Discord / Bio Preset Button
    const btnName = document.getElementById('copy-name-btn');
    if (btnName) {
      btnName.addEventListener('click', async function () {
        // Hangul filler is the universal standard for Discord & social names
        const text = UNICODE_CHARS.hangulFiller;
        const ok = await copyToClipboard(text, 'Invisible name copied! Paste in Discord, Steam, or Instagram.');
        if (ok) animateButtonSuccess(btnName);
      });
    }

    // 3. Gaming Space Preset Button (Free Fire / PUBG / Roblox)
    const btnGaming = document.getElementById('copy-gaming-btn');
    if (btnGaming) {
      btnGaming.addEventListener('click', async function () {
        const text = UNICODE_CHARS.hangulFiller;
        const ok = await copyToClipboard(text, 'Gaming space copied! Paste between name tags in Free Fire/PUBG.');
        if (ok) animateButtonSuccess(btnGaming);
      });
    }

    // 4. Clean Line Break / Paragraph Spacer Preset Button
    const btnParagraph = document.getElementById('copy-paragraph-btn');
    if (btnParagraph) {
      btnParagraph.addEventListener('click', async function () {
        const text = '\n' + UNICODE_CHARS.hangulFiller + '\n';
        const ok = await copyToClipboard(text, 'Clean paragraph spacer copied! Use for Instagram caption breaks.');
        if (ok) animateButtonSuccess(btnParagraph);
      });
    }

    // 5. Custom Generator Controls
    const customCountInput = document.getElementById('custom-count-input');
    const customCountRange = document.getElementById('custom-count-range');
    const customTypeSelect = document.getElementById('custom-type-select');
    const customModeSelect = document.getElementById('custom-mode-select');
    const customStatsBadge = document.getElementById('custom-stats-badge');
    const btnGenerateCustom = document.getElementById('copy-custom-btn');

    function updateCustomStats() {
      if (!customCountInput || !customStatsBadge) return;
      const count = Math.max(1, Math.min(500, parseInt(customCountInput.value, 10) || 1));
      const type = customTypeSelect ? customTypeSelect.value : 'hangul';
      const isMultiLine = customModeSelect && customModeSelect.value === 'multiline';

      let charStr = UNICODE_CHARS.hangulFiller;
      if (type === 'zws') charStr = UNICODE_CHARS.zeroWidthSpace;
      if (type === 'braille') charStr = UNICODE_CHARS.brailleBlank;
      if (type === 'nbsp') charStr = UNICODE_CHARS.nbsp;

      const fullString = isMultiLine 
        ? Array(count).fill(charStr).join('\n')
        : charStr.repeat(count);

      const byteSize = new Blob([fullString]).size;
      customStatsBadge.textContent = `${count} Space${count > 1 ? 's' : ''} • ~${byteSize} Bytes`;
    }

    if (customCountRange && customCountInput) {
      customCountRange.addEventListener('input', function () {
        customCountInput.value = customCountRange.value;
        updateCustomStats();
      });
      customCountInput.addEventListener('input', function () {
        customCountRange.value = customCountInput.value;
        updateCustomStats();
      });
    }

    if (customTypeSelect) customTypeSelect.addEventListener('change', updateCustomStats);
    if (customModeSelect) customModeSelect.addEventListener('change', updateCustomStats);

    if (btnGenerateCustom) {
      btnGenerateCustom.addEventListener('click', async function () {
        const count = Math.max(1, Math.min(500, parseInt(customCountInput.value, 10) || 1));
        const type = customTypeSelect ? customTypeSelect.value : 'hangul';
        const isMultiLine = customModeSelect && customModeSelect.value === 'multiline';

        let charStr = UNICODE_CHARS.hangulFiller;
        if (type === 'zws') charStr = UNICODE_CHARS.zeroWidthSpace;
        if (type === 'braille') charStr = UNICODE_CHARS.brailleBlank;
        if (type === 'nbsp') charStr = UNICODE_CHARS.nbsp;

        const generatedText = isMultiLine
          ? Array(count).fill(charStr).join('\n')
          : charStr.repeat(count);

        const ok = await copyToClipboard(generatedText, `Generated & copied ${count} invisible space(s)!`);
        if (ok) animateButtonSuccess(btnGenerateCustom);
      });
    }

    // 6. Interactive Testing Box & Diagnostics
    const testInput = document.getElementById('tester-input');
    const testResultCard = document.getElementById('tester-result-card');
    const testStatusBadge = document.getElementById('tester-status-badge');
    const testMessage = document.getElementById('tester-message');
    const testDetails = document.getElementById('tester-details');
    const btnTestRun = document.getElementById('tester-run-btn');
    const btnTestClear = document.getElementById('tester-clear-btn');
    const btnTestPaste = document.getElementById('tester-paste-btn');

    function runTest() {
      if (!testInput || !testResultCard) return;
      const text = testInput.value;
      const result = inspectText(text);

      testResultCard.style.display = 'block';

      // Update badge style and message
      if (result.status === 'invisible-only') {
        testStatusBadge.className = 'tester-badge badge-success';
        testStatusBadge.textContent = '✓ Pure Invisible Characters Detected';
        testMessage.innerHTML = `<strong>Success!</strong> ${result.message} <br><span class="tester-types">Codepoints: ${result.types.join(', ')}</span>`;
      } else if (result.status === 'mixed') {
        testStatusBadge.className = 'tester-badge badge-warning';
        testStatusBadge.textContent = '⚠ Mixed Content Detected';
        testMessage.innerHTML = `<strong>Mixed Characters:</strong> ${result.message}`;
      } else if (result.status === 'visible-only') {
        testStatusBadge.className = 'tester-badge badge-danger';
        testStatusBadge.textContent = '✕ Visible Characters Only';
        testMessage.textContent = result.message;
      } else if (result.status === 'whitespace-only') {
        testStatusBadge.className = 'tester-badge badge-info';
        testStatusBadge.textContent = 'ℹ Standard Whitespace Detected';
        testMessage.textContent = result.message;
      } else {
        testStatusBadge.className = 'tester-badge badge-neutral';
        testStatusBadge.textContent = '○ Box Empty';
        testMessage.textContent = result.message;
      }

      // Render character details breakdown
      if (testDetails && result.codepoints && result.codepoints.length > 0) {
        const previewItems = result.codepoints.slice(0, 15).map(cp => `
          <div class="codepoint-chip">
            <span class="chip-hex">${cp.hex}</span>
            <span class="chip-name">${cp.name}</span>
          </div>
        `).join('');

        const extraNote = result.codepoints.length > 15 
          ? `<p class="tester-extra-note">+ ${result.codepoints.length - 15} more characters</p>`
          : '';

        testDetails.innerHTML = `
          <div class="codepoints-grid">${previewItems}</div>
          ${extraNote}
        `;
        testDetails.style.display = 'block';
      } else if (testDetails) {
        testDetails.innerHTML = '';
        testDetails.style.display = 'none';
      }
    }

    if (testInput) {
      testInput.addEventListener('input', runTest);
      testInput.addEventListener('paste', () => setTimeout(runTest, 50));
    }

    if (btnTestRun) {
      btnTestRun.addEventListener('click', runTest);
    }

    if (btnTestClear) {
      btnTestClear.addEventListener('click', function () {
        if (testInput) testInput.value = '';
        runTest();
        if (window.UIUtils && typeof UIUtils.showToast === 'function') {
          UIUtils.showToast('Test box cleared', 'info');
        }
      });
    }

    if (btnTestPaste) {
      btnTestPaste.addEventListener('click', async function () {
        try {
          if (navigator.clipboard && navigator.clipboard.readText) {
            const clipboardText = await navigator.clipboard.readText();
            if (testInput) {
              testInput.value = clipboardText;
              runTest();
              if (window.UIUtils && typeof UIUtils.showToast === 'function') {
                UIUtils.showToast('Pasted from clipboard!', 'success');
              }
            }
          } else {
            testInput.focus();
            if (window.UIUtils && typeof UIUtils.showToast === 'function') {
              UIUtils.showToast('Press Ctrl+V / Cmd+V to paste', 'info');
            }
          }
        } catch (e) {
          testInput.focus();
          if (window.UIUtils && typeof UIUtils.showToast === 'function') {
            UIUtils.showToast('Press Ctrl+V / Cmd+V to paste into the box', 'info');
          }
        }
      });
    }

    // Initial state setup
    updateCustomStats();
  }

  // Register on DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initInvisibleCharacterTool);
  } else {
    initInvisibleCharacterTool();
  }
})();

