export function linearRegression(x: number[], y: number[], forceIntercept?: boolean, forcedValue: number = 0) {
  const n = x.length;
  if (n === 0) return { slope: 0, intercept: 0, rSquared: 0 };
  
  let slope = 0;
  let intercept = 0;

  if (forceIntercept) {
    intercept = forcedValue;
    let sumXX = 0, sumXYC = 0;
    for (let i = 0; i < n; i++) {
      sumXX += x[i] * x[i];
      sumXYC += x[i] * (y[i] - intercept);
    }
    slope = sumXX === 0 ? 0 : sumXYC / sumXX;
  } else {
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    for (let i = 0; i < n; i++) {
      sumX += x[i];
      sumY += y[i];
      sumXY += x[i] * y[i];
      sumXX += x[i] * x[i];
    }
    const denominator = (n * sumXX - sumX * sumX);
    if (denominator === 0) return { slope: 0, intercept: 0, rSquared: 0 };
    slope = (n * sumXY - sumX * sumY) / denominator;
    intercept = (sumY - slope * sumX) / n;
  }
  
  // R-squared
  const meanY = y.reduce((a, b) => a + b, 0) / n;
  let ssTot = 0, ssRes = 0;
  for (let i = 0; i < n; i++) {
    const yPred = slope * x[i] + intercept;
    ssTot += Math.pow(y[i] - meanY, 2);
    ssRes += Math.pow(y[i] - yPred, 2);
  }
  const rSquared = ssTot === 0 ? 0 : 1 - (ssRes / ssTot);

  return { slope, intercept, rSquared };
}

export function exponentialRegression(x: number[], y: number[], forceIntercept?: boolean, forcedValue: number = 0) {
  // y = A * e^(Bx) => ln(y) = ln(A) + B*x
  const filtered = x.map((xv, i) => ({ x: xv, y: y[i] })).filter(d => d.y > 0);
  if (filtered.length < 2) return { A: 0, B: 0, rSquared: 0 };
  
  const lx = filtered.map(d => d.x);
  const ly = filtered.map(d => Math.log(d.y));
  
  let A = 0;
  let B = 0;

  if (forceIntercept && forcedValue > 0) {
    const lnA = Math.log(forcedValue);
    A = forcedValue;
    // B = sum(x * (ln(y) - ln(A))) / sum(x^2)
    let sumXX = 0, sumXYC = 0;
    for (let i = 0; i < lx.length; i++) {
      sumXX += lx[i] * lx[i];
      sumXYC += lx[i] * (ly[i] - lnA);
    }
    B = sumXX === 0 ? 0 : sumXYC / sumXX;
  } else {
    const lin = linearRegression(lx, ly);
    A = Math.exp(lin.intercept);
    B = lin.slope;
  }

  // Calculate R-squared in linear space
  const meanY = filtered.reduce((s, d) => s + d.y, 0) / filtered.length;
  let ssTot = 0, ssRes = 0;
  for (let i = 0; i < filtered.length; i++) {
    const yPred = A * Math.exp(B * filtered[i].x);
    ssTot += Math.pow(filtered[i].y - meanY, 2);
    ssRes += Math.pow(filtered[i].y - yPred, 2);
  }
  const rSquared = ssTot === 0 ? 0 : 1 - (ssRes / ssTot);

  return { A, B, rSquared };
}

export function logarithmicRegression(x: number[], y: number[]) {
  // y = a * ln(x) + b
  const filtered = x.map((xv, i) => ({ x: xv, y: y[i] })).filter(d => d.x > 0);
  if (filtered.length < 2) return { a: 0, b: 0, rSquared: 0 };

  const lx = filtered.map(d => Math.log(d.x));
  const ly = filtered.map(d => d.y);

  const lin = linearRegression(lx, ly);
  const a = lin.slope;
  const b = lin.intercept;

  // Calculate R-squared
  const meanY = ly.reduce((sum, v) => sum + v, 0) / ly.length;
  let ssTot = 0, ssRes = 0;
  for (let i = 0; i < filtered.length; i++) {
    const yPred = a * Math.log(filtered[i].x) + b;
    ssTot += Math.pow(filtered[i].y - meanY, 2);
    ssRes += Math.pow(filtered[i].y - yPred, 2);
  }
  const rSquared = ssTot === 0 ? 0 : 1 - (ssRes / ssTot);

  return { a, b, rSquared };
}
