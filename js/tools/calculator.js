/**
 * LocalDoc.org — Pro Scientific Calculator & Solver Engine (js/tools/calculator.js)
 * Full Casio FX / Google Scientific caliber math engine.
 * 100% Client-Side RAM Execution. Works completely offline.
 */

(function() {
  'use strict';

  // Calculator State
  let expression = '';
  let lastResult = '0';
  let isResultDisplayed = false;
  let angleMode = 'DEG'; // 'DEG' or 'RAD'
  let memoryValue = 0;
  let hasMemory = false;
  let is2ndActive = false;
  let historyList = [];

  // DOM Elements
  const exprDisplay = document.getElementById('calc-expr-display');
  const resultDisplay = document.getElementById('calc-result-display');
  const angleModeBadge = document.getElementById('calc-angle-mode-badge');
  const memoryBadge = document.getElementById('calc-memory-badge');
  const historyListEl = document.getElementById('calc-history-list');

  // Solver Inputs
  const quadA = document.getElementById('quad-a');
  const quadB = document.getElementById('quad-b');
  const quadC = document.getElementById('quad-c');
  const quadSolveBtn = document.getElementById('quad-solve-btn');
  const quadResult = document.getElementById('quad-result');

  // Programmer Base Inputs
  const baseDec = document.getElementById('base-dec');
  const baseHex = document.getElementById('base-hex');
  const baseBin = document.getElementById('base-bin');
  const baseOct = document.getElementById('base-oct');

  function init() {
    setupKeypadEvents();
    setupSolvers();
    setupKeyboardSupport();
    updateDisplay();
  }

  function setupKeypadEvents() {
    document.querySelectorAll('[data-calc-action]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const action = btn.getAttribute('data-calc-action');
        const val = btn.getAttribute('data-calc-val');
        handleCalcAction(action, val);
      });
    });

    const angleBtn = document.getElementById('calc-angle-toggle');
    if (angleBtn) {
      angleBtn.addEventListener('click', () => {
        angleMode = angleMode === 'DEG' ? 'RAD' : 'DEG';
        if (angleModeBadge) angleModeBadge.textContent = angleMode;
        angleBtn.textContent = angleMode === 'DEG' ? 'RAD' : 'DEG';
      });
    }

    const toggle2ndBtn = document.getElementById('calc-2nd-toggle');
    if (toggle2ndBtn) {
      toggle2ndBtn.addEventListener('click', () => {
        is2ndActive = !is2ndActive;
        toggle2ndBtn.classList.toggle('active', is2ndActive);
        document.querySelectorAll('.calc-primary-fn').forEach(el => el.style.display = is2ndActive ? 'none' : 'inline-block');
        document.querySelectorAll('.calc-secondary-fn').forEach(el => el.style.display = is2ndActive ? 'inline-block' : 'none');
      });
    }

    const clearHistoryBtn = document.getElementById('calc-clear-history-btn');
    if (clearHistoryBtn) {
      clearHistoryBtn.addEventListener('click', () => {
        historyList = [];
        renderHistory();
      });
    }
  }

  function handleCalcAction(action, val) {
    switch(action) {
      case 'digit':
        if (isResultDisplayed) {
          expression = val;
          isResultDisplayed = false;
        } else {
          expression += val;
        }
        break;

      case 'decimal':
        if (isResultDisplayed) {
          expression = '0.';
          isResultDisplayed = false;
        } else {
          const parts = expression.split(/[\+\-\×\÷\^\(\)]/);
          const currentNum = parts[parts.length - 1];
          if (!currentNum.includes('.')) {
            expression += (currentNum === '' ? '0.' : '.');
          }
        }
        break;

      case 'operator':
        if (isResultDisplayed) {
          expression = lastResult + val;
          isResultDisplayed = false;
        } else {
          if (/[\+\-\×\÷\^]$/.test(expression)) {
            expression = expression.slice(0, -1) + val;
          } else {
            expression += val;
          }
        }
        break;

      case 'function':
        if (isResultDisplayed) {
          expression = val + '(' + lastResult + ')';
          isResultDisplayed = false;
        } else {
          expression += val + '(';
        }
        break;

      case 'constant':
        if (isResultDisplayed) {
          expression = val;
          isResultDisplayed = false;
        } else {
          expression += val;
        }
        break;

      case 'parenthesis':
        if (val === '(') {
          if (isResultDisplayed) {
            expression = '(';
            isResultDisplayed = false;
          } else {
            expression += '(';
          }
        } else {
          expression += ')';
        }
        break;

      case 'negate':
        if (isResultDisplayed) {
          expression = '(-' + lastResult + ')';
          isResultDisplayed = false;
        } else {
          expression += '(-';
        }
        break;

      case 'factorial':
        expression += '!';
        break;

      case 'reciprocal':
        expression = '1/(' + (expression || lastResult) + ')';
        break;

      case 'square':
        expression += '^2';
        break;

      case 'cube':
        expression += '^3';
        break;

      case 'percent':
        expression += '%';
        break;

      case 'clear-all':
        expression = '';
        lastResult = '0';
        isResultDisplayed = false;
        break;

      case 'backspace':
        if (isResultDisplayed) {
          expression = '';
          isResultDisplayed = false;
        } else {
          expression = expression.slice(0, -1);
        }
        break;

      case 'memory-clear':
        memoryValue = 0;
        hasMemory = false;
        updateMemoryBadge();
        break;

      case 'memory-recall':
        if (hasMemory) {
          expression += memoryValue.toString();
        }
        break;

      case 'memory-add':
        calculateCurrent(true);
        memoryValue += parseFloat(lastResult) || 0;
        hasMemory = true;
        updateMemoryBadge();
        break;

      case 'memory-sub':
        calculateCurrent(true);
        memoryValue -= parseFloat(lastResult) || 0;
        hasMemory = true;
        updateMemoryBadge();
        break;

      case 'memory-store':
        calculateCurrent(true);
        memoryValue = parseFloat(lastResult) || 0;
        hasMemory = true;
        updateMemoryBadge();
        break;

      case 'equals':
        evaluateExpression();
        break;
    }

    updateDisplay();
  }

  function updateMemoryBadge() {
    if (memoryBadge) {
      memoryBadge.style.display = hasMemory ? 'inline-block' : 'none';
    }
  }

  function updateDisplay() {
    if (exprDisplay) {
      exprDisplay.textContent = expression || (isResultDisplayed ? '' : '0');
    }
    if (resultDisplay) {
      resultDisplay.textContent = lastResult;
    }
  }

  function formatDisplayNumber(num) {
    if (isNaN(num) || !isFinite(num)) return 'Error';
    // Clean precision artifacts like 0.30000000000000004
    const rounded = Number(parseFloat(num.toPrecision(12)));
    if (Math.abs(rounded) > 1e12 || (Math.abs(rounded) < 1e-6 && rounded !== 0)) {
      return rounded.toExponential(6);
    }
    return rounded.toString();
  }

  // Safe & Robust Math Expression Parser
  function parseAndEvaluate(inputExpr) {
    if (!inputExpr.trim()) return 0;

    let s = inputExpr
      .replace(/×/g, '*')
      .replace(/÷/g, '/')
      .replace(/π/g, 'Math.PI')
      .replace(/φ/g, '1.618033988749895')
      .replace(/(\d+)\%/g, '($1/100)')
      .replace(/e\b/g, 'Math.E');

    // Handle factorials (e.g. 5! => fact(5))
    s = s.replace(/(\d+)!/g, 'fact($1)');

    // Handle trigonometric functions considering DEG/RAD
    const trigAngleFactor = angleMode === 'DEG' ? '(Math.PI/180)*' : '';
    const invTrigAngleFactor = angleMode === 'DEG' ? '*(180/Math.PI)' : '';

    s = s.replace(/sin\(/g, `Math.sin(${trigAngleFactor}`)
         .replace(/cos\(/g, `Math.cos(${trigAngleFactor}`)
         .replace(/tan\(/g, `Math.tan(${trigAngleFactor}`)
         .replace(/asin\(/g, `(${invTrigAngleFactor}Math.asin(`)
         .replace(/acos\(/g, `(${invTrigAngleFactor}Math.acos(`)
         .replace(/atan\(/g, `(${invTrigAngleFactor}Math.atan(`)
         .replace(/sinh\(/g, 'Math.sinh(')
         .replace(/cosh\(/g, 'Math.cosh(')
         .replace(/tanh\(/g, 'Math.tanh(')
         .replace(/asinh\(/g, 'Math.asinh(')
         .replace(/acosh\(/g, 'Math.acosh(')
         .replace(/atanh\(/g, 'Math.atanh(')
         .replace(/ln\(/g, 'Math.log(')
         .replace(/log10\(/g, 'Math.log10(')
         .replace(/log2\(/g, 'Math.log2(')
         .replace(/log\(/g, 'Math.log10(')
         .replace(/sqrt\(/g, 'Math.sqrt(')
         .replace(/cbrt\(/g, 'Math.cbrt(')
         .replace(/abs\(/g, 'Math.abs(')
         .replace(/exp\(/g, 'Math.exp(');

    // Exponents: a^b => Math.pow(a, b)
    s = s.replace(/([0-9\.]+|\([^\)]+\))\^([0-9\.]+|\([^\)]+\))/g, 'Math.pow($1,$2)');

    // Balance open parentheses
    let openCount = (s.match(/\(/g) || []).length;
    let closeCount = (s.match(/\)/g) || []).length;
    while (openCount > closeCount) {
      s += ')';
      closeCount++;
    }

    // Evaluate in safe scope with helper functions
    const fact = (n) => {
      if (n < 0 || Math.floor(n) !== n) return NaN;
      if (n === 0 || n === 1) return 1;
      let r = 1;
      for (let i = 2; i <= n; i++) r *= i;
      return r;
    };

    const nPr = (n, r) => fact(n) / fact(n - r);
    const nCr = (n, r) => fact(n) / (fact(r) * fact(n - r));

    // Execute through Function constructor without eval
    const evalFn = new Function('Math', 'fact', 'nPr', 'nCr', `"use strict"; return (${s});`);
    return evalFn(Math, fact, nPr, nCr);
  }

  function evaluateExpression() {
    if (!expression) return;
    try {
      const res = parseAndEvaluate(expression);
      const formattedRes = formatDisplayNumber(res);

      // Add to history reel
      historyList.unshift({
        expr: expression,
        result: formattedRes,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      });
      if (historyList.length > 50) historyList.pop();
      renderHistory();

      lastResult = formattedRes;
      isResultDisplayed = true;
    } catch (e) {
      console.warn('Calc syntax error:', e);
      lastResult = 'Syntax Error';
      isResultDisplayed = true;
    }
  }

  function calculateCurrent(silent = false) {
    if (!expression) return;
    try {
      const res = parseAndEvaluate(expression);
      lastResult = formatDisplayNumber(res);
      if (!silent) isResultDisplayed = true;
    } catch (e) {}
  }

  function renderHistory() {
    if (!historyListEl) return;
    historyListEl.innerHTML = '';

    if (historyList.length === 0) {
      historyListEl.innerHTML = '<div style="color:var(--text-tertiary); font-size:0.85rem; text-align:center; padding:20px 0;">No calculations yet</div>';
      return;
    }

    historyList.forEach(item => {
      const entry = document.createElement('div');
      entry.className = 'calc-history-entry';
      entry.innerHTML = `
        <div class="calc-history-expr">${item.expr} =</div>
        <div class="calc-history-res">${item.result}</div>
      `;
      entry.addEventListener('click', () => {
        expression = item.expr;
        lastResult = item.result;
        isResultDisplayed = false;
        updateDisplay();
      });
      historyListEl.appendChild(entry);
    });
  }

  // Keyboard handler
  function setupKeyboardSupport() {
    window.addEventListener('keydown', (e) => {
      // Don't trigger if user is typing in quadratic or programmer inputs
      if (e.target.tagName === 'INPUT') return;

      if (e.key >= '0' && e.key <= '9') {
        handleCalcAction('digit', e.key);
      } else if (e.key === '.') {
        handleCalcAction('decimal');
      } else if (e.key === '+') {
        handleCalcAction('operator', '+');
      } else if (e.key === '-') {
        handleCalcAction('operator', '-');
      } else if (e.key === '*' || e.key === 'x') {
        handleCalcAction('operator', '×');
      } else if (e.key === '/') {
        e.preventDefault();
        handleCalcAction('operator', '÷');
      } else if (e.key === '^') {
        handleCalcAction('operator', '^');
      } else if (e.key === '(' || e.key === ')') {
        handleCalcAction('parenthesis', e.key);
      } else if (e.key === 'Enter' || e.key === '=') {
        e.preventDefault();
        handleCalcAction('equals');
      } else if (e.key === 'Backspace') {
        handleCalcAction('backspace');
      } else if (e.key === 'Escape') {
        handleCalcAction('clear-all');
      } else if (e.key === '%') {
        handleCalcAction('percent');
      }
    });
  }

  // Equation Solvers & Base Converters
  function setupSolvers() {
    // Quadratic Solver: ax^2 + bx + c = 0
    if (quadSolveBtn && quadResult) {
      quadSolveBtn.addEventListener('click', () => {
        const a = parseFloat(quadA.value);
        const b = parseFloat(quadB.value);
        const c = parseFloat(quadC.value);

        if (isNaN(a) || isNaN(b) || isNaN(c)) {
          quadResult.innerHTML = '<span style="color:var(--danger)">Please enter valid coefficients a, b, and c.</span>';
          return;
        }
        if (a === 0) {
          if (b === 0) {
            quadResult.innerHTML = c === 0 ? 'Infinite solutions (0 = 0).' : '<span style="color:var(--danger)">No solution.</span>';
          } else {
            const x = -c / b;
            quadResult.innerHTML = `<strong>Linear equation:</strong> x = ${formatDisplayNumber(x)}`;
          }
          return;
        }

        const delta = b * b - 4 * a * c;
        const vertexX = -b / (2 * a);
        const vertexY = -delta / (4 * a);

        let outHtml = `<div><strong>Discriminant (Δ):</strong> ${formatDisplayNumber(delta)}</div>`;

        if (delta > 0) {
          const x1 = (-b + Math.sqrt(delta)) / (2 * a);
          const x2 = (-b - Math.sqrt(delta)) / (2 * a);
          outHtml += `
            <div style="margin-top:6px; color:var(--primary); font-weight:700;">Two Real Roots:</div>
            <div>x₁ = ${formatDisplayNumber(x1)}</div>
            <div>x₂ = ${formatDisplayNumber(x2)}</div>
          `;
        } else if (delta === 0) {
          const x = -b / (2 * a);
          outHtml += `
            <div style="margin-top:6px; color:var(--primary); font-weight:700;">One Repeated Real Root:</div>
            <div>x = ${formatDisplayNumber(x)}</div>
          `;
        } else {
          const real = (-b / (2 * a)).toFixed(4);
          const imag = (Math.sqrt(-delta) / (2 * a)).toFixed(4);
          outHtml += `
            <div style="margin-top:6px; color:var(--primary); font-weight:700;">Two Complex Roots:</div>
            <div>x₁ = ${real} + ${imag}i</div>
            <div>x₂ = ${real} - ${imag}i</div>
          `;
        }

        outHtml += `<div style="margin-top:8px; font-size:0.82rem; color:var(--text-secondary);">Vertex: (${formatDisplayNumber(vertexX)}, ${formatDisplayNumber(vertexY)})</div>`;
        quadResult.innerHTML = outHtml;
      });
    }

    // Programmer Base Synchronizer (DEC, HEX, BIN, OCT)
    const updateBases = (val, source) => {
      let num = parseInt(val, source === 'hex' ? 16 : source === 'bin' ? 2 : source === 'oct' ? 8 : 10);
      if (isNaN(num)) {
        if (source !== 'dec' && baseDec) baseDec.value = '';
        if (source !== 'hex' && baseHex) baseHex.value = '';
        if (source !== 'bin' && baseBin) baseBin.value = '';
        if (source !== 'oct' && baseOct) baseOct.value = '';
        return;
      }
      if (source !== 'dec' && baseDec) baseDec.value = num.toString(10);
      if (source !== 'hex' && baseHex) baseHex.value = num.toString(16).toUpperCase();
      if (source !== 'bin' && baseBin) baseBin.value = num.toString(2);
      if (source !== 'oct' && baseOct) baseOct.value = num.toString(8);
    };

    if (baseDec) baseDec.addEventListener('input', (e) => updateBases(e.target.value, 'dec'));
    if (baseHex) baseHex.addEventListener('input', (e) => updateBases(e.target.value, 'hex'));
    if (baseBin) baseBin.addEventListener('input', (e) => updateBases(e.target.value, 'bin'));
    if (baseOct) baseOct.addEventListener('input', (e) => updateBases(e.target.value, 'oct'));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
