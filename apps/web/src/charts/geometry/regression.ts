export function linearRegression(x: number[], y: number[]) {
  const n = x.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0, sumYY = 0;
  for (let i = 0; i < n; i++) {
    sumX += x[i];
    sumY += y[i];
    sumXY += x[i] * y[i];
    sumXX += x[i] * x[i];
    sumYY += y[i] * y[i];
  }
  const denominator = (n * sumXX - sumX * sumX);
  if (denominator === 0) return { slope: 0, intercept: 0, rSquared: 0 };
  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;
  
  // R-squared
  const meanY = sumY / n;
  let ssTot = 0, ssRes = 0;
  for (let i = 0; i < n; i++) {
    const yPred = slope * x[i] + intercept;
    ssTot += Math.pow(y[i] - meanY, 2);
    ssRes += Math.pow(y[i] - yPred, 2);
  }
  const rSquared = ssTot === 0 ? 0 : 1 - (ssRes / ssTot);

  return { slope, intercept, rSquared };
}

export function exponentialRegression(x: number[], y: number[]) {
  // y = A * e^(Bx) => ln(y) = ln(A) + B*x
  // We do linear regression on ln(y) vs x
  const filtered = x.map((xv, i) => ({ x: xv, y: y[i] })).filter(d => d.y > 0);
  if (filtered.length < 2) return { A: 0, B: 0, rSquared: 0 };
  
  const lx = filtered.map(d => d.x);
  const ly = filtered.map(d => Math.log(d.y));
  
  const lin = linearRegression(lx, ly);
  const A = Math.exp(lin.intercept);
  const B = lin.slope;

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
