/** localStorage wrapper — keys prefixed with dome: */
export const store = {
  get(k, d) {
    try {
      const v = localStorage.getItem('dome:' + k);
      return v === null ? d : JSON.parse(v);
    } catch {
      return d;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem('dome:' + k, JSON.stringify(v));
    } catch {
      /* ignore */
    }
  },
};
