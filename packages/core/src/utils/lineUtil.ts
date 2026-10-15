export interface LineIndex {
  /** 1-based line of an offset. */
  lineOf(offset: number): number;
}

const create = (text: string): LineIndex => {
  const starts = [0];
  for (let index = 0; index < text.length; index++) {
    if (text.charCodeAt(index) === 10) {
      starts.push(index + 1);
    }
  }
  return {
    lineOf(offset) {
      let low = 0;
      let high = starts.length - 1;
      while (low < high) {
        const middle = (low + high + 1) >> 1;
        if ((starts[middle] ?? 0) <= offset) {
          low = middle;
        } else {
          high = middle - 1;
        }
      }
      return low + 1;
    },
  };
};

export const LineUtil = {
  create,
};
